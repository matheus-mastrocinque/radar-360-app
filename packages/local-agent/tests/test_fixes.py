"""Tests for the fix mode (--corrigir / --simular / --desfazer) and the router's UPnP mappings.

Run from the package folder:
    python -I -m unittest discover -s tests

Nothing here changes the real computer or touches the network: every command that changes
settings goes through scanner.run_change_cmd and every SOAP call through scanner._soap_post,
and both are replaced by fakes. subprocess.run itself raises if anything slips through. The
fix journal is always a temporary file.
"""

from __future__ import annotations

import contextlib
import html
import io
import ipaddress
import json
import os
import re
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import scanner  # noqa: E402

REAL_JOURNAL_PATH = scanner.journal_path
WANIP1 = "urn:schemas-upnp-org:service:WANIPConnection:1"
CONTROL_URL = "http://192.168.0.1:5000/ctl/IPConn"
LOCATION = "http://192.168.0.1:5000/rootDesc.xml"
ISO_RE = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"


def captured():
    """Capture stdout and stderr of the CLI flows."""
    out, err = io.StringIO(), io.StringIO()
    stack = contextlib.ExitStack()
    stack.enter_context(contextlib.redirect_stdout(out))
    stack.enter_context(contextlib.redirect_stderr(err))
    return stack, out, err


def parse_args(*argv):
    return scanner.build_arg_parser().parse_args(list(argv))


# ---------------------------------------------------------------------------
# A fake Windows computer whose state changes only through run_change_cmd
# ---------------------------------------------------------------------------

ROUTE_PRINT = """
Rotas ativas:
Endereço de rede          Máscara   Ender. gateway       Interface   Custo
          0.0.0.0          0.0.0.0      192.168.0.1      192.168.0.8     25
"""

IPCONFIG = """
Adaptador de Rede sem Fio Wi-Fi:

   Endereço IPv4. . . . . . . .  . . . . . . . : 192.168.0.8
   Máscara de Sub-rede . . . . . . . . . . . . : 255.255.255.0
   Gateway Padrão. . . . . . . . . . . . . . . : 192.168.0.1
"""

NETSH_WLAN_OPEN = """
    Nome                   : Wi-Fi
    Estado                 : conectado
    Autenticação           : Aberta
"""

TASKLIST = (
    '"System","4","Services","0","8 K"\n'
    '"svchost.exe","1100","Services","0","8 K"\n'
    '"postgres.exe","9900","Console","1","20.000 K"\n'
)

SMB_RULES = ("FPS-SMB-In-TCP", "FPS-NB_Session-In-TCP")


class FakeWindows:
    """Coffee-shop laptop: firewall off on Private/Public, network marked Private, SMB rules
    on for Public, Remote Desktop on and PostgreSQL listening on every interface."""

    def __init__(self):
        self.firewall = {"domain": True, "private": False, "public": False}
        self.category = "Private"
        self.rdp_deny = 0
        self.rules = {name: True for name in SMB_RULES}
        self.blocks: set[int] = set()
        self.changes: list[list[str]] = []
        self.reads: list[list[str]] = []

    def snapshot(self):
        return (dict(self.firewall), self.category, self.rdp_deny, dict(self.rules), set(self.blocks))

    # --- read-only commands -------------------------------------------------
    def run_cmd(self, cmd, timeout=None):
        self.reads.append(list(cmd))
        joined = " ".join(cmd)
        if cmd[0] == "route":
            return ROUTE_PRINT
        if cmd[0] == "ipconfig":
            return IPCONFIG
        if joined == "netstat -ano -p tcpv6":
            return ""
        if joined == "netstat -ano -p tcp":
            lines = ["  TCP    0.0.0.0:445    0.0.0.0:0    LISTENING    4",
                     "  TCP    0.0.0.0:5432   0.0.0.0:0    LISTENING    9900"]
            if self.rdp_deny == 0:
                lines.append("  TCP    0.0.0.0:3389   0.0.0.0:0    LISTENING    1100")
            return "\n".join(lines)
        if cmd[0] == "tasklist":
            return TASKLIST
        if joined.startswith("netsh advfirewall show"):
            blocks = []
            for title, key in (("Domain", "domain"), ("Private", "private"), ("Public", "public")):
                blocks.append(f"{title} Profile Settings:\n{'-' * 70}\n"
                              f"State                                 {'ON' if self.firewall[key] else 'OFF'}\n")
            return "\n".join(blocks) + "Ok.\n"
        if joined.startswith("netsh wlan"):
            return NETSH_WLAN_OPEN
        if cmd[0] == "powershell" and "Get-NetConnectionProfile" in joined:
            category = 1 if self.category == "Private" else 0
            return json.dumps({"Name": "CafeLivre", "InterfaceAlias": "Wi-Fi", "InterfaceIndex": 12,
                               "NetworkCategory": category})
        if cmd[0] == "powershell" and "FirewallRules" in joined:
            lines = ["OLHARIUM-FW-RULES"]
            for name, enabled in self.rules.items():
                port = 445 if "SMB" in name else 139
                lines.append(
                    f"{name}\tv2.33|Action=Allow|Active={'TRUE' if enabled else 'FALSE'}|Dir=In|Protocol=6|"
                    f"Profile=Private|Profile=Public|LPort={port}|App=System|Name=@FirewallAPI.dll,-28511|"
                    "EmbedCtxt=@FirewallAPI.dll,-28502|"
                )
            for port in sorted(self.blocks):
                lines.append(
                    f"Olharium-Block-TCP-{port}\tv2.33|Action=Block|Active=TRUE|Dir=In|Protocol=6|"
                    f"LPort={port}|Name=Olharium: bloqueio da porta {port}|"
                )
            return "\n".join(lines) + "\n"
        if joined.startswith("reg query"):
            return ("\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\n"
                    f"    fDenyTSConnections    REG_DWORD    0x{self.rdp_deny:x}\n")
        if cmd[0] == "arp":
            return ""
        return None

    # --- commands that change the system (only after SIM) --------------------
    def run_change_cmd(self, cmd, timeout=None):
        self.changes.append(list(cmd))
        joined = " ".join(cmd)
        if cmd[:3] == ["netsh", "advfirewall", "set"]:
            self.firewall[cmd[3].replace("profile", "")] = cmd[5] == "on"
            return 0, "Ok."
        if "Set-NetConnectionProfile -InterfaceIndex 12" in joined:
            self.category = "Public" if joined.endswith("Public") else "Private"
            return 0, ""
        for verb, state in (("Disable-NetFirewallRule", False), ("Enable-NetFirewallRule", True)):
            if verb in joined:
                for name in re.findall(r"'([^']+)'", joined.split("-Name", 1)[1]):
                    self.rules[name] = state
                return 0, ""
        if cmd[:2] == ["reg", "add"]:
            self.rdp_deny = int(cmd[cmd.index("/d") + 1])
            return 0, "A operação foi concluída com êxito."
        if "New-NetFirewallRule" in joined:
            self.blocks.add(int(re.search(r"-LocalPort (\d+)", joined).group(1)))
            return 0, ""
        if "Remove-NetFirewallRule" in joined:
            self.blocks.discard(int(re.search(r"Olharium-Block-TCP-(\d+)", joined).group(1)))
            return 0, ""
        return 1, "comando inesperado"


# ---------------------------------------------------------------------------
# A fake router (IGD) answering only SOAP, with its own mapping table
# ---------------------------------------------------------------------------

def soap_error(code: int, description: str = "erro") -> tuple[int, str]:
    return 500, (
        '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
        "<s:Fault><faultcode>s:Client</faultcode><faultstring>UPnPError</faultstring><detail>"
        f'<UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>{code}</errorCode>'
        f"<errorDescription>{description}</errorDescription></UPnPError></detail></s:Fault>"
        "</s:Body></s:Envelope>"
    )


def mapping(external, internal, client="192.168.0.20", protocol="TCP", description="", enabled="1",
            lease="0", remote=""):
    return {"NewRemoteHost": remote, "NewExternalPort": str(external), "NewProtocol": protocol,
            "NewInternalPort": str(internal), "NewInternalClient": client, "NewEnabled": enabled,
            "NewPortMappingDescription": description, "NewLeaseDuration": lease}


class FakeRouter:
    def __init__(self, mappings=(), permanent_only=False, refuse_delete=False):
        self.mappings = [dict(m) for m in mappings]
        self.calls: list[tuple[str, str, dict]] = []
        self.permanent_only = permanent_only
        self.refuse_delete = refuse_delete

    def __call__(self, url, headers, body, timeout):
        service, _, action = headers["SOAPAction"].strip('"').partition("#")
        text = body.decode("utf-8")
        args = {k: html.unescape(v) for k, v in re.findall(r"<(New\w+)>(.*?)</\1>", text, re.S)}
        self.calls.append((url, action, args))
        assert service == WANIP1, service
        assert f'<u:{action} xmlns:u="{WANIP1}">' in text
        if action == "GetGenericPortMappingEntry":
            index = int(args["NewPortMappingIndex"])
            if index >= len(self.mappings):
                return soap_error(713, "SpecifiedArrayIndexInvalid")
            fields = "".join(f"<{k}>{html.escape(v)}</{k}>" for k, v in self.mappings[index].items())
            return 200, (f'<s:Envelope><s:Body><u:{action}Response xmlns:u="{WANIP1}">{fields}'
                         f"</u:{action}Response></s:Body></s:Envelope>")
        key = (args.get("NewRemoteHost", ""), args["NewExternalPort"], args["NewProtocol"])
        found = [m for m in self.mappings
                 if (m["NewRemoteHost"], m["NewExternalPort"], m["NewProtocol"]) == key]
        if action == "DeletePortMapping":
            if self.refuse_delete:
                return soap_error(606, "Action not authorized")
            if not found:
                return soap_error(714, "NoSuchEntryInArray")
            self.mappings.remove(found[0])
            return 200, "<s:Envelope><s:Body><u:DeletePortMappingResponse/></s:Body></s:Envelope>"
        if action == "AddPortMapping":
            if self.permanent_only and args["NewLeaseDuration"] != "0":
                return soap_error(725, "OnlyPermanentLeasesSupported")
            if found:
                return soap_error(718, "ConflictInMappingEntry")
            self.mappings.append(dict(args))
            return 200, "<s:Envelope><s:Body><u:AddPortMappingResponse/></s:Body></s:Envelope>"
        return soap_error(401, "Invalid Action")

    def actions(self):
        return [action for _url, action, _args in self.calls]


