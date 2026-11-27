"""Unit tests for the Olharium local agent.

Run from the package folder:
    python -I -m unittest discover -s tests

No test touches the real network: home mode is exercised only with mocks.
"""

from __future__ import annotations

import contextlib
import io
import ipaddress
import json
import os
import socket
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import scanner  # noqa: E402


def quiet():
    """Silence stdout/stderr produced by the CLI flows."""
    stack = contextlib.ExitStack()
    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
    stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
    return stack


# ---------------------------------------------------------------------------
# Sample outputs
# ---------------------------------------------------------------------------

NETSTAT_TCP_PT = """
Conexões ativas

  Proto  Endereço local         Endereço externo       Estado           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1792
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
  TCP    0.0.0.0:5432           0.0.0.0:0              LISTENING       9900
  TCP    127.0.0.1:5939         0.0.0.0:0              LISTENING       4321
  TCP    192.168.3.8:139        0.0.0.0:0              LISTENING       4
  TCP    192.168.3.8:51000      142.250.0.1:443        ESTABLISHED     1200
  TCP    192.168.3.8:51001      142.250.0.1:80         TIME_WAIT       0
"""

NETSTAT_TCPV6 = """
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    [::]:445               [::]:0                 LISTENING       4
  TCP    [::]:3389              [::]:0                 ABHÖREN         1100
  TCP    [::1]:5432             [::]:0                 LISTENING       9900
  TCP    [fe80::1%3]:2869       [::]:0                 LISTENING       4
"""

SS_OUTPUT = """\
LISTEN 0      4096   127.0.0.53%lo:53        0.0.0.0:*
LISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=812,fd=3))
LISTEN 0      128             [::]:22           [::]:*
LISTEN 0      511                *:80              *:*
LISTEN 0      4096       127.0.0.1:631       0.0.0.0:*
LISTEN 0      4096           [::1]:631          [::]:*
LISTEN 0      244     [::ffff:127.0.0.1]:5173  *:*
"""

SS_WITH_HEADER = """\
State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN 0      511        0.0.0.0:5173      0.0.0.0:*
"""

LSOF_OUTPUT = """\
COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
rapportd    512   user    4u  IPv4 0x1234567890      0t0  TCP *:49152 (LISTEN)
rapportd    512   user    5u  IPv6 0x1234567891      0t0  TCP *:49152 (LISTEN)
postgres    700   user    7u  IPv6 0x1234567892      0t0  TCP [::1]:5432 (LISTEN)
postgres    700   user    8u  IPv4 0x1234567893      0t0  TCP 127.0.0.1:5432 (LISTEN)
node        900   user   20u  IPv4 0x1234567894      0t0  TCP 192.168.1.10:3000 (LISTEN)
Screen\\x20Sharing 950 user 3u IPv4 0x1234567895 0t0 TCP *:5900 (LISTEN)
"""

BSD_NETSTAT = """\
Active Internet connections (including servers)
Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)
tcp4       0      0  *.22                   *.*                    LISTEN
tcp4       0      0  127.0.0.1.5432         *.*                    LISTEN
tcp6       0      0  ::1.5432               *.*                    LISTEN
tcp4       0      0  192.168.1.10.50000     17.0.0.1.443           ESTABLISHED
"""

NETSH_FW_PT = """
Perfil do Domínio Configurações:
----------------------------------------------------------------------
Estado                                Ligado

Perfil Particular Configurações:
----------------------------------------------------------------------
Estado                                Desligado

Perfil Público Configurações:
----------------------------------------------------------------------
Estado                                Ligado
Ok.
"""

NETSH_FW_EN_OFF = """
Domain Profile Settings:
----------------------------------------------------------------------
State                                 OFF

Private Profile Settings:
----------------------------------------------------------------------
State                                 OFF

Public Profile Settings:
----------------------------------------------------------------------
State                                 OFF
Ok.
"""

NETSH_WLAN_PT = """
Há 1 interface no sistema:

    Nome                   : Wi-Fi
    Descrição              : Intel(R) Wi-Fi 6 AX203
    GUID                   : 4f7faaa7-0000-0000-0000-000000000000
    Endereço físico        : 00:11:22:33:44:55
    Estado                 : conectado
    SSID                   : CafeLivre
    BSSID                  : 00:11:22:33:44:66
    Tipo de rede           : Infraestrutura
    Autenticação           : Aberta
    Codificação            : Nenhuma
"""

NETSH_WLAN_EN = """
There is 1 interface on the system:

    Name                   : Wi-Fi
    State                  : connected
    SSID                   : HomeNet
    Authentication         : WPA2-Personal
    Cipher                 : CCMP
"""

NETSH_WLAN_DISCONNECTED = """
Há 1 interface no sistema:

    Nome                   : Wi-Fi
    Estado                  : Desconectado
"""

ARP_WINDOWS = """
Interface: 192.168.3.8 --- 0x3
  Endereço IP           Endereço físico       Tipo
  192.168.3.1           88-36-cf-fb-73-1f     dinâmico
  192.168.3.16          28-0c-50-ba-f7-4d     dinâmico
  192.168.3.255         ff-ff-ff-ff-ff-ff     estático
  224.0.0.22            01-00-5e-00-00-16     estático
"""

ARP_MACOS = """\
? (192.168.1.1) at 8:36:cf:fb:73:1f on en0 ifscope [ethernet]
? (192.168.1.20) at (incomplete) on en0 ifscope [ethernet]
? (192.168.1.30) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
"""

PROC_NET_ARP = """\
IP address       HW type     Flags       HW address            Mask     Device
192.168.0.1      0x1         0x2         88:36:cf:fb:73:1f     *        wlan0
192.168.0.50     0x1         0x0         00:00:00:00:00:00     *        wlan0
192.168.0.60     0x1         0x2         aa:bb:cc:dd:ee:01     *        wlan0
"""

ROUTE_PRINT = """
===========================================================================
Tabela de rotas IPv4
===========================================================================
Rotas ativas:
Endereço de rede          Máscara   Ender. gateway       Interface   Custo
          0.0.0.0          0.0.0.0      10.8.0.1         10.8.0.6        50
          0.0.0.0          0.0.0.0      192.168.3.1      192.168.3.8     25
===========================================================================
Rotas persistentes:
  Endereço de rede     Máscara   Endereço de gateway  Métrica
          0.0.0.0          0.0.0.0      192.168.3.1  Padrão
"""

IPCONFIG_PT = """
Adaptador Ethernet Ethernet:

   Sufixo DNS específico de conexão. . . . . . :
   Endereço IPv6 de link local . . . . . . . . : fe80::1%3
   Endereço IPv4. . . . . . . .  . . . . . . . : 192.168.3.8
   Máscara de Sub-rede . . . . . . . . . . . . : 255.255.255.0
   Gateway Padrão. . . . . . . . . . . . . . . : fe80::1%3
                                                 192.168.3.1

Adaptador Ethernet vEthernet (WSL):

   Endereço IPv4. . . . . . . .  . . . . . . . : 172.25.208.1
   Máscara de Sub-rede . . . . . . . . . . . . : 255.255.240.0
   Gateway Padrão. . . . . . . . . . . . . . . :
"""