# ---------------------------------------------------------------------------
# Base class: temporary journal, and nothing real can run
# ---------------------------------------------------------------------------

class SafeTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.journal = os.path.join(self.tmp.name, "Olharium", "fixes.json")
        patches = [
            mock.patch.object(scanner, "journal_path", return_value=self.journal),
            # Any real process or HTTP call is a test failure.
            mock.patch.object(scanner.subprocess, "run", side_effect=AssertionError("processo real")),
            mock.patch.object(scanner, "_soap_post", side_effect=AssertionError("SOAP real")),
            mock.patch.object(scanner, "upload_payload", side_effect=AssertionError("envio real")),
        ]
        for patch in patches:
            patch.start()
        self.addCleanup(mock.patch.stopall)
        scanner._revoke_probes()
        self.addCleanup(scanner._revoke_probes)

    def read_journal(self):
        with open(self.journal, encoding="utf-8") as handle:
            return json.load(handle)

    def write_journal(self, entries):
        os.makedirs(os.path.dirname(self.journal), exist_ok=True)
        with open(self.journal, "w", encoding="utf-8") as handle:
            json.dump({"version": 1, "fixes": entries}, handle)


def make_audit(findings, os_name="windows", firewall=None, profiles=None, rules=None):
    return scanner.PublicAudit(
        os_name=os_name, hostname="pc", net=scanner.NetworkInfo("192.168.0.8", 24, "192.168.0.1"),
        profiles=profiles or [], firewall=firewall or scanner.FirewallStatus(True),
        fw_rules=rules or scanner.WindowsFirewallRules(), listeners=[], wifi_raw=None,
        findings=[scanner.make_finding("medium", kind, "t", "d", "r", None, port) for kind, port in findings],
    )


# ---------------------------------------------------------------------------
# Exact commands and their validation
# ---------------------------------------------------------------------------

class FixCommandTests(unittest.TestCase):
    def test_windows_commands_are_exact(self):
        build = scanner.build_command
        self.assertEqual(
            build({"action": "firewall_set", "os": "windows", "profile": "private", "state": "on"}),
            ["netsh", "advfirewall", "set", "privateprofile", "state", "on"],
        )
        ps_prefix = ["powershell", "-NoProfile", "-NonInteractive", "-Command"]
        cmd = build({"action": "network_category", "index": 12, "category": "Public"})
        self.assertEqual(cmd[:4], ps_prefix)
        self.assertEqual(cmd[4], "$ErrorActionPreference = 'Stop'; "
                                 "Set-NetConnectionProfile -InterfaceIndex 12 -NetworkCategory Public")
        cmd = build({"action": "firewall_rules", "names": list(SMB_RULES), "enabled": False})
        self.assertTrue(cmd[4].endswith("Disable-NetFirewallRule -Name 'FPS-SMB-In-TCP','FPS-NB_Session-In-TCP'"))
        cmd = build({"action": "firewall_rules", "names": ["FPS-SMB-In-TCP"], "enabled": True})
        self.assertTrue(cmd[4].endswith("Enable-NetFirewallRule -Name 'FPS-SMB-In-TCP'"))
        self.assertEqual(
            build({"action": "rdp_deny", "value": 1}),
            ["reg", "add", r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server",
             "/v", "fDenyTSConnections", "/t", "REG_DWORD", "/d", "1", "/f"],
        )
        cmd = build({"action": "port_block", "port": 5432, "present": True})
        self.assertIn("New-NetFirewallRule -Name 'Olharium-Block-TCP-5432' "
                      "-DisplayName 'Olharium: bloqueio da porta 5432' -Direction Inbound -Action Block "
                      "-Protocol TCP -LocalPort 5432 -Profile Any", cmd[4])
        cmd = build({"action": "port_block", "port": 5432, "present": False})
        self.assertTrue(cmd[4].endswith("Remove-NetFirewallRule -Name 'Olharium-Block-TCP-5432'"))

    def test_macos_and_linux_commands(self):
        self.assertEqual(
            scanner.build_command({"action": "firewall_set", "os": "macos", "state": "on"}),
            ["/usr/libexec/ApplicationFirewall/socketfilterfw", "--setglobalstate", "on"],
        )
        self.assertEqual(scanner.build_command({"action": "firewall_set", "os": "linux", "state": "on"}),
                         ["ufw", "enable"])
        self.assertEqual(scanner.build_command({"action": "firewall_set", "os": "linux", "state": "off"}),
                         ["ufw", "disable"])

    def test_tampered_or_unexpected_steps_are_refused(self):
        bad = [
            None, "netsh advfirewall set allprofiles state off",
            {"action": "shell", "cmd": "whoami"},
            {"action": "firewall_set", "os": "windows", "profile": "allprofiles", "state": "on"},
            {"action": "firewall_set", "os": "windows", "profile": "public", "state": "on; whoami"},
            {"action": "firewall_set", "os": "solaris", "state": "on"},
            {"action": "network_category", "index": "12; Remove-Item C:\\", "category": "Public"},
            {"action": "network_category", "index": True, "category": "Public"},
            {"action": "network_category", "index": 12, "category": "Public; whoami"},
            {"action": "firewall_rules", "names": ["x'; Remove-Item C:\\ -Recurse; '"], "enabled": True},
            {"action": "firewall_rules", "names": ["FPS-*"], "enabled": True},
            {"action": "firewall_rules", "names": [], "enabled": True},
            {"action": "firewall_rules", "names": ["FPS-SMB-In-TCP"], "enabled": "yes"},
            {"action": "rdp_deny", "value": 2},
            {"action": "rdp_deny", "value": True},
            {"action": "rdp_deny", "value": "0"},
            {"action": "port_block", "port": 70000, "present": True},
            {"action": "port_block", "port": "5432", "present": True},
        ]
        for spec in bad:
            with self.assertRaises(ValueError, msg=spec):
                scanner.build_command(spec)
            self.assertIn("inválido", scanner.describe_spec(spec))

    def test_upnp_steps_are_validated(self):
        good = {"action": "upnp_delete", "controlURL": CONTROL_URL, "serviceType": WANIP1,
                "remoteHost": "", "externalPort": 3389, "protocol": "TCP"}
        self.assertEqual(scanner.validate_upnp_spec(good)["externalPort"], 3389)
        add = dict(good, action="upnp_add", internalPort=3389, internalClient="192.168.0.20",
                   enabled=True, description="RDP", leaseDuration=0)
        self.assertEqual(scanner.validate_upnp_spec(add)["internalClient"], "192.168.0.20")
        for change in ({"controlURL": "http://8.8.8.8/ctl"}, {"controlURL": "https://192.168.0.1/ctl"},
                       {"controlURL": "http://router.local/ctl"},
                       {"serviceType": WANIP1 + "#x"}, {"serviceType": "urn:schemas-upnp-org:service:Layer3Forwarding:1"},
                       {"protocol": "ICMP"}, {"externalPort": 0}, {"remoteHost": "evil"},
                       {"action": "upnp_force_termination"}):
            with self.assertRaises(ValueError, msg=change):
                scanner.validate_upnp_spec(dict(good, **change))
        with self.assertRaises(ValueError):
            scanner.validate_upnp_spec(dict(add, internalClient="8.8.8.8"))  # never map to the Internet
        self.assertIn("UPnP DeletePortMapping em http://192.168.0.1:5000/ctl/IPConn", scanner.describe_spec(good))


# ---------------------------------------------------------------------------
# Plans: which findings get which fix
# ---------------------------------------------------------------------------