def fake_run_cmd_factory(outputs: dict):
    """Return a run_cmd replacement that answers by the command's first words."""
    calls = []

    def fake(cmd, timeout=None):
        calls.append(list(cmd))
        joined = " ".join(cmd)
        if joined in outputs:
            return outputs[joined]
        for prefix in sorted(outputs, key=len, reverse=True):  # longest prefix wins
            if joined.startswith(prefix):
                return outputs[prefix]
        return None

    fake.calls = calls
    return fake


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

class ListenerParserTests(unittest.TestCase):
    def test_netstat_windows_ipv4_localized(self):
        items = scanner.parse_netstat_windows(NETSTAT_TCP_PT)
        pairs = {(l.address, l.port, l.pid) for l in items}
        self.assertIn(("0.0.0.0", 445, 4), pairs)
        self.assertIn(("0.0.0.0", 5432, 9900), pairs)
        self.assertIn(("127.0.0.1", 5939, 4321), pairs)
        self.assertIn(("192.168.3.8", 139, 4), pairs)
        self.assertNotIn(51000, {l.port for l in items})  # ESTABLISHED ignored
        self.assertNotIn(51001, {l.port for l in items})  # TIME_WAIT ignored

    def test_netstat_windows_ipv6_and_localized_state(self):
        items = scanner.parse_netstat_windows(NETSTAT_TCPV6)
        pairs = {(l.address, l.port) for l in items}
        self.assertIn(("::", 445), pairs)
        self.assertIn(("::", 3389), pairs)  # localized state, remote port 0
        self.assertIn(("::1", 5432), pairs)
        self.assertIn(("fe80::1", 2869), pairs)  # zone id stripped

    def test_ss_parser(self):
        items = scanner.parse_ss_listen(SS_OUTPUT)
        pairs = {(l.address, l.port) for l in items}
        self.assertIn(("127.0.0.53", 53), pairs)
        self.assertIn(("0.0.0.0", 22), pairs)
        self.assertIn(("::", 22), pairs)
        self.assertIn(("*", 80), pairs)
        self.assertIn(("::ffff:127.0.0.1", 5173), pairs)
        sshd = [l for l in items if l.port == 22 and l.address == "0.0.0.0"][0]
        self.assertEqual((sshd.process, sshd.pid), ("sshd", 812))

    def test_ss_parser_skips_header(self):
        items = scanner.parse_ss_listen(SS_WITH_HEADER)
        self.assertEqual([(l.address, l.port) for l in items], [("0.0.0.0", 5173)])

    def test_lsof_parser(self):
        items = scanner.parse_lsof_listen(LSOF_OUTPUT)
        pairs = {(l.address, l.port, l.process) for l in items}
        self.assertIn(("*", 49152, "rapportd"), pairs)
        self.assertIn(("::1", 5432, "postgres"), pairs)
        self.assertIn(("127.0.0.1", 5432, "postgres"), pairs)
        self.assertIn(("192.168.1.10", 3000, "node"), pairs)
        self.assertIn(("*", 5900, "Screen Sharing"), pairs)

    def test_bsd_netstat_fallback(self):
        items = scanner.parse_netstat_unix_listen(BSD_NETSTAT)
        pairs = {(l.address, l.port) for l in items}
        self.assertEqual(pairs, {("*", 22), ("127.0.0.1", 5432), ("::1", 5432)})

    def test_classify_bind(self):
        self.assertEqual(scanner.classify_bind("0.0.0.0"), "all")
        self.assertEqual(scanner.classify_bind("::"), "all")
        self.assertEqual(scanner.classify_bind("*"), "all")
        self.assertEqual(scanner.classify_bind("127.0.0.1"), "loopback")
        self.assertEqual(scanner.classify_bind("::1"), "loopback")
        self.assertEqual(scanner.classify_bind("::ffff:127.0.0.1"), "loopback")
        self.assertEqual(scanner.classify_bind("192.168.3.8"), "specific")

    def test_tasklist_csv(self):
        text = '"System","4","Services","0","8 K"\n"postgres.exe","9900","Console","1","20.000 K"\n'
        self.assertEqual(scanner.parse_tasklist_csv(text), {4: "System", 9900: "postgres.exe"})


class FirewallAndProfileParserTests(unittest.TestCase):
    def test_netsh_firewall_pt(self):
        self.assertEqual(
            scanner.parse_netsh_firewall(NETSH_FW_PT),
            {"domain": True, "private": False, "public": True},
        )

    def test_netsh_firewall_en_all_off(self):
        profiles = scanner.parse_netsh_firewall(NETSH_FW_EN_OFF)
        self.assertEqual(profiles, {"domain": False, "private": False, "public": False})
        status = scanner.summarize_windows_firewall(profiles, set())
        self.assertIs(status.enabled, False)

    def test_summarize_uses_active_profile(self):
        profiles = {"domain": True, "private": False, "public": True}
        self.assertIs(scanner.summarize_windows_firewall(profiles, {"public"}).enabled, True)
        self.assertIs(scanner.summarize_windows_firewall(profiles, {"private"}).enabled, False)
        self.assertIsNone(scanner.summarize_windows_firewall(profiles, set()).enabled)
        self.assertIsNone(scanner.summarize_windows_firewall({}, set()).enabled)

    def test_macos_and_linux_firewall(self):
        self.assertIs(scanner.parse_socketfilterfw("Firewall is enabled. (State = 1)"), True)
        self.assertIs(scanner.parse_socketfilterfw("Firewall is disabled. (State = 0)"), False)
        self.assertIs(scanner.parse_ufw_status("Status: active\n"), True)
        self.assertIs(scanner.parse_ufw_status("Status: inactive\n"), False)
        self.assertIsNone(scanner.parse_ufw_status("ERROR: You need to be root"))
        self.assertIs(scanner.parse_firewalld_state("running\n"), True)
        self.assertIs(scanner.parse_firewalld_state("not running\n"), False)

    def test_connection_profiles(self):
        single = '{"Name": "Rede", "NetworkCategory": 1}'
        self.assertEqual(scanner.parse_connection_profiles(single), [{"name": "Rede", "category": "private"}])
        multiple = '[{"Name": "A", "NetworkCategory": "Public"}, {"Name": "B", "NetworkCategory": 2}]'
        self.assertEqual(
            [p["category"] for p in scanner.parse_connection_profiles(multiple)], ["public", "domain"]
        )
        self.assertEqual(scanner.parse_connection_profiles("not json"), [])