class PlanTests(unittest.TestCase):
    def windows_audit(self):
        rules = scanner.WindowsFirewallRules(known=True, smb_public_rules=[
            {"name": "FPS-SMB-In-TCP", "displayName": "FPS-SMB-In-TCP (porta 445)", "profile": 6},
        ])
        return make_audit(
            [("firewall_disabled", None), ("network_marked_private", None), ("exposed_smb", 445),
             ("exposed_smb", 139), ("exposed_rdp", 3389), ("exposed_database", 5432),
             ("exposed_dev_server", 5173), ("exposed_ssh", 22), ("wifi_open", None)],
            firewall=scanner.FirewallStatus(False, ["private", "public"], "netsh"),
            profiles=[{"name": "CafeLivre", "category": "private", "index": 12}],
            rules=rules,
        )

    def test_each_windows_finding_gets_its_fix(self):
        reg = "    fDenyTSConnections    REG_DWORD    0x0\n"
        with mock.patch.object(scanner, "run_cmd", return_value=reg) as run_cmd:
            plans = scanner.plan_computer_fixes(self.windows_audit())
        run_cmd.assert_called_once_with(["reg", "query", scanner.RDP_KEY, "/v", "fDenyTSConnections"])
        self.assertEqual(
            [(p.kind, p.finding_kind) for p in plans],
            [("firewall_enabled", "firewall_disabled"), ("network_set_public", "network_marked_private"),
             ("smb_public_rules_disabled", "exposed_smb"), ("rdp_disabled", "exposed_rdp"),
             ("port_blocked", "exposed_database"), ("port_blocked", "exposed_dev_server")],
        )
        firewall = plans[0]
        self.assertEqual(firewall.title, "Firewall ativado nos perfis Privado e Público")
        self.assertEqual([do["profile"] for do, _undo in firewall.steps], ["private", "public"])  # not domain
        self.assertTrue(all(undo["state"] == "off" for _do, undo in firewall.steps))
        profile = plans[1]
        self.assertIn("CafeLivre", profile.label)
        self.assertNotIn("CafeLivre", profile.title)  # the SSID never goes to the API
        for plan in plans:
            self.assertEqual(plan.target, "computer")
            self.assertTrue(plan.needs_admin)
            for text in (plan.problem, plan.change, plan.risk, plan.undo_text):
                self.assertTrue(text)
            self.assertLessEqual(len(plan.title), scanner.MAX_FIX_TITLE)
            for do, undo in plan.steps:
                scanner.build_command(do)
                scanner.build_command(undo)

    def test_rdp_needs_registry_value_zero(self):
        audit = make_audit([("exposed_rdp", 3389)])
        for output in (None, "    fDenyTSConnections    REG_DWORD    0x1\n"):
            with mock.patch.object(scanner, "run_cmd", return_value=output):
                self.assertEqual(scanner.plan_computer_fixes(audit), [], output)

    def test_smb_needs_enabled_public_rules(self):
        audit = make_audit([("exposed_smb", 445)], rules=scanner.WindowsFirewallRules(known=True))
        self.assertEqual(scanner.plan_computer_fixes(audit), [])
        audit = make_audit([("exposed_smb", 445)])  # rules unknown
        self.assertEqual(scanner.plan_computer_fixes(audit), [])

    def test_profile_needs_interface_index(self):
        audit = make_audit([("network_marked_private", None)], profiles=[{"name": "x", "category": "private"}])
        self.assertEqual(scanner.plan_computer_fixes(audit), [])

    def test_already_blocked_port_is_not_planned(self):
        audit = make_audit([("exposed_database", 5432)],
                           rules=scanner.WindowsFirewallRules(known=True, blocked_ports={5432}))
        self.assertEqual(scanner.plan_computer_fixes(audit), [])

    def test_macos_and_linux_only_get_the_firewall(self):
        findings = [("firewall_disabled", None), ("exposed_smb", 445), ("exposed_database", 5432)]
        plans = scanner.plan_computer_fixes(
            make_audit(findings, "macos", scanner.FirewallStatus(False, [], "socketfilterfw")))
        self.assertEqual([p.kind for p in plans], ["firewall_enabled"])
        self.assertEqual(scanner.build_command(plans[0].steps[0][0])[1:], ["--setglobalstate", "on"])
        plans = scanner.plan_computer_fixes(make_audit(findings, "linux", scanner.FirewallStatus(False, [], "ufw")))
        self.assertEqual(scanner.build_command(plans[0].steps[0][0]), ["ufw", "enable"])
        self.assertIn("ssh", plans[0].risk)
        plans = scanner.plan_computer_fixes(
            make_audit(findings, "linux", scanner.FirewallStatus(False, [], "firewalld")))
        self.assertEqual(plans, [])  # only orientation


# ---------------------------------------------------------------------------
# --corrigir in public mode: one fix at a time, only with SIM
# ---------------------------------------------------------------------------