class WifiParserTests(unittest.TestCase):
    def test_netsh_wlan(self):
        self.assertEqual(scanner.parse_netsh_wlan(NETSH_WLAN_PT), "Aberta")
        self.assertEqual(scanner.parse_netsh_wlan(NETSH_WLAN_EN), "WPA2-Personal")
        self.assertIsNone(scanner.parse_netsh_wlan(NETSH_WLAN_DISCONNECTED))

    def test_nmcli(self):
        text = "no:Vizinho:WPA2\nyes:Cafe\\:Livre:\n"
        self.assertEqual(scanner.parse_nmcli_wifi(text), "")
        self.assertEqual(scanner.parse_nmcli_wifi("yes:Casa:WPA1 WPA2\n"), "WPA1 WPA2")
        self.assertIsNone(scanner.parse_nmcli_wifi("no:Casa:WPA2\n"))

    def test_macos_wifi(self):
        self.assertEqual(scanner.parse_airport_auth("     link auth: wpa2-psk\n"), "wpa2-psk")
        self.assertEqual(scanner.parse_macos_summary_security("  Security : WPA3_SAE\n"), "WPA3_SAE")

    def test_classify(self):
        cases = {
            "Aberta": "open", "Open": "open", "": "open", "--": "open", "none": "open",
            "WEP": "wep", "WPA-Personal": "wpa", "WPA2-Personal": "wpa2", "WPA1 WPA2": "wpa2",
            "WPA3-Personal": "wpa3", "wpa2-psk": "wpa2", "WPA2_PSK": "wpa2",
        }
        for raw, expected in cases.items():
            self.assertEqual(scanner.classify_wifi_security(raw)[0], expected, raw)
        self.assertEqual(scanner.classify_wifi_security("WPA2-Enterprise"), ("wpa2", True))
        self.assertEqual(scanner.wifi_security_label("Aberta"), "OPEN")
        self.assertEqual(scanner.wifi_security_label("WPA2-Enterprise"), "WPA2-Enterprise")
        self.assertIsNone(scanner.wifi_security_label(None))


class NetworkParserTests(unittest.TestCase):
    def test_route_print_prefers_local_interface(self):
        self.assertEqual(
            scanner.parse_route_print_windows(ROUTE_PRINT, "192.168.3.8"), ("192.168.3.1", "192.168.3.8")
        )
        # Without a local IP, the lowest metric wins.
        self.assertEqual(scanner.parse_route_print_windows(ROUTE_PRINT, None), ("192.168.3.1", "192.168.3.8"))

    def test_ipconfig(self):
        self.assertEqual(scanner.parse_ipconfig_netmask(IPCONFIG_PT, "192.168.3.8"), 24)
        self.assertEqual(scanner.parse_ipconfig_netmask(IPCONFIG_PT, "172.25.208.1"), 20)
        self.assertEqual(scanner.parse_ipconfig_gateway(IPCONFIG_PT, "192.168.3.8"), "192.168.3.1")
        self.assertIsNone(scanner.parse_ipconfig_gateway(IPCONFIG_PT, "172.25.208.1"))

    def test_unix_routes(self):
        self.assertEqual(
            scanner.parse_macos_route("   route to: default\n    gateway: 192.168.1.1\n  interface: en0\n"),
            ("192.168.1.1", "en0"),
        )
        self.assertEqual(
            scanner.parse_ip_route_default("default via 192.168.0.1 dev wlp2s0 proto dhcp metric 600\n"),
            ("192.168.0.1", "wlp2s0"),
        )
        proc = (
            "Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\n"
            "wlan0\t00000000\t0100A8C0\t0003\t0\t0\t600\t00000000\n"
        )
        self.assertEqual(scanner.parse_proc_net_route(proc), "192.168.0.1")

    def test_prefix_parsers(self):
        mac = "en0: flags=8863<UP>\n\tinet 192.168.1.10 netmask 0xffffff00 broadcast 192.168.1.255\n"
        self.assertEqual(scanner.parse_ifconfig_prefix(mac, "192.168.1.10"), 24)
        linux = "2: wlan0    inet 10.0.0.5/16 brd 10.0.255.255 scope global wlan0\n"
        self.assertEqual(scanner.parse_ip_addr_prefix(linux, "10.0.0.5"), 16)

    def test_arp_parsers(self):
        self.assertEqual(
            scanner.parse_arp_output(ARP_WINDOWS),
            [("192.168.3.1", "88:36:cf:fb:73:1f"), ("192.168.3.16", "28:0c:50:ba:f7:4d")],
        )
        self.assertEqual(
            scanner.parse_arp_output(ARP_MACOS),
            [("192.168.1.1", "08:36:cf:fb:73:1f"), ("192.168.1.30", "aa:bb:cc:dd:ee:ff")],
        )
        self.assertEqual(
            scanner.parse_proc_net_arp(PROC_NET_ARP),
            [("192.168.0.1", "88:36:cf:fb:73:1f"), ("192.168.0.60", "aa:bb:cc:dd:ee:01")],
        )


class ServiceParserTests(unittest.TestCase):
    def test_http_response(self):
        data = (
            b"HTTP/1.1 200 OK\r\nServer: lighttpd/1.4.35\r\nContent-Type: text/html\r\n\r\n"
            b"<html><head><title> Roteador &amp; Wi-Fi\n Login </title></head></html>"
        )
        self.assertEqual(
            scanner.parse_http_response(data),
            {"status": 200, "server": "lighttpd/1.4.35", "title": "Roteador & Wi-Fi Login"},
        )

    def test_clean_banner_strips_telnet_negotiation(self):
        raw = b"\xff\xfb\x01\xff\xfb\x03\xff\xfd\x18\r\nBusyBox v1.19.4 login: "
        self.assertEqual(scanner.clean_banner(raw), "BusyBox v1.19.4 login:")

    def test_ssdp_and_description(self):
        response = (
            b"HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=120\r\n"
            b"LOCATION: http://192.168.0.1:1900/rootDesc.xml\r\n"
            b"SERVER: Linux/3.10.104 UPnP/1.0 MiniUPnPd/1.9\r\n"
            b"ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n"
        )
        headers = scanner.parse_ssdp_response(response)
        self.assertEqual(headers["location"], "http://192.168.0.1:1900/rootDesc.xml")
        self.assertTrue(scanner._is_igd(headers["st"]))
        self.assertEqual(scanner.parse_ssdp_response(b"NOTIFY * HTTP/1.1\r\n\r\n"), {})
        xml = (
            "<root><device><deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType>"
            "<manufacturer>ACME</manufacturer><modelName>ACME Router X</modelName>"
            "<modelNumber>RX-100</modelNumber></device></root>"
        )
        description = scanner.parse_device_description(xml)
        self.assertEqual(scanner.model_from_description(description), "ACME Router X RX-100")

    def test_location_must_be_inside_subnet(self):
        net = ipaddress.IPv4Network("192.168.0.0/24")
        self.assertEqual(
            scanner.location_allowed("http://192.168.0.1:1900/rootDesc.xml", net),
            ("192.168.0.1", 1900, "/rootDesc.xml"),
        )
        self.assertIsNone(scanner.location_allowed("http://8.8.8.8/desc.xml", net))
        self.assertIsNone(scanner.location_allowed("http://router.local/desc.xml", net))
        self.assertIsNone(scanner.location_allowed("https://192.168.0.1/desc.xml", net))
        self.assertIsNone(scanner.location_allowed("http://192.168.1.1/desc.xml", net))

    def test_extract_versions(self):
        self.assertEqual(scanner.extract_versions("SSH-2.0-OpenSSH_7.4p1 Debian"), ["OpenSSH 7.4p1"])
        self.assertEqual(scanner.extract_versions("220 (vsFTPd 3.0.3)"), ["vsFTPd 3.0.3"])
        self.assertEqual(
            scanner.extract_versions("Linux/3.10.104 UPnP/1.0 MiniUPnPd/1.9"),
            ["Linux 3.10.104", "MiniUPnPd 1.9"],
        )
        self.assertEqual(scanner.extract_versions("RFB 003.008"), [])
        self.assertEqual(scanner.extract_versions("Microsoft-HTTPAPI/2.0"), [])
        self.assertEqual(scanner.extract_versions("nginx"), [])
        self.assertEqual(scanner.extract_versions(None), [])