class PublicFixFlowTests(SafeTestCase):
    def setUp(self):
        super().setUp()
        self.pc = FakeWindows()
        for patch in (
            mock.patch.object(scanner, "run_cmd", side_effect=self.pc.run_cmd),
            mock.patch.object(scanner, "run_change_cmd", side_effect=self.pc.run_change_cmd),
            mock.patch.object(scanner, "detect_os", return_value="windows"),
            mock.patch.object(scanner, "get_hostname", return_value="notebook-01"),
            mock.patch.object(scanner, "get_local_ip", return_value="192.168.0.8"),
            mock.patch.object(scanner, "read_text_file", return_value=None),
        ):
            patch.start()
        self.admin = mock.patch.object(scanner, "is_admin", return_value=True).start()
        self.interactive = mock.patch.object(scanner, "_stdin_is_interactive", return_value=True).start()

    def run_public(self, *flags, inputs=()):
        stack, out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=list(inputs)) as fake_input:
            code = scanner.run_public(parse_args("--mode", "public", "--json", *flags))
        self.input = fake_input
        return code, json.loads(out.getvalue()), err.getvalue()

    def test_full_flow_fixes_everything_and_score_drops(self):
        initial = self.pc.snapshot()
        code, payload, err = self.run_public("--corrigir", inputs=["SIM"] * 5)
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertEqual(self.input.call_count, 5)  # one confirmation per fix
        self.assertEqual(err.count("Aplicar esta correção? Digite SIM"), 5)
        for text in ("Problema:", "O que muda:", "Comando exato:", "Risco:", "Como desfazer:"):
            self.assertEqual(err.count(text), 5, text)
        # Exact commands, in order.
        joined = [" ".join(c) for c in self.pc.changes]
        self.assertEqual(joined[0], "netsh advfirewall set privateprofile state on")
        self.assertEqual(joined[1], "netsh advfirewall set publicprofile state on")
        self.assertTrue(joined[2].endswith("Set-NetConnectionProfile -InterfaceIndex 12 -NetworkCategory Public"))
        self.assertTrue(joined[3].endswith("Disable-NetFirewallRule -Name 'FPS-SMB-In-TCP','FPS-NB_Session-In-TCP'"))
        self.assertEqual(self.pc.changes[4][:2], ["reg", "add"])
        self.assertIn("New-NetFirewallRule -Name 'Olharium-Block-TCP-5432'", joined[5])
        self.assertEqual(len(joined), 6)
        # The second audit reflects the new state: only the open Wi-Fi is still a real risk.
        kinds = {f["kind"]: f for f in payload["findings"]}
        for gone in ("firewall_disabled", "network_marked_private", "exposed_smb", "exposed_rdp", "exposed_database"):
            self.assertNotIn(gone, kinds)
        self.assertEqual(kinds["firewall_enabled"]["severity"], "info")
        blocked = sorted(f["port"] for f in payload["findings"] if f["kind"] == "port_blocked_by_firewall")
        self.assertEqual(blocked, [445, 5432])
        serious = [f["kind"] for f in payload["findings"] if f["severity"] in ("medium", "high", "critical")]
        self.assertEqual(serious, ["wifi_open"])
        # Payload: one item per fix, exactly the contract.
        self.assertEqual(
            [(f["kind"], f["target"], f["findingKind"]) for f in payload["fixes"]],
            [("firewall_enabled", "computer", "firewall_disabled"),
             ("network_set_public", "computer", "network_marked_private"),
             ("smb_public_rules_disabled", "computer", "exposed_smb"),
             ("rdp_disabled", "computer", "exposed_rdp"),
             ("port_blocked", "computer", "exposed_database")],
        )
        self.assertEqual(payload["fixes"][0]["title"], "Firewall ativado nos perfis Privado e Público")
        for fix in payload["fixes"]:
            self.assertEqual(set(fix), {"kind", "target", "title", "appliedAt", "findingKind"})
            self.assertRegex(fix["appliedAt"], ISO_RE)
        # Journal: one entry per fix with structured undo data.
        entries = self.read_journal()["fixes"]
        self.assertEqual([e["kind"] for e in entries], [f["kind"] for f in payload["fixes"]])
        self.assertEqual(entries[0]["undo"], [
            {"action": "firewall_set", "os": "windows", "profile": "private", "state": "off"},
            {"action": "firewall_set", "os": "windows", "profile": "public", "state": "off"},
        ])
        self.assertTrue(all(e["undoneAt"] is None for e in entries))
        self.assertNotEqual(self.pc.snapshot(), initial)

        # --desfazer TODAS puts the computer back exactly as it was (newest first).
        stack, _out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=["TODAS", "SIM"]):
            code = scanner.run_undo(parse_args("--desfazer"))
        self.assertEqual(code, scanner.EXIT_OK)
        undo_cmds = [" ".join(c) for c in self.pc.changes[6:]]
        self.assertTrue(undo_cmds[0].endswith("Remove-NetFirewallRule -Name 'Olharium-Block-TCP-5432'"))
        self.assertTrue(undo_cmds[2].endswith("Enable-NetFirewallRule -Name 'FPS-SMB-In-TCP','FPS-NB_Session-In-TCP'"))
        self.assertEqual(undo_cmds[-2:], ["netsh advfirewall set publicprofile state off",
                                          "netsh advfirewall set privateprofile state off"])
        self.assertEqual(self.pc.snapshot(), initial)
        self.assertTrue(all(e["undoneAt"] for e in self.read_journal()["fixes"]))

    def test_without_sim_nothing_changes(self):
        for answer in ("nao", "", "s", "yes", "SIM, talvez", "sim não"):
            code, payload, err = self.run_public("--corrigir", inputs=[answer] * 5)
            self.assertEqual(code, scanner.EXIT_OK)
            self.assertEqual(self.input.call_count, 5, answer)
            self.assertNotIn("fixes", payload)
        self.assertEqual(self.pc.changes, [])
        self.assertFalse(os.path.exists(self.journal))
        self.assertIn("Não aplicada", err)

    def test_lowercase_sim_is_accepted_like_the_home_consent(self):
        _code, payload, _err = self.run_public("--corrigir", inputs=["sim", "nao", "nao", "nao", "nao"])
        self.assertEqual([f["kind"] for f in payload["fixes"]], ["firewall_enabled"])
        self.assertEqual(len(self.pc.changes), 2)

    def test_only_the_confirmed_fix_is_applied(self):
        _code, payload, _err = self.run_public("--corrigir", inputs=["nao", "nao", "nao", "SIM", "nao"])
        self.assertEqual([f["kind"] for f in payload["fixes"]], ["rdp_disabled"])
        self.assertEqual([c[:2] for c in self.pc.changes], [["reg", "add"]])

    def test_without_admin_only_explains(self):
        self.admin.return_value = False
        code, payload, err = self.run_public("--corrigir")
        self.assertEqual(code, scanner.EXIT_OK)
        self.input.assert_not_called()
        self.assertEqual(self.pc.changes, [])
        self.assertIn("Executar como administrador", err)
        self.assertEqual(err.count("Pulada: precisa de administrador"), 5)
        self.assertNotIn("fixes", payload)

    def test_non_interactive_applies_nothing(self):
        self.interactive.return_value = False
        _code, payload, err = self.run_public("--corrigir")
        self.input.assert_not_called()
        self.assertEqual(self.pc.changes, [])
        self.assertIn("precisa de um terminal interativo", err)
        self.assertNotIn("fixes", payload)

    def test_end_of_input_stops(self):
        stack, out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=EOFError):
            scanner.run_public(parse_args("--mode", "public", "--json", "--corrigir"))
        self.assertEqual(self.pc.changes, [])
        self.assertIn("Entrada encerrada", err.getvalue())

    def test_simular_applies_nothing(self):
        for flags in (("--simular",), ("--corrigir", "--simular")):
            code, payload, err = self.run_public(*flags)
            self.assertEqual(code, scanner.EXIT_OK)
            self.input.assert_not_called()
            self.assertIn("NADA foi aplicado", err)
            self.assertEqual(err.count("Comando exato:"), 5)
            self.assertNotIn("fixes", payload)
        self.assertEqual(self.pc.changes, [])
        self.assertFalse(os.path.exists(self.journal))
        # Planning only read the system (reg query is read only).
        for cmd in self.pc.reads:
            joined = " ".join(cmd)
            self.assertNotIn("reg add", joined)
            for verb in ("Set-", "New-", "Disable-", "Enable-", "Remove-"):
                self.assertNotIn(verb, joined)

    def test_failed_step_rolls_back(self):
        original = self.pc.run_change_cmd

        def flaky(cmd, timeout=None):
            if cmd[:4] == ["netsh", "advfirewall", "set", "publicprofile"]:
                self.pc.changes.append(list(cmd))
                return 1, "A operação requer elevação."
            return original(cmd, timeout)

        scanner.run_change_cmd.side_effect = flaky
        _code, payload, err = self.run_public("--corrigir", inputs=["SIM", "nao", "nao", "nao", "nao"])
        self.assertEqual([" ".join(c) for c in self.pc.changes], [
            "netsh advfirewall set privateprofile state on",
            "netsh advfirewall set publicprofile state on",
            "netsh advfirewall set privateprofile state off",  # rollback
        ])
        self.assertIn("requer elevação", err)
        self.assertIn("nada ficou alterado", err)
        self.assertNotIn("fixes", payload)
        self.assertFalse(os.path.exists(self.journal))

    def test_failed_rollback_is_kept_in_the_journal(self):
        def broken(cmd, timeout=None):
            self.pc.changes.append(list(cmd))
            ok = cmd == ["netsh", "advfirewall", "set", "privateprofile", "state", "on"]
            return (0, "Ok.") if ok else (1, "falhou")

        scanner.run_change_cmd.side_effect = broken
        _code, payload, err = self.run_public("--corrigir", inputs=["SIM", "nao", "nao", "nao", "nao"])
        self.assertNotIn("fixes", payload)
        entries = self.read_journal()["fixes"]
        self.assertEqual(len(entries), 1)
        self.assertTrue(entries[0]["title"].endswith("(parcial)"))
        self.assertEqual(entries[0]["undo"], [
            {"action": "firewall_set", "os": "windows", "profile": "private", "state": "off"}])
        self.assertIn("parte da correção ficou aplicada", err)

    def test_unreadable_journal_blocks_fixes(self):
        os.makedirs(os.path.dirname(self.journal))
        with open(self.journal, "w", encoding="utf-8") as handle:
            handle.write("{corrompido")
        _code, payload, err = self.run_public("--corrigir", inputs=["SIM"] * 5)
        self.input.assert_not_called()
        self.assertEqual(self.pc.changes, [])
        self.assertIn("nenhuma correção será aplicada", err)
        self.assertNotIn("fixes", payload)

    def test_journal_write_failure_shows_manual_undo(self):
        with mock.patch.object(scanner, "save_journal", side_effect=scanner.JournalError("disco cheio.")):
            _code, payload, err = self.run_public("--corrigir", inputs=["nao", "nao", "nao", "SIM", "nao"])
        self.assertEqual([f["kind"] for f in payload["fixes"]], ["rdp_disabled"])
        self.assertIn("Aplicada, mas disco cheio.", err)
        self.assertIn("/v fDenyTSConnections /t REG_DWORD /d 0 /f", err)

    def test_summary_mentions_fixes_and_undo(self):
        stack, out, _err = captured()
        with stack, mock.patch("builtins.input", side_effect=["SIM"] + ["nao"] * 4):
            scanner.run_public(parse_args("--mode", "public", "--corrigir"))
        summary = out.getvalue()
        self.assertIn("Correções aplicadas nesta execução, com a sua confirmação: 1", summary)
        self.assertIn("Firewall ativado nos perfis Privado e Público (este computador)", summary)
        self.assertIn("python scanner.py --desfazer", summary)


class NoApplyAllTests(unittest.TestCase):
    def test_there_is_no_flag_to_apply_everything(self):
        parser = scanner.build_arg_parser()
        options = {opt for action in parser._actions for opt in action.option_strings}
        for forbidden in ("--sim", "--yes", "-y", "--todas", "--aplicar-tudo", "--force", "--all",
                          "--corrigir-tudo", "--sem-confirmacao"):
            self.assertNotIn(forbidden, options)
        corrigir = [a for a in parser._actions if "--corrigir" in a.option_strings][0]
        self.assertEqual(corrigir.nargs, 0)  # a switch: takes no list of fixes

    def test_cli_rules(self):
        guards = [mock.patch.object(scanner, name, side_effect=AssertionError(name))
                  for name in ("run_public", "run_home", "run_undo")]
        with contextlib.ExitStack() as stack:
            for guard in guards:
                stack.enter_context(guard)
            for argv in ([], ["--desfazer", "--corrigir"], ["--mode", "public", "--corrigir", "--sim"],
                         ["--mode", "public", "--corr"], ["--mode", "home", "--confirmo"]):
                with captured()[0], self.assertRaises(SystemExit, msg=argv):
                    scanner.main(argv)


# ---------------------------------------------------------------------------
# --desfazer
# ---------------------------------------------------------------------------

def entry(kind, title, undo, target="computer", applied="2026-11-26T12:00:00Z", os_name="windows"):
    return {"id": f"id-{kind}", "kind": kind, "target": target, "title": title, "findingKind": None,
            "appliedAt": applied, "os": os_name, "hostname": "pc", "changed": "...", "commands": [],
            "undo": undo, "undoneAt": None}