# ---------------------------------------------------------------------------
# Network policy
# ---------------------------------------------------------------------------

class NetworkPolicyTests(unittest.TestCase):
    def test_rfc1918_accepted(self):
        for ip in ("10.1.2.3", "172.16.0.5", "172.31.255.1", "192.168.0.10"):
            self.assertTrue(scanner.is_rfc1918(ip), ip)
            self.assertEqual(scanner.check_home_network_allowed(ip), (True, ""))

    def test_non_rfc1918_refused(self):
        cases = {
            "100.64.0.1": "cgnat", "100.127.255.254": "cgnat",
            "8.8.8.8": "non_private", "172.32.0.1": "non_private", "203.0.113.5": "non_private",
            "127.0.0.1": "loopback", "169.254.10.20": "link_local",
            None: "invalid", "": "invalid", "not-an-ip": "invalid", "0.0.0.0": "invalid",
        }
        for ip, kind in cases.items():
            self.assertEqual(scanner.classify_ip(ip), kind, ip)
            allowed, message = scanner.check_home_network_allowed(ip)
            self.assertFalse(allowed, ip)
            self.assertTrue(message)

    def test_scan_network_never_larger_than_24(self):
        net = scanner.compute_scan_network("10.0.5.20", 8)
        self.assertEqual(str(net), "10.0.5.0/24")
        self.assertLessEqual(len(list(net.hosts())), 254)
        self.assertEqual(str(scanner.compute_scan_network("192.168.1.70", 26)), "192.168.1.64/26")
        self.assertEqual(str(scanner.compute_scan_network("192.168.1.70", None)), "192.168.1.0/24")
        self.assertIsNone(scanner.compute_scan_network("10.8.0.6", 32))
        self.assertIsNone(scanner.compute_scan_network("100.64.1.1", 24))
        self.assertIsNone(scanner.compute_scan_network("8.8.8.8", 24))

    def test_limits_are_within_rules(self):
        self.assertLessEqual(scanner.MAX_THREADS, 64)
        self.assertGreaterEqual(scanner.CONNECT_TIMEOUT, 0.3)
        self.assertLessEqual(scanner.CONNECT_TIMEOUT, 0.5)
        self.assertLessEqual(scanner.GLOBAL_TIME_CAP, 120)
        self.assertLessEqual(scanner.HTTP_READ_LIMIT, 4096)


# ---------------------------------------------------------------------------
# Consent gate and probe guard
# ---------------------------------------------------------------------------

def home_args(*extra):
    return scanner.build_arg_parser().parse_args(["--mode", "home", *extra])