class UndoTests(SafeTestCase):
    def setUp(self):
        super().setUp()
        self.changes = []
        self.result = (0, "")
        mock.patch.object(scanner, "run_change_cmd", side_effect=self.fake_change).start()
        mock.patch.object(scanner, "detect_os", return_value="windows").start()
        self.admin = mock.patch.object(scanner, "is_admin", return_value=True).start()
        self.interactive = mock.patch.object(scanner, "_stdin_is_interactive", return_value=True).start()
        self.write_journal([
            entry("firewall_enabled", "Firewall ativado no perfil Público",
                  [{"action": "firewall_set", "os": "windows", "profile": "public", "state": "off"}],
                  applied="2026-11-26T12:00:00Z"),
            entry("port_blocked", "Porta 5432 bloqueada no firewall",
                  [{"action": "port_block", "port": 5432, "present": False}], applied="2026-11-26T12:05:00Z"),
        ])

    def fake_change(self, cmd, timeout=None):
        self.changes.append(" ".join(cmd))
        return self.result

    def undo(self, *inputs, flags=()):
        stack, _out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=list(inputs)) as fake_input:
            code = scanner.run_undo(parse_args("--desfazer", *flags))
        self.input = fake_input
        return code, err.getvalue()

    def test_lists_newest_first_and_undoes_the_chosen_one(self):
        code, err = self.undo("1", "SIM")
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertLess(err.index("Porta 5432"), err.index("Firewall ativado"))
        self.assertIn("26/11/2026 12:05 UTC", err)
        self.assertEqual(len(self.changes), 1)
        self.assertTrue(self.changes[0].endswith("Remove-NetFirewallRule -Name 'Olharium-Block-TCP-5432'"))
        entries = {e["kind"]: e for e in self.read_journal()["fixes"]}
        self.assertRegex(entries["port_blocked"]["undoneAt"], ISO_RE)
        self.assertIsNone(entries["firewall_enabled"]["undoneAt"])
        # Already undone fixes are not offered again.
        code, err = self.undo("1", "SIM")
        self.assertEqual(self.changes[-1], "netsh advfirewall set publicprofile state off")
        code, err = self.undo()
        self.assertIn("Nenhuma correção para desfazer", err)

    def test_todas_undoes_all_newest_first(self):
        code, err = self.undo("todas", "SIM")
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertEqual(len(self.changes), 2)
        self.assertIn("Remove-NetFirewallRule", self.changes[0])
        self.assertEqual(self.changes[1], "netsh advfirewall set publicprofile state off")
        self.assertIn("Desfazer estas 2 correções? Digite SIM", err)

    def test_needs_sim(self):
        for answers in (("1", "nao"), ("TODAS", ""), ("1", "yes")):
            code, _err = self.undo(*answers)
            self.assertEqual(code, scanner.EXIT_REFUSED)
        code, err = self.undo("")  # Enter: leave
        self.assertEqual(code, scanner.EXIT_OK)
        code, err = self.undo("9")  # not in the list
        self.assertEqual(code, scanner.EXIT_REFUSED)
        self.assertEqual(self.changes, [])
        self.assertTrue(all(e["undoneAt"] is None for e in self.read_journal()["fixes"]))

    def test_needs_admin_for_the_computer(self):
        self.admin.return_value = False
        code, err = self.undo("TODAS", "SIM")
        self.assertEqual(code, scanner.EXIT_FIX_FAILED)
        self.assertEqual(self.changes, [])
        self.assertIn("Executar como administrador", err)

    def test_non_interactive_refuses(self):
        self.interactive.return_value = False
        code, err = self.undo()
        self.assertEqual(code, scanner.EXIT_REFUSED)
        self.input.assert_not_called()
        self.assertEqual(self.changes, [])

    def test_simular_only_lists(self):
        code, err = self.undo(flags=("--simular",))
        self.assertEqual(code, scanner.EXIT_OK)
        self.input.assert_not_called()
        self.assertEqual(self.changes, [])
        self.assertIn("Remove-NetFirewallRule -Name 'Olharium-Block-TCP-5432'", err)

    def test_tampered_journal_is_never_executed(self):
        self.write_journal([entry("smb_public_rules_disabled", "Compartilhamento",
                                  [{"action": "firewall_rules", "names": ["x'; Remove-Item C:\\ -Recurse; '"],
                                    "enabled": True}]),
                            entry("evil", "Comando livre", [{"action": "shell", "cmd": "whoami"}]),
                            entry("evil2", "Texto", ["netsh advfirewall set allprofiles state off"])])
        code, err = self.undo("TODAS", "SIM")
        self.assertEqual(code, scanner.EXIT_FIX_FAILED)
        self.assertEqual(self.changes, [])
        self.assertIn("passo recusado", err)
        self.assertTrue(all(e["undoneAt"] is None for e in self.read_journal()["fixes"]))

    def test_partial_undo_keeps_what_is_still_applied(self):
        steps = [{"action": "firewall_set", "os": "windows", "profile": "private", "state": "off"},
                 {"action": "firewall_set", "os": "windows", "profile": "public", "state": "off"}]
        self.write_journal([entry("firewall_enabled", "Firewall", steps)])

        def second_fails(cmd, timeout=None):
            self.changes.append(" ".join(cmd))
            return (0, "Ok.") if "publicprofile" in cmd[3] else (1, "Acesso negado")

        scanner.run_change_cmd.side_effect = second_fails
        code, _err = self.undo("1", "SIM")
        self.assertEqual(code, scanner.EXIT_FIX_FAILED)
        saved = self.read_journal()["fixes"][0]
        self.assertIsNone(saved["undoneAt"])
        self.assertEqual(saved["undo"], steps[:1])  # public already off: only private remains

    def test_fix_from_another_os_is_not_undone(self):
        self.write_journal([entry("firewall_enabled", "Firewall do macOS ativado",
                                  [{"action": "firewall_set", "os": "macos", "state": "off"}], os_name="macos")])
        code, err = self.undo("1", "SIM")
        self.assertEqual(code, scanner.EXIT_FIX_FAILED)
        self.assertEqual(self.changes, [])

    def test_corrupt_journal_is_reported(self):
        with open(self.journal, "w", encoding="utf-8") as handle:
            handle.write("[]")
        code, err = self.undo()
        self.assertEqual(code, scanner.EXIT_REFUSED)
        self.assertIn("formato desconhecido", err)

    def test_cli_desfazer_without_mode(self):
        os.remove(self.journal)
        stack, _out, err = captured()
        with stack:
            code = scanner.main(["--desfazer"])
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertIn("Nenhuma correção para desfazer", err.getvalue())


# ---------------------------------------------------------------------------
# Journal and administrator detection
# ---------------------------------------------------------------------------

class JournalAndAdminTests(SafeTestCase):
    def test_journal_location(self):
        with mock.patch.object(scanner, "detect_os", return_value="windows"), \
                mock.patch.dict(os.environ, {"LOCALAPPDATA": os.path.join("C:", os.sep, "Users", "ana", "AppData", "Local")}):
            path = REAL_JOURNAL_PATH()
        self.assertTrue(path.endswith(os.path.join("Local", "Olharium", "fixes.json")), path)
        with mock.patch.object(scanner, "detect_os", return_value="linux"):
            self.assertEqual(REAL_JOURNAL_PATH(), os.path.join(os.path.expanduser("~"), ".olharium", "fixes.json"))

    def test_journal_roundtrip(self):
        self.assertEqual(scanner.load_journal(self.journal), {"version": 1, "fixes": []})
        scanner.record_fix({"id": "x", "kind": "firewall_enabled"})
        scanner.record_fix({"id": "y", "kind": "rdp_disabled"})
        self.assertEqual([e["id"] for e in scanner.load_journal(self.journal)["fixes"]], ["x", "y"])
        with open(self.journal, "w", encoding="utf-8") as handle:
            handle.write("não é json")
        with self.assertRaises(scanner.JournalError):
            scanner.load_journal(self.journal)

    def test_windows_admin_detection(self):
        import ctypes
        fake = mock.MagicMock()
        with mock.patch.object(ctypes, "windll", fake, create=True):
            fake.shell32.IsUserAnAdmin.return_value = 1
            self.assertTrue(scanner.is_admin("windows"))
            fake.shell32.IsUserAnAdmin.return_value = 0
            self.assertFalse(scanner.is_admin("windows"))
            fake.shell32.IsUserAnAdmin.side_effect = OSError
            self.assertFalse(scanner.is_admin("windows"))

    def test_unix_admin_detection(self):
        with mock.patch.object(scanner.os, "geteuid", create=True, return_value=0):
            self.assertTrue(scanner.is_admin("linux"))
        with mock.patch.object(scanner.os, "geteuid", create=True, return_value=1000):
            self.assertFalse(scanner.is_admin("macos"))

    def test_admin_help(self):
        self.assertIn("Executar como administrador", scanner.admin_help("windows"))
        self.assertIn("sudo", scanner.admin_help("linux"))


# ---------------------------------------------------------------------------
# Firewall-aware audit (Windows rule store)
# ---------------------------------------------------------------------------

RULES_OUTPUT = """OLHARIUM-FW-RULES
Olharium-Block-TCP-5432\tv2.33|Action=Block|Active=TRUE|Dir=In|Protocol=6|LPort=5432|Name=Olharium: bloqueio da porta 5432|
Olharium-Block-TCP-3000\tv2.33|Action=Block|Active=FALSE|Dir=In|Protocol=6|LPort=3000|Name=Olharium: bloqueio da porta 3000|
FPS-SMB-In-TCP\tv2.33|Action=Allow|Active=TRUE|Dir=In|Protocol=6|Profile=Private|Profile=Public|LPort=445|App=System|Name=@FirewallAPI.dll,-28511|EmbedCtxt=@FirewallAPI.dll,-28502|
FPS-SMB-In-TCP-NoScope\tv2.33|Action=Allow|Active=TRUE|Dir=In|Protocol=6|Profile=Domain|LPort=445|App=System|Name=@FirewallAPI.dll,-28511|EmbedCtxt=@FirewallAPI.dll,-28502|
FPS-NB_Session-In-TCP\tv2.33|Action=Allow|Active=FALSE|Dir=In|Protocol=6|Profile=Private|Profile=Public|LPort=139|App=System|Name=@FirewallAPI.dll,-28503|EmbedCtxt=@FirewallAPI.dll,-28502|
FPS-Custom-All\tv2.33|Action=Allow|Active=TRUE|Dir=In|Protocol=6|LPort=445|Name=Compartilhar tudo|EmbedCtxt=@FirewallAPI.dll,-28502|
FPS-SMB-Out-TCP\tv2.33|Action=Allow|Active=TRUE|Dir=Out|Protocol=6|Profile=Public|RPort=445|EmbedCtxt=@FirewallAPI.dll,-28502|
Regra estranha com espaços\tv2.33|Action=Allow|Active=TRUE|Dir=In|Profile=Public|LPort=445|EmbedCtxt=@FirewallAPI.dll,-28502|
"""


class FirewallRuleStoreTests(unittest.TestCase):
    def test_parse_rule_store(self):
        rules = scanner.parse_windows_firewall_rules(RULES_OUTPUT)
        self.assertTrue(rules.known)
        self.assertEqual(rules.blocked_ports, {5432})
        self.assertEqual(
            [(r["name"], r["profile"]) for r in rules.smb_public_rules],
            [("FPS-SMB-In-TCP", 6), ("FPS-Custom-All", 0)],
        )
        self.assertEqual(rules.smb_public_rules[0]["displayName"], "FPS-SMB-In-TCP (porta 445)")
        self.assertEqual(rules.smb_public_rules[1]["displayName"], "Compartilhar tudo (porta 445)")
        self.assertEqual(rules.smb_unreadable, 1)

    def test_unknown_output(self):
        for text in ("", None, '{"Name": "Rede", "NetworkCategory": 1}', "erro"):
            self.assertFalse(scanner.parse_windows_firewall_rules(text).known, text)

    def test_blocked_ports(self):
        on = scanner.FirewallStatus(True, [], "netsh")
        clean = scanner.WindowsFirewallRules(known=True, blocked_ports={5432})
        self.assertEqual(set(scanner.compute_blocked_ports(on, clean, {"public"})), {5432, 445, 139})
        self.assertEqual(set(scanner.compute_blocked_ports(on, clean, {"private"})), {5432})
        self.assertEqual(scanner.compute_blocked_ports(scanner.FirewallStatus(False, ["public"]), clean, {"public"}), {})
        smb_open = scanner.parse_windows_firewall_rules(RULES_OUTPUT)
        self.assertEqual(set(scanner.compute_blocked_ports(on, smb_open, {"public"})), {5432})
        self.assertEqual(scanner.compute_blocked_ports(on, scanner.WindowsFirewallRules(), {"public"}), {})

    def test_blocked_listener_becomes_info(self):
        listeners = [scanner.Listener("0.0.0.0", 5432, 9900, "postgres.exe"),
                     scanner.Listener("0.0.0.0", 445, 4, "System")]
        findings = scanner.build_listener_findings(listeners, True, {5432: "a regra X bloqueia"})
        by_port = {f["port"]: f for f in findings}
        self.assertEqual((by_port[5432]["kind"], by_port[5432]["severity"]), ("port_blocked_by_firewall", "info"))
        self.assertIn("a regra X bloqueia", by_port[5432]["detail"])
        self.assertEqual(by_port[445]["kind"], "exposed_smb")

    def test_connection_profile_with_interface(self):
        text = '{"Name": "CafeLivre", "InterfaceAlias": "Wi-Fi", "InterfaceIndex": 12, "NetworkCategory": 1}'
        self.assertEqual(scanner.parse_connection_profiles(text),
                         [{"name": "CafeLivre", "category": "private", "index": 12, "alias": "Wi-Fi"}])

    def test_reg_dword(self):
        self.assertEqual(scanner.parse_reg_dword("    fDenyTSConnections    REG_DWORD    0x1\n", "fDenyTSConnections"), 1)
        self.assertIsNone(scanner.parse_reg_dword("ERRO", "fDenyTSConnections"))


# ---------------------------------------------------------------------------
# UPnP: list, close and undo port mappings of the user's own router
# ---------------------------------------------------------------------------

IGD_XML = """<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
<deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType>
<serviceList><service><serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType>
<controlURL>/ctl/L3F</controlURL></service></serviceList>
<deviceList><device><deviceType>urn:schemas-upnp-org:device:WANDevice:1</deviceType>
<deviceList><device><deviceType>urn:schemas-upnp-org:device:WANConnectionDevice:1</deviceType>
<serviceList>
<service><serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType>
<serviceId>urn:upnp-org:serviceId:WANIPConn1</serviceId><controlURL>/ctl/IPConn</controlURL></service>
<service><serviceType>urn:schemas-upnp-org:service:WANPPPConnection:1</serviceType>
<controlURL>http://192.168.0.1:5000/ctl/PPPConn</controlURL></service>
</serviceList></device></deviceList></device></deviceList></device></root>
"""

TWO_MAPPINGS = [
    mapping(8080, 80, "192.168.0.30", description="Camera & app"),
    mapping(3389, 3389, "192.168.0.20", description="Remote Desktop", lease="3600"),
]