class ConsentGateTests(unittest.TestCase):
    def setUp(self):
        scanner._revoke_probes()
        self.patches = {
            "detect_network": mock.patch.object(
                scanner, "detect_network",
                return_value=scanner.NetworkInfo("192.168.0.10", 24, "192.168.0.1"),
            ),
            "probe_hosts": mock.patch.object(scanner, "probe_hosts", return_value=({}, set())),
            "enrich_services": mock.patch.object(scanner, "enrich_services", return_value={}),
            "ssdp_discover": mock.patch.object(scanner, "ssdp_discover", return_value={}),
            "fetch_descriptions": mock.patch.object(scanner, "fetch_descriptions", return_value={}),
            "read_arp_table": mock.patch.object(scanner, "read_arp_table", return_value=[]),
            "get_wifi_security": mock.patch.object(scanner, "get_wifi_security", return_value=None),
            "get_hostname": mock.patch.object(scanner, "get_hostname", return_value="host-teste"),
            "upload_payload": mock.patch.object(scanner, "upload_payload"),
        }
        self.mocks = {name: p.start() for name, p in self.patches.items()}
        self.addCleanup(mock.patch.stopall)
        self.addCleanup(scanner._revoke_probes)

    def assert_no_probe(self):
        for name in ("probe_hosts", "enrich_services", "ssdp_discover", "fetch_descriptions"):
            self.mocks[name].assert_not_called()

    def test_non_interactive_without_flag_refuses(self):
        with mock.patch.object(scanner, "_stdin_is_interactive", return_value=False), quiet():
            code = scanner.run_home(home_args())
        self.assertEqual(code, scanner.EXIT_REFUSED)
        self.assert_no_probe()

    def test_interactive_wrong_answer_refuses(self):
        for answer in ("nao", "", "s", "yes", "SIM, talvez"):
            with mock.patch.object(scanner, "_stdin_is_interactive", return_value=True), \
                    mock.patch("builtins.input", return_value=answer), quiet():
                code = scanner.run_home(home_args())
            self.assertEqual(code, scanner.EXIT_REFUSED, answer)
        self.assert_no_probe()

    def test_interactive_eof_refuses(self):
        with mock.patch.object(scanner, "_stdin_is_interactive", return_value=True), \
                mock.patch("builtins.input", side_effect=EOFError), quiet():
            code = scanner.run_home(home_args())
        self.assertEqual(code, scanner.EXIT_REFUSED)
        self.assert_no_probe()

    def test_interactive_sim_allows_probe(self):
        with mock.patch.object(scanner, "_stdin_is_interactive", return_value=True), \
                mock.patch("builtins.input", return_value="SIM"), quiet():
            code = scanner.run_home(home_args())
        self.assertEqual(code, scanner.EXIT_OK)
        self.mocks["probe_hosts"].assert_called_once()
        hosts, ports, _deadline = self.mocks["probe_hosts"].call_args.args
        self.assertEqual(len(hosts), 254)
        self.assertEqual(tuple(ports), scanner.HOME_PORTS)
        self.assertIsNone(scanner._probe_scope)  # authorization revoked afterwards

    def test_flag_allows_probe_non_interactive(self):
        with mock.patch.object(scanner, "_stdin_is_interactive", return_value=False), quiet():
            code = scanner.run_home(home_args("--confirmo-rede-propria"))
        self.assertEqual(code, scanner.EXIT_OK)
        self.mocks["probe_hosts"].assert_called_once()
        self.mocks["ssdp_discover"].assert_called_once()

    def test_refused_networks_even_with_flag(self):
        for ip in ("100.64.3.4", "8.8.8.8", "127.0.0.1", "169.254.1.1", None):
            self.mocks["detect_network"].return_value = scanner.NetworkInfo(ip, 24, None)
            with quiet():
                code = scanner.run_home(home_args("--confirmo-rede-propria"))
            self.assertEqual(code, scanner.EXIT_REFUSED, ip)
        self.mocks["detect_network"].return_value = scanner.NetworkInfo("10.8.0.6", 32, None)
        with quiet():
            self.assertEqual(scanner.run_home(home_args("--confirmo-rede-propria")), scanner.EXIT_REFUSED)
        self.assert_no_probe()

    def test_full_home_pipeline_with_mocks(self):
        self.mocks["probe_hosts"].return_value = (
            {"192.168.0.1": {23, 80}, "192.168.0.30": {554}},
            {"192.168.0.1", "192.168.0.30"},
        )
        self.mocks["enrich_services"].return_value = {
            ("192.168.0.1", 23): {"banner": "BusyBox v1.19.4 login:"},
            ("192.168.0.1", 80): {"http": {"status": 200, "server": "lighttpd/1.4.35", "title": "Login"}},
        }
        self.mocks["ssdp_discover"].return_value = {
            "192.168.0.1": {"server": "Linux/3.10 UPnP/1.0 MiniUPnPd/1.9",
                            "locations": ["http://192.168.0.1:1900/rootDesc.xml"], "igd": True},
        }
        self.mocks["fetch_descriptions"].return_value = {
            "http://192.168.0.1:1900/rootDesc.xml": {"manufacturer": "ACME", "modelName": "Router X",
                                                    "modelNumber": "RX1", "deviceType": None},
        }
        self.mocks["read_arp_table"].return_value = [("192.168.0.1", "88:36:cf:fb:73:1f")]
        self.mocks["get_wifi_security"].return_value = "WPA2-Personal"
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = scanner.run_home(home_args("--confirmo-rede-propria", "--json"))
        self.assertEqual(code, scanner.EXIT_OK)
        payload = json.loads(out.getvalue())
        self.assertEqual(payload["mode"], "home")
        self.assertEqual(payload["network"]["cidr"], "192.168.0.0/24")
        self.assertEqual(payload["network"]["wifiSecurity"], "WPA2")
        router = [d for d in payload["devices"] if d["ip"] == "192.168.0.1"][0]
        self.assertEqual(router["model"], "ACME Router X RX1")
        self.assertEqual(router["mac"], "88:36:cf:fb:73:1f")
        self.assertIsNone(router["vendor"])
        found = {(f["kind"], f["deviceIp"]) for f in payload["findings"]}
        for item in (("telnet_open", "192.168.0.1"), ("router_admin_http", "192.168.0.1"),
                     ("upnp_enabled", "192.168.0.1"), ("possibly_outdated_software", "192.168.0.1"),
                     ("rtsp_camera_stream", "192.168.0.30")):
            self.assertIn(item, found)
        self.assertEqual(payload["findings"][0]["kind"], "telnet_open")
        summary = scanner.format_summary(payload)
        self.assertIn("Dispositivos encontrados: 2", summary)
        self.assertIn("[ALTO] Telnet aberto", summary)

    def test_dry_run_never_uploads(self):
        args = home_args("--confirmo-rede-propria", "--dry-run", "--api", "https://api.exemplo.test", "--token", "t")
        with quiet():
            scanner.run_home(args)
        self.mocks["upload_payload"].assert_not_called()


class ProbeGuardTests(unittest.TestCase):
    def setUp(self):
        scanner._revoke_probes()
        self.addCleanup(scanner._revoke_probes)

    def test_probes_refuse_without_consent(self):
        with mock.patch.object(scanner.socket, "socket") as fake_socket, \
                mock.patch.object(scanner.socket, "create_connection") as fake_connect:
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.tcp_probe("192.168.0.5", 80)
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.grab_banner("192.168.0.5", 22)
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.http_probe("192.168.0.5", 80)
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.probe_hosts(["192.168.0.5"], (80,), 0)
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.ssdp_discover("192.168.0.10", ipaddress.IPv4Network("192.168.0.0/24"))
            fake_socket.assert_not_called()
            fake_connect.assert_not_called()

    def test_probes_refuse_outside_authorized_subnet(self):
        scanner._authorize_probes(ipaddress.IPv4Network("192.168.0.0/24"))
        with mock.patch.object(scanner.socket, "socket") as fake_socket:
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.tcp_probe("192.168.1.5", 80)
            with self.assertRaises(scanner.ProbeNotAuthorized):
                scanner.tcp_probe("8.8.8.8", 443)
            fake_socket.assert_not_called()

    def test_tcp_probe_states_with_fake_socket(self):
        scanner._authorize_probes(ipaddress.IPv4Network("192.168.0.0/24"))
        for side_effect, expected in ((None, "open"), (ConnectionRefusedError(), "closed"),
                                      (socket.timeout(), "filtered")):
            fake = mock.MagicMock()
            fake.connect.side_effect = side_effect
            with mock.patch.object(scanner.socket, "socket", return_value=fake):
                self.assertEqual(scanner.tcp_probe("192.168.0.5", 80), expected)
            fake.close.assert_called_once()


# ---------------------------------------------------------------------------
# Finding builders
# ---------------------------------------------------------------------------

def kinds(findings):
    return {f["kind"] for f in findings}