class UpnpTests(SafeTestCase):
    def setUp(self):
        super().setUp()
        self.network = ipaddress.IPv4Network("192.168.0.0/24")

    def router(self, mappings=TWO_MAPPINGS, **kwargs):
        fake = FakeRouter(mappings, **kwargs)
        scanner._soap_post.side_effect = fake
        return fake

    def test_parse_wan_services(self):
        services = scanner.parse_wan_services(IGD_XML, LOCATION)
        self.assertEqual(services, [
            {"serviceType": WANIP1, "controlURL": "http://192.168.0.1:5000/ctl/IPConn"},
            {"serviceType": "urn:schemas-upnp-org:service:WANPPPConnection:1",
             "controlURL": "http://192.168.0.1:5000/ctl/PPPConn"},
        ])
        with_base = IGD_XML.replace("<root xmlns=\"urn:schemas-upnp-org:device-1-0\">",
                                    "<root><URLBase>http://192.168.0.1:49000/</URLBase>")
        self.assertEqual(scanner.parse_wan_services(with_base, LOCATION)[0]["controlURL"],
                         "http://192.168.0.1:49000/ctl/IPConn")

    def test_igd_services_stay_inside_the_network_and_on_the_gateway(self):
        descriptions = {
            LOCATION: {"wanServices": [{"serviceType": WANIP1, "controlURL": CONTROL_URL}]},
            "http://192.168.0.50:1900/d.xml": {"wanServices": [{"serviceType": WANIP1,
                                                                 "controlURL": "http://192.168.0.50:1900/ctl"}]},
            "http://192.168.0.60/d.xml": {"wanServices": [{"serviceType": WANIP1,
                                                            "controlURL": "http://8.8.8.8/ctl"}]},
            "http://192.168.0.70/d.xml": {"manufacturer": "TV"},
        }
        services = scanner.igd_services(descriptions, self.network, "192.168.0.1")
        self.assertEqual(services, [{"routerIp": "192.168.0.1", "serviceType": WANIP1, "controlURL": CONTROL_URL}])
        no_gateway = scanner.igd_services(descriptions, self.network, None)
        self.assertEqual({s["routerIp"] for s in no_gateway}, {"192.168.0.1", "192.168.0.50"})
        # Gateway known but not an IGD: another device announcing an IGD is not "the router".
        self.assertEqual(scanner.igd_services(descriptions, self.network, "192.168.0.254"), [])

    def test_list_mappings_until_the_router_says_stop(self):
        fake = self.router()
        scanner._authorize_probes(self.network)
        service = {"routerIp": "192.168.0.1", "serviceType": WANIP1, "controlURL": CONTROL_URL}
        mappings = scanner.list_all_port_mappings([service], float("inf"))
        self.assertEqual(fake.actions(), ["GetGenericPortMappingEntry"] * 3)  # index 0, 1, then error
        self.assertEqual([c[2]["NewPortMappingIndex"] for c in fake.calls], ["0", "1", "2"])
        self.assertEqual({c[0] for c in fake.calls}, {CONTROL_URL})
        self.assertEqual([(m["externalPort"], m["protocol"], m["internalClient"], m["internalPort"]) for m in mappings],
                         [(8080, "TCP", "192.168.0.30", 80), (3389, "TCP", "192.168.0.20", 3389)])
        self.assertEqual(mappings[0]["description"], "Camera & app")
        self.assertEqual(mappings[1]["leaseDuration"], 3600)

    def test_listing_is_capped(self):
        fake = self.router([mapping(10000 + i, 80) for i in range(200)])
        scanner._authorize_probes(self.network)
        service = {"routerIp": "192.168.0.1", "serviceType": WANIP1, "controlURL": CONTROL_URL}
        self.assertEqual(len(scanner.list_port_mappings(service, float("inf"))), scanner.MAX_UPNP_MAPPINGS)
        self.assertEqual(len(fake.calls), scanner.MAX_UPNP_MAPPINGS)

    def test_mapping_findings(self):
        scanner._authorize_probes(self.network)
        self.router([
            mapping(3389, 3389, description="Remote Desktop"),
            mapping(2222, 22, "192.168.0.40"),          # sensitive internal port
            mapping(8080, 80, "192.168.0.30", "UDP"),
            mapping(7000, 7000, enabled="0"),
        ])
        service = {"routerIp": "192.168.0.1", "serviceType": WANIP1, "controlURL": CONTROL_URL}
        findings = scanner.build_upnp_mapping_findings(scanner.list_port_mappings(service, float("inf")))
        self.assertEqual([(f["kind"], f["port"], f["severity"]) for f in findings], [
            ("upnp_port_mapping", 3389, "high"), ("upnp_port_mapping", 2222, "high"),
            ("upnp_port_mapping", 8080, "medium"), ("upnp_port_mapping", 7000, "low"),
        ])
        first = findings[0]
        self.assertEqual(first["deviceIp"], "192.168.0.1")
        self.assertEqual(first["title"], "Porta 3389/TCP aberta para a Internet pelo UPnP")
        for text in ("3389/TCP", "192.168.0.20:3389", "Remote Desktop", "(rdp)"):
            self.assertIn(text, first["detail"])
        self.assertIn("8080/UDP", findings[2]["detail"])
        for port in (23, 22, 3389, 445, 139, 5900, 1883, 3306, 5432, 6379, 27017, 7547):
            self.assertIn(port, scanner.UPNP_SENSITIVE_PORTS)

    def test_soap_refuses_without_consent(self):
        with self.assertRaises(scanner.ProbeNotAuthorized):
            scanner.upnp_soap_call(CONTROL_URL, WANIP1, "GetGenericPortMappingEntry", [("NewPortMappingIndex", "0")])
        scanner._soap_post.assert_not_called()

    def test_soap_refuses_other_actions_and_other_hosts(self):
        scanner._authorize_probes(self.network)
        for action in ("ForceTermination", "SetConnectionType", "AddAnyPortMapping", "DeletePortMappingRange",
                       "GetExternalIPAddress", "RequestConnection"):
            with self.assertRaises(scanner.ProbeNotAuthorized, msg=action):
                scanner.upnp_soap_call(CONTROL_URL, WANIP1, action, [])
        for url in ("http://192.168.1.1:5000/ctl", "http://8.8.8.8/ctl", "https://192.168.0.1/ctl",
                    "http://router.local/ctl"):
            with self.assertRaises(scanner.ProbeNotAuthorized, msg=url):
                scanner.upnp_soap_call(url, WANIP1, "GetGenericPortMappingEntry", [])
        with self.assertRaises(scanner.ProbeNotAuthorized):
            scanner.upnp_soap_call(CONTROL_URL, "urn:schemas-upnp-org:service:Layer3Forwarding:1",
                                   "GetGenericPortMappingEntry", [])
        scanner._soap_post.assert_not_called()

    def test_soap_request_shape(self):
        scanner._authorize_probes(self.network)
        captured_call = {}

        def fake(url, headers, body, timeout):
            captured_call.update(url=url, headers=headers, body=body.decode(), timeout=timeout)
            return 200, ""

        scanner._soap_post.side_effect = fake
        scanner._execute_upnp({"action": "upnp_add", "controlURL": CONTROL_URL, "serviceType": WANIP1,
                               "remoteHost": "", "externalPort": 8080, "protocol": "TCP", "internalPort": 80,
                               "internalClient": "192.168.0.30", "enabled": True,
                               "description": "Câmera <&> app", "leaseDuration": 0})
        self.assertEqual(captured_call["url"], CONTROL_URL)
        self.assertEqual(captured_call["headers"]["SOAPAction"], f'"{WANIP1}#AddPortMapping"')
        self.assertIn("text/xml", captured_call["headers"]["Content-Type"])
        self.assertIn("<NewPortMappingDescription>Câmera &lt;&amp;&gt; app</NewPortMappingDescription>",
                      captured_call["body"])
        self.assertLessEqual(captured_call["timeout"], 5)
        order = re.findall(r"<(New\w+)>", captured_call["body"])
        self.assertEqual(order, ["NewRemoteHost", "NewExternalPort", "NewProtocol", "NewInternalPort",
                                 "NewInternalClient", "NewEnabled", "NewPortMappingDescription", "NewLeaseDuration"])

    def test_plans_close_one_mapping_each(self):
        scanner._authorize_probes(self.network)
        self.router()
        service = {"routerIp": "192.168.0.1", "serviceType": WANIP1, "controlURL": CONTROL_URL}
        plans = scanner.plan_router_fixes(scanner.list_port_mappings(service, float("inf")))
        self.assertEqual([(p.kind, p.target, p.needs_admin) for p in plans],
                         [("upnp_mapping_removed", "router", False)] * 2)
        self.assertIn("3389/TCP", plans[0].label)  # sensitive first
        do, undo = plans[0].steps[0]
        self.assertEqual(do["action"], "upnp_delete")
        self.assertEqual((undo["action"], undo["internalClient"], undo["internalPort"], undo["leaseDuration"]),
                         ("upnp_add", "192.168.0.20", 3389, 3600))
        self.assertIn("DeletePortMapping", scanner.format_plan(plans[0], 1, 2))
        self.assertIn("AddPortMapping", scanner.format_plan(plans[0], 1, 2))


class HomeFixFlowTests(SafeTestCase):
    """--mode home --corrigir with every network function mocked."""

    def setUp(self):
        super().setUp()
        self.fake = FakeRouter(TWO_MAPPINGS)
        scanner._soap_post.side_effect = self.fake
        for name, value in {
            "detect_network": scanner.NetworkInfo("192.168.0.10", 24, "192.168.0.1"),
            "probe_hosts": ({"192.168.0.1": {80, 5000}}, {"192.168.0.1"}),
            "enrich_services": {},
            "ssdp_discover": {"192.168.0.1": {"server": "Linux UPnP/1.0 MiniUPnPd/2.1",
                                              "locations": [LOCATION], "igd": True}},
            "fetch_descriptions": {LOCATION: {"manufacturer": "ACME", "modelName": "R1", "modelNumber": None,
                                              "deviceType": None,
                                              "wanServices": [{"serviceType": WANIP1, "controlURL": CONTROL_URL}]}},
            "read_arp_table": [],
            "get_wifi_security": "WPA2-Personal",
            "get_hostname": "notebook-01",
            "detect_os": "windows",
        }.items():
            mock.patch.object(scanner, name, return_value=value).start()
        self.admin = mock.patch.object(scanner, "is_admin", return_value=False).start()
        self.change = mock.patch.object(scanner, "run_change_cmd", side_effect=AssertionError("comando")).start()
        self.interactive = mock.patch.object(scanner, "_stdin_is_interactive", return_value=True).start()

    def run_home(self, *flags, inputs=()):
        stack, out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=list(inputs)) as fake_input:
            code = scanner.run_home(parse_args("--mode", "home", "--json", *flags))
        self.input = fake_input
        self.assertIsNone(scanner._probe_scope)  # authorization always revoked
        return code, json.loads(out.getvalue()) if out.getvalue() else None, err.getvalue()

    def test_audit_lists_mappings_and_changes_nothing(self):
        code, payload, _err = self.run_home("--confirmo-rede-propria")
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertEqual(set(self.fake.actions()), {"GetGenericPortMappingEntry"})
        upnp = sorted((f["port"], f["severity"]) for f in payload["findings"] if f["kind"] == "upnp_port_mapping")
        self.assertEqual(upnp, [(3389, "high"), (8080, "medium")])
        self.assertNotIn("fixes", payload)
        self.input.assert_not_called()

    def test_no_consent_no_soap(self):
        code, payload, _err = self.run_home("--corrigir", inputs=["nao"])
        self.assertEqual(code, scanner.EXIT_REFUSED)
        self.assertEqual(self.fake.calls, [])

    def test_corrigir_closes_only_the_confirmed_mapping(self):
        # Consent (SIM), then one answer per mapping: 3389 first (sensitive), then 8080.
        code, payload, err = self.run_home("--corrigir", inputs=["SIM", "SIM", "nao"])
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertEqual(self.input.call_count, 3)
        self.assertIn("SEU roteador", err)
        deletes = [args for _url, action, args in self.fake.calls if action == "DeletePortMapping"]
        self.assertEqual(deletes, [{"NewRemoteHost": "", "NewExternalPort": "3389", "NewProtocol": "TCP"}])
        self.assertTrue(set(self.fake.actions()) <= scanner.UPNP_ALLOWED_ACTIONS)
        self.assertNotIn("AddPortMapping", self.fake.actions())
        self.admin.assert_not_called()  # router fixes never need administrator
        self.change.assert_not_called()  # nothing on this computer
        # The mapping list was read again after the fix.
        upnp = [f["port"] for f in payload["findings"] if f["kind"] == "upnp_port_mapping"]
        self.assertEqual(upnp, [8080])
        self.assertEqual(payload["fixes"], [{
            "kind": "upnp_mapping_removed", "target": "router",
            "title": "Porta 3389/TCP fechada no roteador (mapeamento UPnP removido)",
            "appliedAt": payload["fixes"][0]["appliedAt"], "findingKind": "upnp_port_mapping",
        }])
        saved = self.read_journal()["fixes"][0]
        self.assertEqual(saved["target"], "router")
        self.assertEqual(saved["undo"][0]["action"], "upnp_add")
        self.assertEqual(saved["undo"][0]["description"], "Remote Desktop")

    def test_router_refusal_is_reported(self):
        self.fake.refuse_delete = True
        _code, payload, err = self.run_home("--corrigir", inputs=["SIM", "SIM", "SIM"])
        self.assertNotIn("fixes", payload)
        self.assertIn("606", err)
        self.assertFalse(os.path.exists(self.journal))

    def test_simular_sends_only_reads(self):
        _code, payload, err = self.run_home("--confirmo-rede-propria", "--simular")
        self.assertEqual(set(self.fake.actions()), {"GetGenericPortMappingEntry"})
        self.assertIn("NADA foi aplicado", err)
        self.assertEqual(err.count("UPnP DeletePortMapping em"), 2)
        self.input.assert_not_called()

    def test_undo_recreates_the_mapping(self):
        self.run_home("--corrigir", inputs=["SIM", "SIM", "nao"])
        self.assertEqual(len(self.fake.mappings), 1)
        stack, _out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=["1", "SIM"]):
            code = scanner.run_undo(parse_args("--desfazer"))
        self.assertEqual(code, scanner.EXIT_OK, err.getvalue())
        self.assertIsNone(scanner._probe_scope)
        add = [args for _url, action, args in self.fake.calls if action == "AddPortMapping"]
        self.assertEqual(add, [{
            "NewRemoteHost": "", "NewExternalPort": "3389", "NewProtocol": "TCP", "NewInternalPort": "3389",
            "NewInternalClient": "192.168.0.20", "NewEnabled": "1",
            "NewPortMappingDescription": "Remote Desktop", "NewLeaseDuration": "3600",
        }])
        self.assertEqual(len(self.fake.mappings), 2)
        self.assertTrue(self.read_journal()["fixes"][0]["undoneAt"])

    def test_undo_retries_with_permanent_lease(self):
        self.run_home("--corrigir", inputs=["SIM", "SIM", "nao"])
        self.fake.permanent_only = True
        stack, _out, _err = captured()
        with stack, mock.patch("builtins.input", side_effect=["1", "SIM"]):
            code = scanner.run_undo(parse_args("--desfazer"))
        self.assertEqual(code, scanner.EXIT_OK)
        leases = [args["NewLeaseDuration"] for _u, action, args in self.fake.calls if action == "AddPortMapping"]
        self.assertEqual(leases, ["3600", "0"])

    def test_undo_on_another_network_is_refused(self):
        self.run_home("--corrigir", inputs=["SIM", "SIM", "nao"])
        calls_before = len(self.fake.calls)
        scanner.detect_network.return_value = scanner.NetworkInfo("10.0.0.5", 24, "10.0.0.1")
        stack, _out, err = captured()
        with stack, mock.patch("builtins.input", side_effect=["1", "SIM"]):
            code = scanner.run_undo(parse_args("--desfazer"))
        self.assertEqual(code, scanner.EXIT_FIX_FAILED)
        self.assertEqual(len(self.fake.calls), calls_before)
        self.assertIn("não está na rede atual", err.getvalue())
        self.assertIsNone(self.read_journal()["fixes"][0]["undoneAt"])
        for refused in (scanner.NetworkInfo("100.64.0.5", 24, None), scanner.NetworkInfo("8.8.8.8", 24, None),
                        scanner.NetworkInfo("192.168.0.10", 24, "192.168.0.254")):  # same range, other gateway
            scanner.detect_network.return_value = refused
            with captured()[0], mock.patch("builtins.input", side_effect=["1", "SIM"]):
                self.assertEqual(scanner.run_undo(parse_args("--desfazer")), scanner.EXIT_FIX_FAILED)
        self.assertEqual(len(self.fake.calls), calls_before)


# ---------------------------------------------------------------------------
# Low-level primitives (with the process and HTTP layers mocked)
# ---------------------------------------------------------------------------

class PrimitiveTests(unittest.TestCase):
    def test_run_change_cmd(self):
        done = scanner.subprocess.CompletedProcess(["x"], 0, b"Ok.\r\n", b"")
        with mock.patch.object(scanner.subprocess, "run", return_value=done) as run:
            self.assertEqual(scanner.run_change_cmd(["netsh", "advfirewall", "set", "publicprofile", "state", "on"]),
                             (0, "Ok."))
        kwargs = run.call_args.kwargs
        self.assertIs(kwargs["stdin"], scanner.subprocess.DEVNULL)
        self.assertEqual(kwargs["timeout"], scanner.FIX_CMD_TIMEOUT)
        self.assertFalse(kwargs.get("shell", False))
        with mock.patch.object(scanner.subprocess, "run", side_effect=FileNotFoundError("netsh")):
            code, output = scanner.run_change_cmd(["netsh"])
        self.assertIsNone(code)
        self.assertIn("netsh", output)

    def test_soap_post_uses_no_proxy_and_no_redirects(self):
        class FakeResponse:
            status = 200

            def read(self, n=-1):
                return b"<ok/>"

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        opener = mock.MagicMock()
        opener.open.return_value = FakeResponse()
        with mock.patch.object(scanner.urllib.request, "build_opener", return_value=opener) as build:
            status, body = scanner._soap_post(CONTROL_URL, {"SOAPAction": "x"}, b"<x/>", 3.0)
        self.assertEqual((status, body), (200, "<ok/>"))
        handlers = build.call_args.args
        self.assertTrue(any(isinstance(h, scanner.urllib.request.ProxyHandler) and h.proxies == {} for h in handlers))
        self.assertTrue(any(isinstance(h, scanner._NoRedirect) for h in handlers))
        request = opener.open.call_args.args[0]
        self.assertEqual((request.full_url, request.get_method()), (CONTROL_URL, "POST"))

        error = scanner.urllib.error.HTTPError(CONTROL_URL, 500, "err", {}, io.BytesIO(soap_error(713)[1].encode()))
        opener.open.side_effect = error
        with mock.patch.object(scanner.urllib.request, "build_opener", return_value=opener):
            status, body = scanner._soap_post(CONTROL_URL, {}, b"", 3.0)
        self.assertEqual(status, 500)
        self.assertEqual(scanner._xml_tag(body, "errorCode"), "713")
        opener.open.side_effect = OSError("sem rota")
        with mock.patch.object(scanner.urllib.request, "build_opener", return_value=opener):
            self.assertEqual(scanner._soap_post(CONTROL_URL, {}, b"", 3.0), (None, "sem rota"))
        self.assertIn("não respondeu", scanner._upnp_error_text(None, "sem rota"))

    def test_description_fetch_reads_wan_services(self):
        scanner._authorize_probes(ipaddress.IPv4Network("192.168.0.0/24"))
        self.addCleanup(scanner._revoke_probes)
        connection = mock.MagicMock()
        connection.getresponse.return_value.status = 200
        connection.getresponse.return_value.read.return_value = IGD_XML.encode()
        with mock.patch.object(scanner.http.client, "HTTPConnection", return_value=connection):
            description = scanner.fetch_device_description(LOCATION, ipaddress.IPv4Network("192.168.0.0/24"))
        self.assertEqual(description["wanServices"][0], {"serviceType": WANIP1, "controlURL": CONTROL_URL})


# ---------------------------------------------------------------------------
# Payload: the optional "fixes" field
# ---------------------------------------------------------------------------

class FixesPayloadTests(unittest.TestCase):
    def base(self, **overrides):
        payload = {
            "agentVersion": scanner.AGENT_VERSION, "mode": "public",
            "startedAt": "2026-11-26T12:00:00Z", "finishedAt": "2026-11-26T12:01:00Z",
            "host": {"os": "windows", "hostname": "pc"},
            "network": {"localIp": "192.168.0.8", "cidr": "192.168.0.0/24", "gateway": "192.168.0.1",
                        "isPrivate": True, "wifiSecurity": None},
            "devices": [], "findings": [],
        }
        payload.update(overrides)
        return payload

    def test_contract_example(self):
        fix = {"kind": "firewall_enabled", "target": "computer",
               "title": "Firewall ativado nos perfis Público e Particular",
               "appliedAt": "2026-11-26T12:00:00Z", "findingKind": "firewall_disabled"}
        result = scanner.sanitize_payload(self.base(fixes=[fix]))
        self.assertEqual(list(result)[-1], "fixes")
        self.assertEqual(result["fixes"], [fix])
        json.dumps(result)

    def test_omitted_when_empty(self):
        self.assertNotIn("fixes", scanner.sanitize_payload(self.base()))
        self.assertNotIn("fixes", scanner.sanitize_payload(self.base(fixes=[])))

    def test_limits_and_formats(self):
        fixes = [{"kind": "Port Blocked!!" + "x" * 100, "target": "computer", "title": "t" * 500,
                  "appliedAt": "ontem", "findingKind": "Exposed-DB"},
                 {"kind": "x", "target": "other-device", "title": "t", "appliedAt": "2026-11-26T12:00:00Z"},
                 {"kind": "upnp_mapping_removed", "target": "router", "title": "t", "appliedAt": "2026-11-26T12:00:00Z",
                  "findingKind": None},
                 "lixo"]
        result = scanner.sanitize_payload(self.base(fixes=fixes))["fixes"]
        self.assertEqual(len(result), 2)  # unknown target and junk dropped
        first, second = result
        self.assertRegex(first["kind"], r"^[a-z0-9_]+$")
        self.assertLessEqual(len(first["kind"]), 64)
        self.assertEqual(len(first["title"]), 200)
        self.assertRegex(first["appliedAt"], ISO_RE)
        self.assertEqual(first["findingKind"], "exposed_db")
        self.assertNotIn("findingKind", second)
        many = [{"kind": "port_blocked", "target": "computer", "title": "t", "appliedAt": "2026-11-26T12:00:00Z"}] * 80
        self.assertEqual(len(scanner.sanitize_payload(self.base(fixes=many))["fixes"]), 50)


if __name__ == "__main__":
    unittest.main()