class HomeFindingTests(unittest.TestCase):
    def test_risky_services(self):
        device = scanner.Device(ip="192.168.0.20", open_ports={23, 445, 3389, 21, 554, 7547, 1883, 5900, 9100})
        findings = scanner.build_device_findings(device)
        by_kind = {f["kind"]: f for f in findings}
        self.assertEqual(by_kind["telnet_open"]["severity"], "high")
        self.assertEqual(by_kind["vnc_open"]["severity"], "high")
        for kind in ("smb_exposed", "rdp_open", "ftp_open", "rtsp_camera_stream", "tr069_open", "mqtt_no_tls"):
            self.assertEqual(by_kind[kind]["severity"], "medium", kind)
        self.assertEqual(by_kind["printer_raw_port"]["severity"], "low")
        self.assertEqual(by_kind["smb_exposed"]["port"], 445)
        for finding in findings:
            self.assertEqual(finding["deviceIp"], "192.168.0.20")

    def test_http_panel_router_vs_camera(self):
        router = scanner.Device(ip="192.168.0.1", open_ports={80}, is_gateway=True,
                                http={80: {"status": 200, "server": None, "title": "Login"}})
        self.assertEqual(
            [(f["kind"], f["severity"]) for f in scanner.build_device_findings(router)],
            [("router_admin_http", "low")],
        )
        camera = scanner.Device(ip="192.168.0.30", open_ports={80},
                                http={80: {"status": 200, "server": "Hikvision-Webs", "title": None}})
        self.assertIn(("camera_admin_http", "medium"),
                      [(f["kind"], f["severity"]) for f in scanner.build_device_findings(camera)])

    def test_upnp_low(self):
        device = scanner.Device(ip="192.168.0.1", upnp=True, upnp_igd=True, is_gateway=True)
        findings = scanner.build_device_findings(device)
        self.assertEqual([(f["kind"], f["severity"]) for f in findings], [("upnp_enabled", "low")])

    def test_outdated_claim_only_when_version_read(self):
        no_version = scanner.Device(ip="192.168.0.40", open_ports={22, 80},
                                    banners={22: "SSH-2.0-dropbear"},
                                    http={80: {"status": 200, "server": "nginx", "title": None}})
        findings = scanner.build_device_findings(no_version)
        self.assertNotIn("possibly_outdated_software", kinds(findings))
        self.assertFalse(any("desatualizado" in (f["detail"] + f["title"]) for f in findings))

        with_version = scanner.Device(ip="192.168.0.41", open_ports={22}, banners={22: "SSH-2.0-OpenSSH_7.4"})
        findings = scanner.build_device_findings(with_version)
        outdated = [f for f in findings if f["kind"] == "possibly_outdated_software"]
        self.assertEqual(len(outdated), 1)
        self.assertIn("OpenSSH 7.4", outdated[0]["detail"])
        self.assertIn("possivelmente desatualizado", outdated[0]["detail"])
        self.assertEqual(outdated[0]["port"], 22)

    def test_assemble_devices_uses_arp_and_ssdp(self):
        net = ipaddress.IPv4Network("192.168.0.0/24")
        devices = scanner.assemble_devices(
            net, "192.168.0.10", "192.168.0.1", "meu-pc",
            open_map={"192.168.0.1": {80, 53}, "192.168.0.10": {445}},
            alive={"192.168.0.1", "192.168.0.10"},
            enrichment={("192.168.0.1", 80): {"http": {"status": 200, "server": "mini_httpd/1.19", "title": "Login"}}},
            ssdp={"192.168.0.1": {"server": "Linux/2.6 UPnP/1.0", "locations": ["http://192.168.0.1:1900/d.xml"], "igd": True}},
            descriptions={"http://192.168.0.1:1900/d.xml": {"manufacturer": "ACME", "modelName": "R1", "modelNumber": None, "deviceType": None}},
            arp=[("192.168.0.1", "88:36:cf:fb:73:1f"), ("192.168.0.77", "aa:bb:cc:dd:ee:ff"),
                 ("10.0.0.1", "aa:aa:aa:aa:aa:aa")],
        )
        by_ip = {d.ip: d for d in devices}
        self.assertEqual(set(by_ip), {"192.168.0.1", "192.168.0.10", "192.168.0.77"})
        router = by_ip["192.168.0.1"]
        self.assertTrue(router.is_gateway and router.upnp and router.upnp_igd)
        self.assertEqual(router.model, "ACME R1")
        self.assertEqual(router.mac, "88:36:cf:fb:73:1f")
        payload = router.to_payload()
        self.assertIsNone(payload["vendor"])
        self.assertEqual(payload["openPorts"], [53, 80])
        http_service = [s for s in payload["services"] if s["port"] == 80][0]
        self.assertEqual(http_service["name"], "http")
        self.assertIn("mini_httpd/1.19", http_service["banner"])
        self.assertEqual(by_ip["192.168.0.10"].hostname, "meu-pc")


class PublicFindingTests(unittest.TestCase):
    LISTENERS = [
        scanner.Listener("0.0.0.0", 445, 4, "System"),
        scanner.Listener("::", 445, 4, "System"),
        scanner.Listener("0.0.0.0", 5432, 9900, "postgres.exe"),
        scanner.Listener("127.0.0.1", 6379, 50, "redis-server"),  # loopback only: not exposed
        scanner.Listener("0.0.0.0", 5173, 77, "node.exe"),
        scanner.Listener("0.0.0.0", 3389, 1100, "svchost.exe"),
        scanner.Listener("0.0.0.0", 22, 812, "sshd"),
        scanner.Listener("0.0.0.0", 5900, 90, "vnc"),
        scanner.Listener("0.0.0.0", 135, 1792, "svchost.exe"),
    ]

    def test_firewall_on_wording(self):
        findings = scanner.build_listener_findings(self.LISTENERS, True)
        by_port = {f["port"]: f for f in findings if f["port"]}
        self.assertNotIn(6379, by_port)
        self.assertIn("pode estar exposto", by_port[445]["title"])
        self.assertEqual(by_port[445]["kind"], "exposed_smb")
        self.assertEqual(by_port[445]["severity"], "medium")
        self.assertEqual(by_port[5432]["kind"], "exposed_database")
        self.assertEqual(by_port[5173]["kind"], "exposed_dev_server")
        self.assertEqual(by_port[3389]["kind"], "exposed_rdp")
        self.assertEqual(by_port[22]["severity"], "low")
        self.assertEqual(by_port[5900]["severity"], "high")
        self.assertIn("postgres.exe (PID 9900)", by_port[5432]["detail"])
        other = [f for f in findings if f["kind"] == "exposed_other_ports"]
        self.assertEqual(len(other), 1)
        self.assertIn("135", other[0]["detail"])

    def test_firewall_off_wording_and_bump(self):
        findings = scanner.build_listener_findings(self.LISTENERS, False)
        by_port = {f["port"]: f for f in findings if f["port"]}
        self.assertIn("provavelmente exposto", by_port[445]["title"])
        self.assertEqual(by_port[445]["severity"], "high")
        self.assertEqual(by_port[22]["severity"], "medium")
        self.assertEqual(by_port[5900]["severity"], "high")  # capped at high

    def test_loopback_only_has_no_findings(self):
        listeners = [scanner.Listener("127.0.0.1", 5432), scanner.Listener("::1", 3000)]
        self.assertEqual(scanner.build_listener_findings(listeners, None), [])

    def test_firewall_findings(self):
        self.assertEqual(
            scanner.build_firewall_finding(scanner.FirewallStatus(False, ["public"]), "windows")["severity"], "high"
        )
        self.assertEqual(scanner.build_firewall_finding(scanner.FirewallStatus(True), "macos")["kind"], "firewall_enabled")
        self.assertEqual(
            scanner.build_firewall_finding(scanner.FirewallStatus(None), "linux")["kind"], "firewall_unknown"
        )
        self.assertEqual(
            scanner.build_firewall_finding(scanner.FirewallStatus(None, ["private"]), "windows")["severity"], "medium"
        )

    def test_profile_finding(self):
        findings = scanner.build_profile_findings([{"name": "x", "category": "private"}])
        self.assertEqual([(f["kind"], f["severity"]) for f in findings], [("network_marked_private", "medium")])
        self.assertEqual(scanner.build_profile_findings([{"name": "x", "category": "public"}]), [])

    def test_hostname_heuristics(self):
        for name in ("MacBook-Pro-de-Joao", "Joaos-MacBook-Pro", "iPhone-de-Maria", "John's MacBook",
                     "notebook-da-ana", "PC-do-Carlos"):
            self.assertTrue(scanner.hostname_reveals_identity(name), name)
            self.assertEqual(scanner.build_hostname_finding(name)["severity"], "low")
        for name in ("DESKTOP-7QK2L1A", "ubuntu", "LAPTOP-ABC123", "", None):
            self.assertFalse(scanner.hostname_reveals_identity(name), name)
            self.assertIsNone(scanner.build_hostname_finding(name))

    def test_wifi_findings(self):
        self.assertEqual(scanner.build_wifi_finding("Aberta", "public")["severity"], "high")
        self.assertEqual(scanner.build_wifi_finding("WEP", "home")["kind"], "wifi_wep")
        self.assertEqual(scanner.build_wifi_finding("WPA-Personal", "public")["severity"], "medium")
        self.assertEqual(scanner.build_wifi_finding("WPA2-Personal", "public")["severity"], "info")
        self.assertIsNone(scanner.build_wifi_finding(None, "public"))

    def test_arp_spoofing(self):
        entries = [("192.168.0.1", "aa:aa:aa:aa:aa:01"), ("192.168.0.66", "aa:aa:aa:aa:aa:01"),
                   ("192.168.0.20", "bb:bb:bb:bb:bb:02")]
        finding = scanner.detect_arp_spoofing(entries, "192.168.0.1")
        self.assertEqual((finding["kind"], finding["severity"]), ("arp_spoofing_suspected", "medium"))
        self.assertIn("192.168.0.66", finding["detail"])
        clean = [("192.168.0.1", "aa:aa:aa:aa:aa:01"), ("192.168.0.20", "bb:bb:bb:bb:bb:02")]
        self.assertIsNone(scanner.detect_arp_spoofing(clean, "192.168.0.1"))
        self.assertIsNone(scanner.detect_arp_spoofing(entries, None))

    def test_public_ip_finding(self):
        self.assertEqual(scanner.build_ip_findings("203.0.113.9")[0]["kind"], "public_ip_direct")
        self.assertEqual(scanner.build_ip_findings("192.168.0.9"), [])
        self.assertEqual(scanner.build_ip_findings("100.64.0.9"), [])


# ---------------------------------------------------------------------------
# Payload contract
# ---------------------------------------------------------------------------

class PayloadTests(unittest.TestCase):
    def base(self, **overrides):
        payload = {
            "agentVersion": scanner.AGENT_VERSION,
            "mode": "home",
            "startedAt": "2026-11-22T12:00:00Z",
            "finishedAt": "2026-11-22T12:01:00Z",
            "host": {"os": "windows", "hostname": "pc"},
            "network": {"localIp": "192.168.0.10", "cidr": "192.168.0.0/24", "gateway": "192.168.0.1",
                        "isPrivate": True, "wifiSecurity": None},
            "devices": [],
            "findings": [],
        }
        payload.update(overrides)
        return payload

    def test_exact_shape(self):
        device = scanner.Device(ip="192.168.0.1", open_ports={80}).to_payload()
        finding = scanner.make_finding("low", "upnp_enabled", "t", "d", "r", "192.168.0.1", None)
        result = scanner.sanitize_payload(self.base(devices=[device], findings=[finding]))
        self.assertEqual(
            list(result),
            ["agentVersion", "mode", "startedAt", "finishedAt", "host", "network", "devices", "findings"],
        )
        self.assertEqual(set(result["host"]), {"os", "hostname"})
        self.assertEqual(set(result["network"]), {"localIp", "cidr", "gateway", "isPrivate", "wifiSecurity"})
        self.assertEqual(
            set(result["devices"][0]),
            {"ip", "mac", "vendor", "hostname", "model", "openPorts", "services"},
        )
        self.assertEqual(set(result["devices"][0]["services"][0]), {"port", "protocol", "name", "banner"})
        self.assertEqual(
            set(result["findings"][0]),
            {"severity", "kind", "title", "detail", "recommendation", "deviceIp", "port"},
        )
        json.dumps(result)  # serializable

    def test_string_truncation(self):
        long = "x" * 2000
        finding = scanner.make_finding("info", "k", long, long, long)
        device = {"ip": "192.168.0.1", "mac": None, "hostname": long, "model": long, "openPorts": [80],
                  "services": [{"port": 80, "protocol": "tcp", "name": "http", "banner": long}]}
        result = scanner.sanitize_payload(self.base(devices=[device], findings=[finding]))
        self.assertEqual(len(result["findings"][0]["title"]), 500)
        self.assertEqual(len(result["findings"][0]["detail"]), 500)
        self.assertEqual(len(result["devices"][0]["model"]), 500)
        self.assertEqual(len(result["devices"][0]["services"][0]["banner"]), 500)

    def test_kind_and_enums(self):
        weird = scanner.make_finding("catastrophic", "Weird Kind-Name!!" + "a" * 100, "t", "d", "r", port=70000)
        result = scanner.sanitize_payload(self.base(findings=[weird]))
        finding = result["findings"][0]
        self.assertEqual(finding["severity"], "info")
        self.assertRegex(finding["kind"], r"^[a-z0-9_]+$")
        self.assertLessEqual(len(finding["kind"]), 64)
        self.assertIsNone(finding["port"])
        self.assertEqual(scanner.sanitize_kind(""), "unknown")
        with self.assertRaises(ValueError):
            scanner.sanitize_payload(self.base(mode="spy"))

    def test_list_limits_keep_most_severe(self):
        findings = [scanner.make_finding("info", "i", "t", "d", "r") for _ in range(600)]
        findings.append(scanner.make_finding("high", "important", "t", "d", "r"))
        devices = [{"ip": f"192.168.{i // 250}.{i % 250 + 1}", "openPorts": [], "services": []} for i in range(300)]
        result = scanner.sanitize_payload(self.base(devices=devices, findings=findings))
        self.assertEqual(len(result["findings"]), 500)
        self.assertEqual(result["findings"][0]["kind"], "important")
        self.assertEqual(len(result["devices"]), 256)

    def test_public_mode_has_no_devices(self):
        device = {"ip": "192.168.0.5", "openPorts": [], "services": []}
        result = scanner.sanitize_payload(self.base(mode="public", devices=[device]))
        self.assertEqual(result["devices"], [])

    def test_timestamps_are_utc_iso(self):
        self.assertRegex(scanner.now_iso(), r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


# ---------------------------------------------------------------------------
# Public mode never touches the network
# ---------------------------------------------------------------------------

class FakeSocket:
    created = []
    sent = []

    def __init__(self, family=socket.AF_INET, type=socket.SOCK_STREAM, proto=0, *args, **kwargs):
        self.kind = type
        FakeSocket.created.append((family, type))

    def connect(self, address):
        # A UDP connect() only selects a route (no packet). TCP connect is forbidden.
        if self.kind != socket.SOCK_DGRAM:
            raise AssertionError("TCP connect in public mode")

    def getsockname(self):
        return ("192.168.0.8", 50000)

    def sendto(self, *args, **kwargs):
        FakeSocket.sent.append(args)
        raise AssertionError("sendto in public mode")

    def send(self, *args, **kwargs):
        FakeSocket.sent.append(args)
        raise AssertionError("send in public mode")

    sendall = send

    def setsockopt(self, *args):
        pass

    def settimeout(self, *args):
        pass

    def close(self):
        pass


class PublicModeIsolationTests(unittest.TestCase):
    OUTPUTS = {
        "route print": ROUTE_PRINT.replace("192.168.3", "192.168.0"),
        "ipconfig": IPCONFIG_PT.replace("192.168.3", "192.168.0"),
        "netstat -ano -p tcp": NETSTAT_TCP_PT,
        "netstat -ano -p tcpv6": NETSTAT_TCPV6,
        "tasklist": '"System","4","Services","0","8 K"\n',
        "netsh advfirewall": NETSH_FW_PT,
        "netsh wlan": NETSH_WLAN_PT,
        "powershell": '{"Name": "Rede", "NetworkCategory": 1}',
        "arp": ARP_WINDOWS.replace("192.168.3", "192.168.0"),
    }

    def run_public(self, *extra):
        FakeSocket.created = []
        FakeSocket.sent = []
        fake_run = fake_run_cmd_factory(self.OUTPUTS)
        guarded = ["tcp_probe", "probe_hosts", "grab_banner", "http_probe", "enrich_services",
                   "ssdp_discover", "fetch_device_description", "fetch_descriptions", "upload_payload"]
        with contextlib.ExitStack() as stack:
            probes = {name: stack.enter_context(mock.patch.object(scanner, name)) for name in guarded}
            stack.enter_context(mock.patch.object(scanner, "detect_os", return_value="windows"))
            stack.enter_context(mock.patch.object(scanner, "get_hostname", return_value="Notebook-de-Teste"))
            stack.enter_context(mock.patch.object(scanner, "run_cmd", side_effect=fake_run))
            stack.enter_context(mock.patch.object(scanner, "read_text_file", return_value=None))
            stack.enter_context(mock.patch.object(scanner.socket, "socket", FakeSocket))
            create_connection = stack.enter_context(mock.patch.object(scanner.socket, "create_connection"))
            urlopen = stack.enter_context(mock.patch.object(scanner.urllib.request, "urlopen"))
            http_conn = stack.enter_context(mock.patch.object(scanner.http.client, "HTTPConnection"))
            out = io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                args = scanner.build_arg_parser().parse_args(["--mode", "public", "--json", *extra])
                code = scanner.run_public(args)
            for name, probe in probes.items():
                probe.assert_not_called()
            create_connection.assert_not_called()
            urlopen.assert_not_called()
            http_conn.assert_not_called()
        self.assertEqual(FakeSocket.sent, [])
        self.assertTrue(all(kind == socket.SOCK_DGRAM for _family, kind in FakeSocket.created))
        return code, json.loads(out.getvalue()), fake_run.calls

    def test_public_mode_sends_nothing_and_builds_payload(self):
        code, payload, calls = self.run_public()
        self.assertEqual(code, scanner.EXIT_OK)
        self.assertEqual(payload["mode"], "public")
        self.assertEqual(payload["devices"], [])
        self.assertEqual(payload["network"]["localIp"], "192.168.0.8")
        self.assertEqual(payload["network"]["gateway"], "192.168.0.1")
        self.assertEqual(payload["network"]["cidr"], "192.168.0.0/24")
        self.assertTrue(payload["network"]["isPrivate"])
        self.assertEqual(payload["network"]["wifiSecurity"], "OPEN")
        found = {f["kind"] for f in payload["findings"]}
        # Active profile is Private and the Private firewall profile is off -> disabled.
        for kind in ("wifi_open", "network_marked_private", "exposed_smb", "exposed_database",
                     "hostname_reveals_identity", "firewall_disabled"):
            self.assertIn(kind, found)
        smb = [f for f in payload["findings"] if f["kind"] == "exposed_smb" and f["port"] == 445][0]
        self.assertIn("provavelmente exposto", smb["title"])
        self.assertEqual(payload["findings"][0]["severity"], "high")  # sorted by severity
        # Only local read-only commands were executed.
        allowed = {"route", "ipconfig", "netstat", "tasklist", "netsh", "powershell", "arp"}
        self.assertTrue({c[0] for c in calls} <= allowed, calls)

    def test_public_mode_dry_run_with_api_does_not_upload(self):
        code, _payload, _calls = self.run_public("--dry-run", "--api", "https://api.exemplo.test", "--token", "x")
        self.assertEqual(code, scanner.EXIT_OK)


# ---------------------------------------------------------------------------
# Upload and CLI
# ---------------------------------------------------------------------------

class UploadTests(unittest.TestCase):
    def test_validate_api_url(self):
        self.assertEqual(scanner.validate_api_url("https://api.exemplo.test/"), "https://api.exemplo.test")
        self.assertEqual(scanner.validate_api_url("http://localhost:3333"), "http://localhost:3333")
        self.assertEqual(scanner.validate_api_url("http://127.0.0.1:3333/api"), "http://127.0.0.1:3333/api")
        for bad in ("http://api.exemplo.test", "ftp://x", "api.exemplo.test", "https://u:p@api.test", ""):
            with self.assertRaises(ValueError, msg=bad):
                scanner.validate_api_url(bad)

    def test_upload_request(self):
        captured = {}

        class FakeResponse:
            status = 201

            def read(self, n=-1):
                return b'{"ok":true}'

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        class FakeOpener:
            def open(self, request, timeout=None):
                captured["request"] = request
                captured["timeout"] = timeout
                return FakeResponse()

        with mock.patch.object(scanner, "_build_opener", return_value=FakeOpener()):
            status, body = scanner.upload_payload({"mode": "public"}, "https://api.exemplo.test/", "tok123")
        request = captured["request"]
        self.assertEqual((status, body), (201, '{"ok":true}'))
        self.assertEqual(request.full_url, "https://api.exemplo.test/network/scans")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Content-type"), "application/json")
        self.assertEqual(request.get_header("X-pairing-token"), "tok123")
        self.assertEqual(captured["timeout"], 15.0)
        self.assertEqual(json.loads(request.data), {"mode": "public"})

    def test_cli_rejects_insecure_api_and_missing_token(self):
        with quiet(), self.assertRaises(SystemExit):
            scanner.main(["--mode", "public", "--api", "http://api.exemplo.test", "--token", "x"])
        with quiet(), mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(scanner.TOKEN_ENV_VAR, None)
            with self.assertRaises(SystemExit):
                scanner.main(["--mode", "public", "--api", "https://api.exemplo.test"])

    def test_version(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), self.assertRaises(SystemExit) as ctx:
            scanner.main(["--version"])
        self.assertEqual(ctx.exception.code, 0)
        self.assertEqual(out.getvalue().strip(), "0.1.0")


if __name__ == "__main__":
    unittest.main()
