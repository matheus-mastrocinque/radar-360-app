#!/usr/bin/env python3
"""Radar360 - local network audit agent (Hack Brasil 2026).

Two modes:

* ``home``   - audits the user's OWN home network. Shows the detected network
               and only probes after explicit consent (typing ``SIM`` or the
               ``--confirmo-rede-propria`` flag). RFC1918 networks only, at most
               a /24, gentle timeouts and a global time cap.
* ``public`` - audits only this computer and its own connection using local OS
               commands. It never sends a packet to any other host; the only
               network traffic is the optional upload to the Radar360 API.

Allowed network actions (home mode only, after consent): TCP connect checks,
passively reading the banner a service sends on connect, one plain ``GET /``
(max 4 KB) on HTTP ports, SSDP M-SEARCH, fetching the UPnP device description
from a LOCATION inside the scanned subnet and listing the router's UPnP port
mappings (``GetGenericPortMappingEntry``). Nothing else: no logins, no
passwords, no exploits, no fuzzing.

Fix mode (``--corrigir``): after the audit, the agent offers safe fixes for
THIS computer (firewall, network profile, file sharing, Remote Desktop, port
block rule) and for the user's OWN router (removing UPnP port mappings with
``DeletePortMapping``). Each fix shows what changes, the exact command, the
risk and how to undo it, and is applied only after the user types ``SIM``.
There is no way to apply everything at once. Every applied fix is written to a
local journal so ``--desfazer`` can revert it (``AddPortMapping`` is used only
to undo a removed mapping). ``--simular`` shows the fixes without applying.

Standard library only. Python 3.11+. Windows, macOS and Linux.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import dataclasses
import datetime as _dt
import html
import http.client
import io
import ipaddress
import json
import os
import platform
import re
import shlex
import socket
import struct
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request

AGENT_VERSION = "0.1.0"
USER_AGENT = f"Radar360-LocalAgent/{AGENT_VERSION}"
TOKEN_ENV_VAR = "RADAR360_PAIRING_TOKEN"

# --- Exit codes -------------------------------------------------------------
EXIT_OK = 0
EXIT_REFUSED = 1
EXIT_UPLOAD_FAILED = 3
EXIT_FIX_FAILED = 4  # --desfazer: at least one undo failed or was skipped

# --- Home-mode scan limits ---------------------------------------------------
HOME_PORTS = (
    21, 22, 23, 53, 80, 139, 443, 445, 554, 1883,
    3389, 5000, 5900, 7547, 8000, 8080, 8443, 8888, 9100, 49152,
)
HTTP_PORTS = frozenset({80, 8000, 8080, 8888})
BANNER_PORTS = frozenset({21, 22, 23, 5900})  # services that talk first
MAX_THREADS = 64
MIN_SCAN_PREFIX = 24  # never scan more than a /24 (254 hosts)
CONNECT_TIMEOUT = 0.4
BANNER_TIMEOUT = 1.5
HTTP_TIMEOUT = 2.0
HTTP_READ_LIMIT = 4096
GLOBAL_TIME_CAP = 120.0
SSDP_GROUP = ("239.255.255.250", 1900)
SSDP_WAIT = 3.0
DESCRIPTION_READ_LIMIT = 64 * 1024
DESCRIPTION_TIMEOUT = 3.0
MAX_DESCRIPTION_FETCHES = 32

# --- UPnP IGD: the user's own router (home mode, after consent) --------------
UPNP_TIMEOUT = 3.0
UPNP_READ_LIMIT = 16 * 1024
MAX_UPNP_MAPPINGS = 64       # GetGenericPortMappingEntry index cap
MAX_IGD_SERVICES = 4
UPNP_RELIST_CAP = 30.0       # time cap for listing mappings again after fixes
UPNP_ALLOWED_ACTIONS = frozenset({"GetGenericPortMappingEntry", "DeletePortMapping", "AddPortMapping"})
UPNP_SENSITIVE_PORTS = frozenset({23, 22, 3389, 445, 139, 5900, 1883, 3306, 5432, 6379, 27017, 7547})
_WAN_SERVICE_RE = re.compile(
    r"^urn:schemas-upnp-org:service:(?:WANIPConnection|WANPPPConnection):[12]$"
)

# --- Local commands / upload -------------------------------------------------
CMD_TIMEOUT = 10.0
POWERSHELL_TIMEOUT = 20.0
UPLOAD_TIMEOUT = 15.0
FIX_CMD_TIMEOUT = 120.0  # the Windows firewall cmdlets can take 15-40 s just to load

# --- Fixes (always one at a time, each confirmed with SIM) -------------------
MAX_FIXES = 50
MAX_FIX_TITLE = 200
FIX_TARGETS = ("computer", "router")
JOURNAL_VERSION = 1
SMB_RULE_GROUP = "@FirewallAPI.dll,-28502"  # "File and Printer Sharing" in any Windows language
BLOCK_RULE_PREFIX = "Olharium-Block-TCP-"
RDP_KEY = r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server"
MACOS_SOCKETFILTERFW = "/usr/libexec/ApplicationFirewall/socketfilterfw"

# --- Payload contract limits -------------------------------------------------
MAX_DEVICES = 256
MAX_FINDINGS = 500
MAX_STRING = 500
MAX_KIND = 64
MAX_SERVICES_PER_DEVICE = 64
SEVERITIES = ("info", "low", "medium", "high", "critical")
SEVERITY_RANK = {name: rank for rank, name in enumerate(SEVERITIES)}
VALID_OS = ("windows", "macos", "linux")
VALID_MODES = ("home", "public")

RFC1918_NETWORKS = tuple(
    ipaddress.IPv4Network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)
CGNAT_NETWORK = ipaddress.IPv4Network("100.64.0.0/10")

SERVICE_NAMES = {
    21: "ftp", 22: "ssh", 23: "telnet", 53: "dns", 80: "http", 135: "msrpc",
    139: "netbios-ssn", 443: "https", 445: "smb", 554: "rtsp", 1433: "mssql",
    1883: "mqtt", 3000: "http-dev", 3306: "mysql", 3389: "rdp", 5000: "upnp-http",
    5173: "vite-dev", 5432: "postgresql", 5900: "vnc", 6379: "redis",
    7547: "tr-069", 8000: "http-alt", 8080: "http-alt", 8443: "https-alt",
    8888: "http-alt", 9100: "jetdirect", 27017: "mongodb", 49152: "upnp",
}

SEVERITY_LABEL = {
    "critical": "CRÍTICO", "high": "ALTO", "medium": "MÉDIO", "low": "BAIXO", "info": "INFO",
}
OS_LABEL = {"windows": "Windows", "macos": "macOS", "linux": "Linux"}
PROFILE_LABEL = {"domain": "Domínio", "private": "Privado", "public": "Público"}


# =============================================================================
# Small helpers
# =============================================================================

def log(message: str) -> None:
    """Progress messages go to stderr so --json keeps stdout clean."""
    print(message, file=sys.stderr, flush=True)


def now_iso() -> str:
    return (
        _dt.datetime.now(_dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def detect_os() -> str:
    system = platform.system().lower()
    if system.startswith("win"):
        return "windows"
    if system == "darwin":
        return "macos"
    return "linux"


def get_hostname() -> str:
    try:
        return socket.gethostname() or "desconhecido"
    except OSError:
        return "desconhecido"


def _is_ipv4(value: str | None) -> bool:
    if not value:
        return False
    try:
        ipaddress.IPv4Address(value)
        return True
    except ValueError:
        return False


def _ip_sort_key(value: str):
    try:
        return (0, int(ipaddress.IPv4Address(value)))
    except ValueError:
        return (1, value)


def _decode_output(data: bytes) -> str:
    if not data:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        pass
    if os.name == "nt":
        for encoding in ("oem", "mbcs"):
            try:
                return data.decode(encoding)
            except (LookupError, UnicodeDecodeError):
                continue
    return data.decode("latin-1", errors="replace")


def _subprocess_kwargs() -> dict:
    kwargs: dict = {}
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    else:
        env = dict(os.environ)
        env["LC_ALL"] = "C"
        env["LANG"] = "C"
        kwargs["env"] = env
    return kwargs


def run_cmd(cmd: list[str], timeout: float = CMD_TIMEOUT) -> str | None:
    """Run a local, read-only OS command. Never raises: returns None on failure."""
    kwargs = _subprocess_kwargs()
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            timeout=timeout,
            check=False,
            **kwargs,
        )
    except (OSError, subprocess.SubprocessError, ValueError):
        return None
    output = _decode_output(proc.stdout)
    if proc.returncode != 0 and not output.strip():
        return None
    return output


def run_change_cmd(cmd: list[str], timeout: float = FIX_CMD_TIMEOUT) -> tuple[int | None, str]:
    """Run a command that CHANGES the system. Only called for a fix/undo the user confirmed."""
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            timeout=timeout,
            check=False,
            **_subprocess_kwargs(),
        )
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return None, str(exc)
    output = (_decode_output(proc.stdout) + "\n" + _decode_output(proc.stderr)).strip()
    return proc.returncode, output


def read_text_file(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return None


# =============================================================================
# Probe authorization guard (defense in depth)
# =============================================================================

class ProbeNotAuthorized(RuntimeError):
    """Raised when a network probe is attempted without recorded consent."""


_probe_scope: ipaddress.IPv4Network | None = None


def _authorize_probes(network: ipaddress.IPv4Network) -> None:
    global _probe_scope
    _probe_scope = network


def _revoke_probes() -> None:
    global _probe_scope
    _probe_scope = None


def _require_probe_consent() -> ipaddress.IPv4Network:
    scope = _probe_scope
    if scope is None:
        raise ProbeNotAuthorized(
            "Sondagem de rede bloqueada: não há consentimento registrado (modo casa)."
        )
    return scope


def _check_probe_target(ip: str) -> None:
    scope = _require_probe_consent()
    try:
        address = ipaddress.IPv4Address(ip)
    except ValueError as exc:
        raise ProbeNotAuthorized(f"Endereço inválido para sondagem: {ip!r}") from exc
    if address not in scope:
        raise ProbeNotAuthorized(f"{ip} está fora da faixa autorizada ({scope}).")


# =============================================================================
# Network detection (local only, no packets)
# =============================================================================

@dataclasses.dataclass
class NetworkInfo:
    local_ip: str | None = None
    prefix: int | None = None
    gateway: str | None = None
    interface: str | None = None

    @property
    def cidr(self) -> str | None:
        if not self.local_ip or self.prefix is None:
            return None
        try:
            return str(ipaddress.IPv4Network(f"{self.local_ip}/{self.prefix}", strict=False))
        except ValueError:
            return None


def get_local_ip() -> str | None:
    """UDP connect() only asks the OS which route it would use. No packet is sent.

    192.0.2.1 is TEST-NET-1 (RFC 5737), so even in theory nothing real is targeted.
    """
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("192.0.2.1", 9))
        ip = sock.getsockname()[0]
    except OSError:
        return None
    finally:
        if sock is not None:
            sock.close()
    if not _is_ipv4(ip) or ip == "0.0.0.0":
        return None
    return ip


def _netmask_to_prefix(mask: str) -> int | None:
    mask = mask.strip()
    try:
        if mask.lower().startswith("0x"):
            value = int(mask, 16)
            mask = socket.inet_ntoa(struct.pack("!I", value))
        if not mask.startswith("255."):
            return None
        return ipaddress.IPv4Network(f"0.0.0.0/{mask}").prefixlen
    except (ValueError, struct.error, OSError):
        return None


def parse_route_print_windows(text: str, local_ip: str | None) -> tuple[str | None, str | None]:
    """Parse ``route print -4 0.0.0.0``. Returns (gateway, interface_ip)."""
    best = None
    for line in text.splitlines():
        tokens = line.split()
        if len(tokens) < 5 or tokens[0] != "0.0.0.0" or tokens[1] != "0.0.0.0":
            continue
        if not (_is_ipv4(tokens[2]) and _is_ipv4(tokens[3])):
            continue
        metric = int(tokens[4]) if tokens[4].isdigit() else 99999
        candidate = (0 if tokens[3] == local_ip else 1, metric, tokens[2], tokens[3])
        if best is None or candidate < best:
            best = candidate
    if best is None:
        return None, None
    return best[2], best[3]


_IPV4_VALUE_RE = re.compile(r":\s*(\d{1,3}(?:\.\d{1,3}){3})\b")


def parse_ipconfig_netmask(text: str, local_ip: str) -> int | None:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        match = _IPV4_VALUE_RE.search(line)
        if not match or match.group(1) != local_ip:
            continue
        for following in lines[index + 1:index + 4]:
            found = _IPV4_VALUE_RE.search(following)
            if found:
                prefix = _netmask_to_prefix(found.group(1))
                if prefix is not None:
                    return prefix
    return None


_GATEWAY_WORDS = ("gateway", "passerelle", "enlace", "gateway padr")


def parse_ipconfig_gateway(text: str, local_ip: str) -> str | None:
    lines = text.splitlines()
    start = None
    for index, line in enumerate(lines):
        match = _IPV4_VALUE_RE.search(line)
        if match and match.group(1) == local_ip:
            start = index
            break
    if start is None:
        return None
    for index in range(start + 1, min(len(lines), start + 15)):
        line = lines[index]
        if line and not line[0].isspace():
            break  # next adapter section
        if not any(word in line.lower() for word in _GATEWAY_WORDS):
            continue
        for candidate in [line] + lines[index + 1:index + 3]:
            found = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})", candidate)
            if found and _is_ipv4(found.group(1)):
                return found.group(1)
        return None
    return None


def parse_macos_route(text: str) -> tuple[str | None, str | None]:
    gateway = re.search(r"^\s*gateway:\s*(\S+)", text, re.M)
    interface = re.search(r"^\s*interface:\s*(\S+)", text, re.M)
    gw = gateway.group(1) if gateway and _is_ipv4(gateway.group(1)) else None
    return gw, interface.group(1) if interface else None


def parse_ip_route_default(text: str) -> tuple[str | None, str | None]:
    for line in text.splitlines():
        match = re.search(r"\bdefault\s+via\s+(\S+)(?:.*?\bdev\s+(\S+))?", line)
        if match and _is_ipv4(match.group(1)):
            return match.group(1), match.group(2)
    return None, None


def parse_proc_net_route(text: str) -> str | None:
    for line in text.splitlines()[1:]:
        fields = line.split()
        if len(fields) >= 3 and fields[1] == "00000000" and fields[2] != "00000000":
            try:
                return socket.inet_ntoa(struct.pack("<L", int(fields[2], 16)))
            except (ValueError, struct.error, OSError):
                continue
    return None


def parse_ifconfig_prefix(text: str, local_ip: str) -> int | None:
    pattern = rf"inet\s+(?:addr:)?{re.escape(local_ip)}\b.*?(?:netmask|Mask:)\s*(\S+)"
    match = re.search(pattern, text, re.I)
    return _netmask_to_prefix(match.group(1)) if match else None


def parse_ip_addr_prefix(text: str, local_ip: str) -> int | None:
    match = re.search(rf"inet\s+{re.escape(local_ip)}/(\d{{1,2}})\b", text)
    if match:
        prefix = int(match.group(1))
        return prefix if 0 <= prefix <= 32 else None
    return None


def detect_network(os_name: str) -> NetworkInfo:
    """Local IP, prefix and gateway using only local commands."""
    info = NetworkInfo(local_ip=get_local_ip())
    if os_name == "windows":
        routes = run_cmd(["route", "print", "-4", "0.0.0.0"]) or ""
        gateway, interface_ip = parse_route_print_windows(routes, info.local_ip)
        info.gateway = gateway
        if not info.local_ip and interface_ip:
            info.local_ip = interface_ip
        ipconfig = run_cmd(["ipconfig"])
        if ipconfig and info.local_ip:
            info.prefix = parse_ipconfig_netmask(ipconfig, info.local_ip)
            if not info.gateway:
                info.gateway = parse_ipconfig_gateway(ipconfig, info.local_ip)
    elif os_name == "macos":
        gateway, interface = parse_macos_route(run_cmd(["route", "-n", "get", "default"]) or "")
        info.gateway, info.interface = gateway, interface
        ifconfig = run_cmd(["ifconfig"])
        if ifconfig and info.local_ip:
            info.prefix = parse_ifconfig_prefix(ifconfig, info.local_ip)
    else:
        gateway, interface = parse_ip_route_default(
            run_cmd(["ip", "-4", "route", "show", "default"]) or ""
        )
        if not gateway:
            gateway = parse_proc_net_route(read_text_file("/proc/net/route") or "")
        info.gateway, info.interface = gateway, interface
        if info.local_ip:
            info.prefix = parse_ip_addr_prefix(
                run_cmd(["ip", "-o", "-4", "addr", "show"]) or "", info.local_ip
            )
            if info.prefix is None:
                info.prefix = parse_ifconfig_prefix(run_cmd(["ifconfig"]) or "", info.local_ip)
    return info


# =============================================================================
# Network policy (which networks home mode may touch)
# =============================================================================

def classify_ip(value: str | None) -> str:
    """Returns rfc1918 | cgnat | loopback | link_local | non_private | invalid."""
    try:
        ip = ipaddress.IPv4Address(value or "")
    except ValueError:
        return "invalid"
    if ip.is_unspecified or ip.is_multicast:
        return "invalid"
    if ip.is_loopback:
        return "loopback"
    if ip.is_link_local:
        return "link_local"
    if ip in CGNAT_NETWORK:
        return "cgnat"
    if any(ip in network for network in RFC1918_NETWORKS):
        return "rfc1918"
    return "non_private"


def is_rfc1918(value: str | None) -> bool:
    return classify_ip(value) == "rfc1918"


_REFUSAL_MESSAGES = {
    "invalid": "Não foi possível detectar o IP local deste computador.",
    "loopback": "O IP local é de loopback (127.x): não há rede local para analisar.",
    "link_local": (
        "O IP local é link-local (169.254.x): o computador não recebeu endereço do "
        "roteador. Verifique a conexão."
    ),
    "cgnat": (
        "O IP local está na faixa CGNAT (100.64.0.0/10), usada por provedores e "
        "operadoras. Essa rede não é sua, então a análise foi bloqueada."
    ),
    "non_private": (
        "O IP local não é privado. O modo casa só funciona em redes domésticas "
        "privadas (10.x.x.x, 172.16-31.x.x ou 192.168.x.x)."
    ),
}


def check_home_network_allowed(local_ip: str | None) -> tuple[bool, str]:
    kind = classify_ip(local_ip)
    if kind == "rfc1918":
        return True, ""
    return False, _REFUSAL_MESSAGES.get(kind, _REFUSAL_MESSAGES["invalid"])


def compute_scan_network(local_ip: str | None, prefix: int | None) -> ipaddress.IPv4Network | None:
    """Network to scan: the real subnet, but never larger than a /24."""
    if not is_rfc1918(local_ip):
        return None
    if prefix is None:
        prefix = MIN_SCAN_PREFIX
    if prefix >= 31:  # point-to-point / VPN host route: no LAN to scan
        return None
    prefix = max(prefix, MIN_SCAN_PREFIX)
    return ipaddress.IPv4Network(f"{local_ip}/{prefix}", strict=False)


# =============================================================================
# ARP table (local read only)
# =============================================================================

_MAC_RE = re.compile(r"\b((?:[0-9a-fA-F]{1,2}[:-]){5}[0-9a-fA-F]{1,2})\b")
_IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")


def normalize_mac(value: str) -> str | None:
    parts = re.split(r"[:-]", value.strip())
    if len(parts) != 6:
        return None
    try:
        octets = [int(part, 16) for part in parts]
    except ValueError:
        return None
    if any(o > 255 for o in octets):
        return None
    return ":".join(f"{o:02x}" for o in octets)


def _is_unicast_mac(mac: str) -> bool:
    if mac in ("ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00"):
        return False
    return not int(mac.split(":")[0], 16) & 1  # multicast bit


def parse_arp_output(text: str) -> list[tuple[str, str]]:
    """Parse ``arp -a`` (Windows) / ``arp -an`` (macOS, Linux) / ``ip neigh``."""
    entries: list[tuple[str, str]] = []
    seen = set()
    for line in text.splitlines():
        ip_match = _IP_RE.search(line)
        mac_match = _MAC_RE.search(line)
        if not ip_match or not mac_match or not _is_ipv4(ip_match.group(1)):
            continue
        mac = normalize_mac(mac_match.group(1))
        if not mac or not _is_unicast_mac(mac):
            continue
        entry = (ip_match.group(1), mac)
        if entry not in seen:
            seen.add(entry)
            entries.append(entry)
    return entries


def parse_proc_net_arp(text: str) -> list[tuple[str, str]]:
    entries = []
    for line in text.splitlines()[1:]:
        fields = line.split()
        if len(fields) < 4 or fields[2] == "0x0":
            continue
        mac = normalize_mac(fields[3])
        if _is_ipv4(fields[0]) and mac and _is_unicast_mac(mac):
            entries.append((fields[0], mac))
    return entries


def read_arp_table(os_name: str) -> list[tuple[str, str]]:
    if os_name == "linux":
        entries = parse_proc_net_arp(read_text_file("/proc/net/arp") or "")
        if entries:
            return entries
        return parse_arp_output(run_cmd(["ip", "neigh", "show"]) or "")
    if os_name == "macos":
        return parse_arp_output(run_cmd(["arp", "-an"]) or "")  # -n: no reverse DNS
    return parse_arp_output(run_cmd(["arp", "-a"]) or "")


# =============================================================================
# Wi-Fi security (local read only, never triggers a Wi-Fi scan)
# =============================================================================

def parse_netsh_wlan(text: str) -> str | None:
    """Authentication of the connected interface from ``netsh wlan show interfaces``."""
    for line in text.splitlines():
        match = re.match(r"^\s*([^:]+?)\s*:\s*(.*?)\s*$", line)
        if not match:
            continue
        key = match.group(1).strip().lower()
        if key.startswith(("authentication", "autentica", "authentifi", "authentifizierung")):
            return match.group(2)
    return None


def parse_nmcli_wifi(text: str) -> str | None:
    """``nmcli -t -f ACTIVE,SSID,SECURITY dev wifi list``: security of active network."""
    for line in text.splitlines():
        fields = re.split(r"(?<!\\):", line)
        if len(fields) >= 3 and fields[0].strip().lower() in ("yes", "sim", "*"):
            return fields[-1].strip()
    return None


def parse_airport_auth(text: str) -> str | None:
    match = re.search(r"^\s*link auth:\s*(\S+)", text, re.M | re.I)
    return match.group(1) if match else None


def parse_macos_summary_security(text: str) -> str | None:
    match = re.search(r"^\s*Security\s*:\s*(\S+)", text, re.M)
    return match.group(1) if match else None


_OPEN_WORDS = {"", "--", "none", "open", "aberta", "aberto", "abierta", "ouvert", "offen", "nenhuma", "nenhum"}


def classify_wifi_security(raw: str | None) -> tuple[str, bool]:
    """Returns (level, enterprise). level: open|wep|wpa|wpa2|wpa3|unknown."""
    if raw is None:
        return "unknown", False
    value = raw.strip().lower()
    enterprise = any(word in value for word in ("enterprise", "802.1x", "eap", "empresa"))
    if value in _OPEN_WORDS:
        return "open", False
    if "wpa3" in value or "sae" in value:
        return "wpa3", enterprise
    if "wpa2" in value or "rsn" in value:
        return "wpa2", enterprise
    if "wep" in value:
        return "wep", False
    if "wpa" in value:
        return "wpa", enterprise
    if any(word in value for word in ("open", "abert", "abiert", "ouvert")):
        return "open", False
    return "unknown", enterprise


def wifi_security_label(raw: str | None) -> str | None:
    if raw is None:
        return None
    level, enterprise = classify_wifi_security(raw)
    if level == "unknown":
        return raw.strip()[:64] or None
    label = {"open": "OPEN", "wep": "WEP", "wpa": "WPA", "wpa2": "WPA2", "wpa3": "WPA3"}[level]
    return f"{label}-Enterprise" if enterprise else label


def get_wifi_security(os_name: str) -> str | None:
    if os_name == "windows":
        out = run_cmd(["netsh", "wlan", "show", "interfaces"])
        return parse_netsh_wlan(out) if out else None
    if os_name == "linux":
        # --rescan no: read the cached state only, never trigger a Wi-Fi scan.
        out = run_cmd(["nmcli", "-t", "-f", "ACTIVE,SSID,SECURITY", "dev", "wifi", "list", "--rescan", "no"])
        return parse_nmcli_wifi(out) if out else None
    airport = (
        "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"
    )
    out = run_cmd([airport, "-I"])
    if out:
        auth = parse_airport_auth(out)
        if auth:
            return auth
    for interface in ("en0", "en1"):
        out = run_cmd(["ipconfig", "getsummary", interface])
        if out:
            security = parse_macos_summary_security(out)
            if security:
                return security
    return None


# =============================================================================
# Listening ports of THIS computer (public mode)
# =============================================================================

@dataclasses.dataclass(frozen=True)
class Listener:
    address: str
    port: int
    pid: int | None = None
    process: str | None = None


def _split_host_port(value: str, dot_port: bool = False) -> tuple[str, int] | None:
    text = value.strip()
    if not text:
        return None
    if text.startswith("["):
        host, _, rest = text[1:].partition("]")
        port = rest[1:] if rest[:1] in (":", ".") else ""
    else:
        host, separator, port = text.rpartition("." if dot_port else ":")
        if not separator:
            return None
    host = host.split("%", 1)[0]
    if not port.isdigit():
        return None
    number = int(port)
    if not 0 < number <= 65535:
        return None
    return host or "*", number


def classify_bind(host: str) -> str:
    """Returns ``all`` (every interface), ``loopback`` or ``specific``."""
    value = host.strip().lower()
    if value in ("*", "", "0.0.0.0", "::", "0:0:0:0:0:0:0:0"):
        return "all"
    if value == "localhost":
        return "loopback"
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return "specific"
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if ip.is_unspecified:
        return "all"
    if ip.is_loopback:
        return "loopback"
    return "specific"


def parse_netstat_windows(text: str) -> list[Listener]:
    """``netstat -ano -p tcp`` / ``-p tcpv6``. Works with localized headers."""
    listeners = []
    for line in text.splitlines():
        tokens = line.split()
        if len(tokens) < 4 or tokens[0].upper() != "TCP":
            continue
        local, remote = tokens[1], tokens[2]
        state = tokens[3].upper() if len(tokens) >= 5 else ""
        # The state column may be localized; a remote port of 0 also means LISTENING.
        if state != "LISTENING" and not remote.endswith(":0"):
            continue
        hp = _split_host_port(local)
        if not hp:
            continue
        pid = int(tokens[-1]) if tokens[-1].isdigit() else None
        listeners.append(Listener(hp[0], hp[1], pid))
    return listeners


def parse_ss_listen(text: str) -> list[Listener]:
    """``ss -tlnH`` (or ``ss -tln``, header skipped)."""
    listeners = []
    for line in text.splitlines():
        tokens = line.split()
        if len(tokens) < 4 or tokens[0].upper() != "LISTEN":
            continue
        hp = _split_host_port(tokens[3])
        if not hp:
            continue
        process = re.search(r'users:\(\("([^"]+)",pid=(\d+)', line)
        listeners.append(
            Listener(
                hp[0], hp[1],
                int(process.group(2)) if process else None,
                process.group(1) if process else None,
            )
        )
    return listeners


def parse_lsof_listen(text: str) -> list[Listener]:
    """``lsof -nP -iTCP -sTCP:LISTEN`` (macOS)."""
    listeners = []
    for line in text.splitlines():
        tokens = line.split()
        if "(LISTEN)" not in tokens:
            continue
        index = tokens.index("(LISTEN)")
        if index < 1:
            continue
        hp = _split_host_port(tokens[index - 1])
        if not hp:
            continue
        pid = int(tokens[1]) if len(tokens) > 1 and tokens[1].isdigit() else None
        listeners.append(Listener(hp[0], hp[1], pid, tokens[0].replace("\\x20", " ")))
    return listeners


def parse_netstat_unix_listen(text: str) -> list[Listener]:
    """Fallback: Linux ``netstat -tln`` (host:port) or BSD/macOS ``netstat -an -p tcp`` (host.port)."""
    listeners = []
    for line in text.splitlines():
        tokens = line.split()
        if len(tokens) < 4 or not tokens[0].lower().startswith("tcp") or "LISTEN" not in tokens:
            continue
        local = tokens[3]
        hp = _split_host_port(local)
        if hp is None or (":" not in local and "." in local):
            hp = _split_host_port(local, dot_port=True)
        if hp:
            listeners.append(Listener(hp[0], hp[1]))
    return listeners


def parse_tasklist_csv(text: str) -> dict[int, str]:
    names: dict[int, str] = {}
    for row in csv.reader(io.StringIO(text)):
        if len(row) >= 2 and row[1].strip().isdigit():
            names[int(row[1].strip())] = row[0].strip()
    return names


def get_listening_ports(os_name: str) -> list[Listener] | None:
    """Returns None when no command could be read (unknown)."""
    if os_name == "windows":
        outputs = [run_cmd(["netstat", "-ano", "-p", proto]) for proto in ("tcp", "tcpv6")]
        if not any(outputs):
            return None
        listeners = [item for out in outputs if out for item in parse_netstat_windows(out)]
        names = parse_tasklist_csv(run_cmd(["tasklist", "/FO", "CSV", "/NH"]) or "") if listeners else {}
        return [dataclasses.replace(l, process=names.get(l.pid)) if l.pid in names else l for l in listeners]
    if os_name == "macos":
        out = run_cmd(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"])
        if out is not None:
            return parse_lsof_listen(out)
        out = run_cmd(["netstat", "-an", "-p", "tcp"])
        return parse_netstat_unix_listen(out) if out is not None else None
    out = run_cmd(["ss", "-tlnH"])
    if out is None:
        out = run_cmd(["ss", "-tln"])
    if out is not None:
        return parse_ss_listen(out)
    out = run_cmd(["netstat", "-tln"])
    return parse_netstat_unix_listen(out) if out is not None else None


# =============================================================================
# Firewall and network profile (local read only)
# =============================================================================

@dataclasses.dataclass
class FirewallStatus:
    enabled: bool | None  # None = unknown / partial
    off_profiles: list[str] = dataclasses.field(default_factory=list)
    source: str = ""


_ON_WORDS = {"on", "ligado", "ativado", "ativo", "activado", "activé", "active", "ein", "aktiviert", "attivato"}
_OFF_WORDS = {
    "off", "desligado", "desativado", "inativo", "desactivado", "désactivé", "inactive",
    "aus", "deaktiviert", "disattivato",
}


def _on_off(word: str) -> bool | None:
    value = word.strip().lower()
    if value in _OFF_WORDS:
        return False
    if value in _ON_WORDS:
        return True
    return None


def parse_netsh_firewall(text: str) -> dict[str, bool]:
    """``netsh advfirewall show allprofiles state`` -> {domain, private, public: bool}."""
    order = ("domain", "private", "public")
    result: dict[str, bool] = {}
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or set(line) <= {"-", "="}:
            continue
        parts = re.split(r"\s{2,}", line)
        if len(parts) >= 2:
            value = _on_off(parts[-1])
            if value is not None:
                key = current if current and current not in result else next(
                    (k for k in order if k not in result), None
                )
                if key:
                    result[key] = value
                current = None
                continue
        low = line.lower()
        if "dom" in low:
            current = "domain"
        elif "priv" in low or "particular" in low:
            current = "private"
        elif "blic" in low or "öffentlich" in low:
            current = "public"
    return result


def parse_socketfilterfw(text: str) -> bool | None:
    match = re.search(r"State\s*=\s*(\d)", text)
    if match:
        return match.group(1) != "0"
    low = text.lower()
    if "disabled" in low:
        return False
    if "enabled" in low:
        return True
    return None


def parse_ufw_status(text: str) -> bool | None:
    match = re.search(r"status:\s*(\w+)", text, re.I)
    if not match:
        return None
    return {"active": True, "inactive": False}.get(match.group(1).lower())


def parse_firewalld_state(text: str) -> bool | None:
    value = text.strip().lower()
    if value == "running":
        return True
    if value == "not running":
        return False
    return None


def summarize_windows_firewall(profiles: dict[str, bool], active: set[str]) -> FirewallStatus:
    if not profiles:
        return FirewallStatus(None, [], "netsh")
    off = [p for p in ("domain", "private", "public") if profiles.get(p) is False]
    if not off:
        return FirewallStatus(True, [], "netsh")
    relevant = [profiles[c] for c in active if c in profiles]
    if relevant and any(v is False for v in relevant):
        enabled: bool | None = False
    elif relevant and all(v is True for v in relevant):
        enabled = True
    elif len(off) == len(profiles):
        enabled = False
    else:
        enabled = None
    return FirewallStatus(enabled, off, "netsh")


def parse_connection_profiles(text: str) -> list[dict]:
    """``Get-NetConnectionProfile | Select-Object Name,NetworkCategory | ConvertTo-Json``."""
    mapping = {
        "0": "public", "1": "private", "2": "domain", "public": "public", "private": "private",
        "domainauthenticated": "domain", "domain": "domain",
    }
    try:
        data = json.loads(text.strip().lstrip("﻿"))
    except (ValueError, AttributeError):
        return []
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        return []
    profiles = []
    for item in data:
        if not isinstance(item, dict):
            continue
        category = mapping.get(str(item.get("NetworkCategory")).strip().lower())
        profile = {"name": str(item.get("Name") or ""), "category": category}
        index = item.get("InterfaceIndex")
        if isinstance(index, int) and not isinstance(index, bool) and 0 < index < 1_000_000:
            profile["index"] = index
        if item.get("InterfaceAlias"):
            profile["alias"] = str(item["InterfaceAlias"])[:64]
        profiles.append(profile)
    return profiles


def get_connection_profiles(os_name: str) -> list[dict]:
    if os_name != "windows":
        return []
    out = run_cmd(
        [
            "powershell", "-NoProfile", "-NonInteractive", "-Command",
            "Get-NetConnectionProfile | Select-Object Name,InterfaceAlias,InterfaceIndex,NetworkCategory "
            "| ConvertTo-Json",
        ],
        timeout=POWERSHELL_TIMEOUT,
    )
    return parse_connection_profiles(out) if out else []


# --- Windows firewall rules relevant to the fixes (read only) ----------------

@dataclasses.dataclass
class WindowsFirewallRules:
    known: bool = False
    blocked_ports: set[int] = dataclasses.field(default_factory=set)  # enabled Olharium block rules
    smb_public_rules: list[dict] = dataclasses.field(default_factory=list)  # enabled, apply to Public
    smb_unreadable: int = 0  # rules whose name could not be validated


_RULE_NAME_RE = re.compile(r"^[A-Za-z0-9_.{}\-]{1,128}$")
_BLOCK_RULE_RE = re.compile(rf"^{re.escape(BLOCK_RULE_PREFIX)}(\d{{1,5}})$")
_RULES_MARKER = "OLHARIUM-FW-RULES"
_PROFILE_BITS = {"domain": 1, "private": 2, "public": 4}

# Read only, fast and language independent: the local firewall rule store in the registry
# (one value per rule: name = rule ID, data = "v2.x|Action=..|Active=..|Dir=..|Profile=..|
# LPort=..|Name=..|EmbedCtxt=<group>|", grammar documented in [MS-GPFAS]). The NetSecurity
# cmdlets would take 15-40 s just to load on some machines.
_FIREWALL_RULES_SCRIPT = (
    "$k = Get-Item -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters"
    "\\FirewallPolicy\\FirewallRules'; "
    f"'{_RULES_MARKER}'; "
    "foreach ($n in $k.GetValueNames()) { $v = [string]$k.GetValue($n); "
    f"if ($n -like '{BLOCK_RULE_PREFIX}*' -or $v -like '*|EmbedCtxt={SMB_RULE_GROUP}|*') "
    "{ $n + \"`t\" + $v } }"
)


def parse_firewall_rule_data(data: str) -> dict:
    """``v2.33|Action=Allow|Active=TRUE|Dir=In|Profile=Private|...`` -> fields (Profile as a bitmask)."""
    fields: dict = {"profiles": 0}
    for part in data.split("|"):
        key, separator, value = part.partition("=")
        if not separator:
            continue
        if key == "Profile":
            fields["profiles"] |= _PROFILE_BITS.get(value.strip().lower(), 0)
        elif key not in fields:
            fields[key] = value
    return fields


def parse_windows_firewall_rules(text: str) -> WindowsFirewallRules:
    lines = (text or "").lstrip("﻿").splitlines()
    if not lines or lines[0].strip() != _RULES_MARKER:
        return WindowsFirewallRules()
    result = WindowsFirewallRules(known=True)
    for line in lines[1:]:
        name, separator, data = line.partition("\t")
        if not separator:
            continue
        name = name.strip()
        fields = parse_firewall_rule_data(data)
        active = fields.get("Active", "").upper() == "TRUE"
        inbound = fields.get("Dir", "").lower() == "in"
        block = _BLOCK_RULE_RE.match(name)
        if block:
            port = int(block.group(1))
            if active and inbound and fields.get("Action", "").lower() == "block" and 1 <= port <= 65535:
                result.blocked_ports.add(port)
            continue
        if fields.get("EmbedCtxt") != SMB_RULE_GROUP or not active or not inbound:
            continue
        profiles = fields["profiles"]  # 0 = every profile
        if profiles and not profiles & _PROFILE_BITS["public"]:
            continue
        if not _RULE_NAME_RE.match(name):
            result.smb_unreadable += 1
            continue
        label = fields.get("Name", "")
        if not label or label.startswith("@"):  # indirect resource string: show the rule ID
            label = name
        port = fields.get("LPort")
        result.smb_public_rules.append({
            "name": name,
            "displayName": (label + (f" (porta {port})" if port else ""))[:120],
            "profile": profiles,
        })
    return result


def get_windows_firewall_rules(os_name: str) -> WindowsFirewallRules:
    if os_name != "windows":
        return WindowsFirewallRules()
    out = run_cmd(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", _FIREWALL_RULES_SCRIPT],
        timeout=POWERSHELL_TIMEOUT,
    )
    return parse_windows_firewall_rules(out) if out else WindowsFirewallRules()


def compute_blocked_ports(
    firewall: FirewallStatus, rules: WindowsFirewallRules, active_categories: set[str]
) -> dict[int, str]:
    """Ports whose inbound traffic the firewall blocks, with the reason (Windows only)."""
    if firewall.enabled is not True or not rules.known:
        return {}
    blocked = {
        port: f"a regra de bloqueio 'Olharium: bloqueio da porta {port}' do firewall impede "
              "conexões de entrada"
        for port in rules.blocked_ports
    }
    if active_categories == {"public"} and not rules.smb_public_rules and not rules.smb_unreadable:
        for port in (445, 139):
            blocked.setdefault(
                port,
                "as regras de 'Compartilhamento de arquivos e impressoras' do firewall estão "
                "desativadas no perfil Público, que é o perfil da rede atual",
            )
    return blocked


def get_firewall_status(os_name: str, active_categories: set[str] | None = None) -> FirewallStatus:
    if os_name == "windows":
        out = run_cmd(["netsh", "advfirewall", "show", "allprofiles", "state"])
        profiles = parse_netsh_firewall(out) if out else {}
        return summarize_windows_firewall(profiles, active_categories or set())
    if os_name == "macos":
        out = run_cmd(["/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate"])
        return FirewallStatus(parse_socketfilterfw(out) if out else None, [], "socketfilterfw")
    out = run_cmd(["ufw", "status"])
    state = parse_ufw_status(out) if out else None
    if state is not None:
        return FirewallStatus(state, [], "ufw")
    out = run_cmd(["firewall-cmd", "--state"])
    state = parse_firewalld_state(out) if out else None
    return FirewallStatus(state, [], "firewalld" if state is not None else "")


# =============================================================================
# Findings
# =============================================================================

def make_finding(
    severity: str,
    kind: str,
    title: str,
    detail: str,
    recommendation: str,
    device_ip: str | None = None,
    port: int | None = None,
) -> dict:
    return {
        "severity": severity,
        "kind": kind,
        "title": title,
        "detail": detail,
        "recommendation": recommendation,
        "deviceIp": device_ip,
        "port": port,
    }


def bump_severity(severity: str) -> str:
    rank = min(SEVERITY_RANK.get(severity, 0) + 1, SEVERITY_RANK["high"])
    return SEVERITIES[rank]


def sort_findings(findings: list[dict]) -> list[dict]:
    return sorted(findings, key=lambda f: -SEVERITY_RANK.get(f.get("severity"), 0))


# --- Public mode: services listening on this computer ------------------------

_REC_SMB = (
    "Em rede pública, marque a conexão como 'Rede pública' no Windows (Configurações > "
    "Rede e Internet > propriedades da rede) e desative 'Compartilhamento de arquivos e "
    "impressoras'. Se nunca compartilha pastas, desative o serviço 'Servidor' (LanmanServer)."
)
_REC_RDP = (
    "Desative a Área de Trabalho Remota se não usa (Configurações > Sistema > Área de "
    "Trabalho Remota). Se precisar dela, exija NLA, use senha forte e acesse só por VPN."
)
_REC_SSH = (
    "Se não precisa de acesso remoto, desligue o servidor SSH. Se precisar, use apenas "
    "chaves (PasswordAuthentication no) e limite o acesso no firewall."
)
_REC_VNC = (
    "Desative o compartilhamento de tela/VNC quando não estiver usando, ou faça-o ouvir só "
    "em 127.0.0.1 e acesse por túnel SSH/VPN, com senha forte."
)
_REC_DB = (
    "Configure o banco para ouvir apenas em 127.0.0.1 (ex.: listen_addresses='localhost' no "
    "PostgreSQL, bind-address=127.0.0.1 no MySQL, 'bind 127.0.0.1' no Redis, bindIp no "
    "MongoDB) e use senha forte."
)
_REC_DEV = (
    "Em rede pública, inicie o servidor de desenvolvimento ligado só a localhost (ex.: sem "
    "--host 0.0.0.0 no Vite/Next, 127.0.0.1 no Django/Flask/Node) ou pare-o quando não usar."
)

PUBLIC_PORT_RULES: dict[int, tuple[str, str, str, str]] = {
    445: ("smb", "medium", "Compartilhamento de arquivos SMB", _REC_SMB),
    139: ("smb", "medium", "Compartilhamento NetBIOS/SMB", _REC_SMB),
    3389: ("rdp", "medium", "Acesso remoto RDP (Área de Trabalho Remota)", _REC_RDP),
    22: ("ssh", "low", "Servidor SSH", _REC_SSH),
    5900: ("vnc", "high", "Compartilhamento de tela VNC", _REC_VNC),
    5432: ("database", "medium", "Banco de dados PostgreSQL", _REC_DB),
    3306: ("database", "medium", "Banco de dados MySQL/MariaDB", _REC_DB),
    27017: ("database", "medium", "Banco de dados MongoDB", _REC_DB),
    6379: ("database", "medium", "Banco de dados Redis", _REC_DB),
    1433: ("database", "medium", "Banco de dados SQL Server", _REC_DB),
    3000: ("dev_server", "low", "Servidor de desenvolvimento na porta 3000", _REC_DEV),
    5173: ("dev_server", "low", "Servidor de desenvolvimento Vite (porta 5173)", _REC_DEV),
    8000: ("dev_server", "low", "Servidor web de desenvolvimento na porta 8000", _REC_DEV),
    8080: ("dev_server", "low", "Servidor web/proxy na porta 8080", _REC_DEV),
}


def _process_text(items: list[Listener]) -> str:
    names = sorted({f"{l.process} (PID {l.pid})" if l.pid is not None else l.process
                    for l in items if l.process})
    if not names:
        pids = sorted({l.pid for l in items if l.pid is not None})
        return f" Processo: PID {', '.join(map(str, pids))}." if pids else ""
    return f" Programa: {', '.join(names)}."


def build_listener_findings(
    listeners: list[Listener],
    firewall_enabled: bool | None,
    blocked: dict[int, str] | None = None,
) -> list[dict]:
    """``blocked`` maps ports the firewall verifiably blocks to the reason (see compute_blocked_ports)."""
    blocked = blocked or {}
    exposed: dict[int, list[Listener]] = {}
    for listener in listeners:
        if classify_bind(listener.address) != "loopback":
            exposed.setdefault(listener.port, []).append(listener)

    if firewall_enabled is False:
        exposure = "provavelmente exposto"
        firewall_text = (
            "O firewall está desativado, então outros aparelhos desta rede provavelmente "
            "conseguem se conectar a ele."
        )
    elif firewall_enabled is True:
        exposure = "pode estar exposto"
        firewall_text = (
            "O firewall está ativo: o acesso só acontece se existir uma regra liberando esta "
            "porta, por isso vale conferir."
        )
    else:
        exposure = "pode estar exposto"
        firewall_text = "Não foi possível confirmar o estado do firewall."

    findings = []
    others = []
    for port in sorted(exposed):
        items = exposed[port]
        rule = PUBLIC_PORT_RULES.get(port)
        if port in blocked:
            subject = rule[2] if rule else f"Serviço na porta {port}"
            findings.append(make_finding(
                "info", "port_blocked_by_firewall", f"{subject} bloqueado pelo firewall (porta {port})",
                f"A porta {port}/TCP continua aberta neste computador.{_process_text(items)} Mas "
                f"{blocked[port]}: outros aparelhos da rede não conseguem se conectar, a menos que "
                "outra regra do firewall libere essa porta.",
                "Mantenha o firewall ligado. Se a correção foi feita pelo agente e você precisar do "
                "acesso de novo, use 'python scanner.py --desfazer'.",
                None, port,
            ))
            continue
        if rule is None:
            others.append((port, items))
            continue
        key, base_severity, subject, recommendation = rule
        severity = bump_severity(base_severity) if firewall_enabled is False else base_severity
        if any(classify_bind(l.address) == "all" for l in items):
            where = "em todas as interfaces de rede"
        else:
            where = "no endereço " + ", ".join(sorted({l.address for l in items}))
        detail = (
            f"A porta {port}/TCP deste computador aceita conexões {where}.{_process_text(items)} "
            f"{firewall_text}"
        )
        findings.append(make_finding(
            severity, f"exposed_{key}", f"{subject} {exposure} (porta {port})",
            detail, recommendation, None, port,
        ))

    if others:
        listed = []
        for port, items in others[:20]:
            procs = sorted({l.process for l in items if l.process})
            listed.append(f"{port} ({', '.join(procs)})" if procs else str(port))
        extra = f" e mais {len(others) - 20}" if len(others) > 20 else ""
        findings.append(make_finding(
            "info", "exposed_other_ports", "Outras portas aceitando conexões da rede",
            f"Portas TCP abertas para a rede: {', '.join(listed)}{extra}. Muitas são do próprio "
            f"sistema operacional. {firewall_text}",
            "Confira se reconhece esses programas e feche os que não usa. Em rede pública, "
            "mantenha o firewall ativo e a rede marcada como pública.",
        ))
    return findings


def build_firewall_finding(status: FirewallStatus, os_name: str) -> dict:
    how = {
        "windows": "Abra 'Segurança do Windows' > 'Firewall e proteção de rede' e ative o "
                   "firewall nos perfis Domínio, Privado e Público.",
        "macos": "Abra Ajustes do Sistema > Rede > Firewall e ative-o.",
        "linux": "Ative o firewall da sua distribuição (ex.: 'sudo ufw enable' no Ubuntu) "
                 "bloqueando conexões de entrada por padrão.",
    }[os_name]
    off_names = ", ".join(PROFILE_LABEL.get(p, p) for p in status.off_profiles)
    if status.enabled is False:
        detail = "O firewall deste computador está desativado"
        detail += f" (perfis desligados: {off_names})." if off_names else "."
        detail += " Qualquer serviço aberto fica acessível para outros aparelhos da mesma rede."
        if os_name == "linux":
            detail += " Obs.: pode existir outro firewall (iptables/nftables) não verificado."
        return make_finding("high", "firewall_disabled", "Firewall desativado", detail, how)
    if status.enabled is True and off_names:
        return make_finding(
            "low", "firewall_profile_disabled", "Firewall desligado em um perfil de rede",
            f"O firewall está ativo na rede atual, mas desligado nos perfis: {off_names}. "
            "Ele ficará desligado se você se conectar a uma rede desse tipo.", how,
        )
    if status.enabled is True:
        return make_finding(
            "info", "firewall_enabled", "Firewall ativo",
            "O firewall do sistema está ativo e bloqueia conexões de entrada não autorizadas.",
            "Mantenha-o ativo e evite criar exceções para programas que você não reconhece.",
        )
    if off_names:
        return make_finding(
            "medium", "firewall_partially_disabled", "Firewall desligado em parte dos perfis",
            f"O firewall está desligado nos perfis: {off_names}. Não foi possível saber qual "
            "perfil está em uso agora.", how,
        )
    return make_finding(
        "info", "firewall_unknown", "Não foi possível verificar o firewall",
        "O estado do firewall não pôde ser lido sem privilégios ou o comando não existe neste "
        "sistema (desconhecido).",
        "Confira manualmente nas configurações de segurança do sistema se o firewall está ativo.",
    )


def build_profile_findings(profiles: list[dict]) -> list[dict]:
    private = [p for p in profiles if p.get("category") == "private"]
    if not private:
        return []
    return [make_finding(
        "medium", "network_marked_private", "Rede atual marcada como Privada no Windows",
        "Você está no modo público (café, hotel, aeroporto, evento), mas o Windows trata "
        f"{'a conexão atual' if len(private) == 1 else f'{len(private)} conexões'} como 'Privada'. "
        "Nesse perfil o Windows libera a descoberta de rede e o compartilhamento de arquivos "
        "para os outros aparelhos conectados.",
        "Vá em Configurações > Rede e Internet > Wi-Fi (ou Ethernet) > propriedades da rede e "
        "escolha 'Rede pública'. Pelo PowerShell como administrador: Set-NetConnectionProfile "
        "-InterfaceAlias 'Wi-Fi' -NetworkCategory Public. O agente só muda isso com --corrigir, "
        "depois que você digita SIM.",
    )]


_IDENTITY_HOSTNAME_RE = re.compile(
    r"(-(?:de|do|da|dos|das)-)"
    r"|('s\b)"
    r"|(s-(?:macbook|mbp|imac|mac|mini|iphone|ipad|air|pro|laptop|notebook|pc|desktop)\b)"
    r"|(^(?:iphone|ipad|macbook|imac|notebook|galaxy|android|pc|desktop|laptop)-(?:de|do|da)(?:-|$))",
    re.IGNORECASE,
)


def hostname_reveals_identity(hostname: str | None) -> bool:
    return bool(hostname and _IDENTITY_HOSTNAME_RE.search(hostname))


def build_hostname_finding(hostname: str | None) -> dict | None:
    if not hostname_reveals_identity(hostname):
        return None
    return make_finding(
        "low", "hostname_reveals_identity", "Nome do computador pode revelar sua identidade",
        f"O nome '{hostname}' é anunciado para a rede (DHCP, compartilhamento, AirDrop/Bonjour) "
        "e parece conter um nome pessoal. Em redes públicas, isso ajuda estranhos a saber de "
        "quem é o aparelho.",
        "Use um nome neutro, sem seu nome (ex.: 'notebook-01'). Windows: Configurações > "
        "Sistema > Sobre > Renomear este PC. macOS: Ajustes > Geral > Sobre > Nome.",
    )


def build_wifi_finding(raw: str | None, mode: str) -> dict | None:
    if raw is None:
        return None
    level, enterprise = classify_wifi_security(raw)
    label = wifi_security_label(raw)
    if level == "open":
        recommendation = (
            "Evite logins e acesso a banco nesta rede; use uma VPN confiável ou o 4G/5G do "
            "celular e acesse apenas sites com HTTPS."
            if mode == "public" else
            "No painel do roteador, ative WPA2-Personal ou WPA3-Personal com uma senha longa."
        )
        return make_finding(
            "high", "wifi_open", "Wi-Fi aberto (sem criptografia)",
            "A rede Wi-Fi atual não usa senha nem criptografia: qualquer pessoa por perto pode "
            "ver o tráfego que não estiver protegido por HTTPS.", recommendation,
        )
    if level == "wep":
        return make_finding(
            "high", "wifi_wep", "Wi-Fi com criptografia WEP (quebrável em minutos)",
            "A rede atual usa WEP, um padrão antigo que pode ser quebrado facilmente.",
            "Trate esta rede como aberta: use VPN ou 4G/5G."
            if mode == "public" else
            "Troque a segurança do roteador para WPA2-Personal ou WPA3-Personal.",
        )
    if level == "wpa":
        return make_finding(
            "medium", "wifi_wpa_legacy", "Wi-Fi com WPA antigo (TKIP)",
            "A rede atual usa a primeira versão do WPA, que tem fraquezas conhecidas.",
            "Prefira redes com WPA2/WPA3 ou use VPN."
            if mode == "public" else
            "Troque a segurança do roteador para WPA2-Personal (AES) ou WPA3-Personal.",
        )
    if level in ("wpa2", "wpa3"):
        if mode == "public":
            detail = (
                f"A rede usa {label}. Em locais públicos a senha é compartilhada com muita "
                "gente, então trate a rede como não confiável mesmo assim."
            )
            recommendation = "Prefira sites com HTTPS e, para dados sensíveis, use VPN ou 4G/5G."
        else:
            detail = f"A rede Wi-Fi usa {label}, um padrão de criptografia atual."
            recommendation = (
                "Mantenha uma senha longa e única; ative WPA3 se todos os aparelhos suportarem."
            )
        return make_finding("info", "wifi_encrypted", f"Wi-Fi protegido ({label})", detail, recommendation)
    return None


def detect_arp_spoofing(entries: list[tuple[str, str]], gateway: str | None) -> dict | None:
    if not gateway:
        return None
    gateway_macs = {mac for ip, mac in entries if ip == gateway}
    if not gateway_macs:
        return None
    others = sorted({ip for ip, mac in entries if mac in gateway_macs and ip != gateway}, key=_ip_sort_key)
    if not others:
        return None
    shown = ", ".join(others[:5]) + (f" e mais {len(others) - 5}" if len(others) > 5 else "")
    return make_finding(
        "medium", "arp_spoofing_suspected", "Possível ARP spoofing na rede",
        f"O endereço físico (MAC) do gateway {gateway} também aparece na tabela ARP para "
        f"{shown}. Isso pode indicar que outro aparelho está se passando pelo roteador para "
        "interceptar o tráfego (ou, mais raramente, uma configuração legítima do roteador).",
        "Em local público, desconecte-se desta rede ou use VPN/4G e evite logins. Em casa, "
        "reinicie o roteador e procure aparelhos desconhecidos conectados.",
        gateway, None,
    )


def build_ip_findings(local_ip: str | None) -> list[dict]:
    if classify_ip(local_ip) == "non_private":
        return [make_finding(
            "medium", "public_ip_direct", "Computador com IP público direto",
            f"Este computador recebeu o IP {local_ip}, que não é de rede privada. Sem roteador "
            "fazendo NAT, serviços abertos podem ficar acessíveis pela Internet.",
            "Mantenha o firewall ativo e feche serviços que não usa; se possível, conecte-se "
            "por trás de um roteador.", local_ip, None,
        )]
    return []


# --- Home mode: devices on the LAN --------------------------------------------

@dataclasses.dataclass
class Device:
    ip: str
    mac: str | None = None
    hostname: str | None = None
    model: str | None = None
    open_ports: set[int] = dataclasses.field(default_factory=set)
    banners: dict[int, str] = dataclasses.field(default_factory=dict)
    http: dict[int, dict] = dataclasses.field(default_factory=dict)
    upnp: bool = False
    upnp_server: str | None = None
    upnp_igd: bool = False
    is_gateway: bool = False
    is_self: bool = False

    def service_banner(self, port: int) -> str | None:
        if port in self.banners:
            return self.banners[port]
        info = self.http.get(port)
        if not info:
            return None
        parts = []
        if info.get("server"):
            parts.append(f"Server: {info['server']}")
        if info.get("title"):
            parts.append(f"Título: {info['title']}")
        if not parts and info.get("status"):
            parts.append(f"HTTP {info['status']}")
        return " | ".join(parts) or None

    def to_payload(self) -> dict:
        ports = sorted(self.open_ports)
        return {
            "ip": self.ip,
            "mac": self.mac,
            "vendor": None,  # OUI lookup happens server-side
            "hostname": self.hostname,
            "model": self.model,
            "openPorts": ports,
            "services": [
                {
                    "port": port,
                    "protocol": "tcp",
                    "name": SERVICE_NAMES.get(port, "unknown"),
                    "banner": self.service_banner(port),
                }
                for port in ports
            ],
        }


_VERSION_RE = re.compile(r"([A-Za-z][A-Za-z0-9+\-]*)[/_ ]v?(\d+(?:\.\d+)+[a-z0-9]*)")
_VERSION_IGNORE = {
    "upnp", "http", "https", "dlnadoc", "rfb", "ssh", "rtsp", "mqtt", "microsoft-httpapi",
    "httpapi", "upnp-device-host", "microsoft-windows", "windows",
}


def extract_versions(text: str | None) -> list[str]:
    if not text:
        return []
    versions = []
    for name, version in _VERSION_RE.findall(text):
        if name.lower() in _VERSION_IGNORE:
            continue
        item = f"{name} {version}"
        if item not in versions:
            versions.append(item)
    return versions


_CAMERA_WORDS = (
    "camera", "câmera", "camara", "ipcam", "ip cam", "webcam", "dvr", "nvr", "hikvision",
    "dahua", "onvif", "foscam", "netwave", "network video", "axis",
)
_ADMIN_WORDS = (
    "login", "admin", "router", "roteador", "gateway", "configura", "setup", "management",
    "gerenciamento", "modem", "web ui", "webui",
)


def _device_text(device: Device) -> str:
    parts = [device.model or "", device.upnp_server or ""]
    parts += list(device.banners.values())
    for info in device.http.values():
        parts += [info.get("server") or "", info.get("title") or ""]
    return " ".join(parts).lower()


def looks_like_camera(device: Device) -> bool:
    text = _device_text(device)
    return 554 in device.open_ports or any(word in text for word in _CAMERA_WORDS)


def build_device_findings(device: Device) -> list[dict]:
    findings = []
    ip = device.ip
    ports = device.open_ports
    who = "O roteador" if device.is_gateway else ("Este computador" if device.is_self else "O dispositivo")
    who_full = f"{who} {ip}"

    def add(severity, kind, title, detail, recommendation, port=None):
        findings.append(make_finding(severity, kind, title, detail, recommendation, ip, port))

    if 23 in ports:
        add("high", "telnet_open", "Telnet aberto (acesso sem criptografia)",
            f"{who_full} aceita conexões Telnet na porta 23. Senhas e comandos trafegam sem "
            "criptografia, e o Telnet é o alvo preferido de botnets como a Mirai.",
            "Desative o Telnet no painel do aparelho (ou peça ao fabricante/provedor). Use SSH "
            "se precisar de acesso remoto e troque a senha padrão.", 23)
    if 5900 in ports:
        add("high", "vnc_open", "Compartilhamento de tela VNC aberto",
            f"{who_full} aceita conexões VNC (porta 5900), que dão controle total da tela. "
            "Muitas instalações usam senhas fracas ou nenhuma.",
            "Desative o VNC se não usa; se usar, exija senha forte e acesse apenas por VPN.", 5900)
    if 445 in ports or 139 in ports:
        port = 445 if 445 in ports else 139
        add("medium", "smb_exposed", "Compartilhamento de arquivos (SMB) exposto na rede",
            f"{who_full} oferece compartilhamento de arquivos SMB/NetBIOS (porta {port}). Pastas "
            "compartilhadas sem senha ficam visíveis para qualquer aparelho da rede, inclusive "
            "convidados.",
            "Compartilhe só o necessário, exija senha, desative o SMBv1 e mantenha o sistema "
            "atualizado. Se não usa, desative o compartilhamento.", port)
    if 3389 in ports:
        add("medium", "rdp_open", "Área de Trabalho Remota (RDP) aberta",
            f"{who_full} aceita conexões de Área de Trabalho Remota (porta 3389).",
            "Desative o RDP se não usa; se usar, ative NLA, senha forte e nunca redirecione a "
            "porta 3389 no roteador para a Internet.", 3389)
    if 21 in ports:
        add("medium", "ftp_open", "FTP aberto (sem criptografia)",
            f"{who_full} oferece FTP (porta 21). Usuário, senha e arquivos trafegam em texto "
            "puro na rede.",
            "Desative o FTP se não usa ou troque por SFTP/FTPS.", 21)
    if 554 in ports:
        add("medium", "rtsp_camera_stream", "Transmissão de câmera (RTSP) acessível na rede",
            f"{who_full} oferece um fluxo de vídeo RTSP (porta 554), típico de câmeras e DVRs. "
            "Se a câmera usar senha fraca ou padrão, qualquer aparelho da rede pode assistir.",
            "Troque a senha padrão da câmera, atualize o firmware e não exponha a porta 554 "
            "para a Internet. Se possível, coloque câmeras numa rede de convidados/IoT separada.", 554)
    if 7547 in ports:
        add("medium", "tr069_open", "Gerenciamento remoto TR-069 aberto",
            f"{who_full} tem a porta 7547 (TR-069/CWMP) aberta, usada por provedores para "
            "gerenciar o roteador remotamente. Falhas nesse serviço já foram exploradas em "
            "ataques em massa.",
            "Confirme com seu provedor se o TR-069 é necessário e mantenha o firmware do "
            "roteador atualizado.", 7547)
    if 1883 in ports:
        add("medium", "mqtt_no_tls", "MQTT sem criptografia (porta 1883)",
            f"{who_full} oferece MQTT sem TLS (porta 1883). Mensagens de automação residencial "
            "trafegam em texto puro e, sem senha, qualquer aparelho pode ler ou enviar comandos.",
            "Exija usuário/senha no broker MQTT e prefira MQTT com TLS (porta 8883).", 1883)
    if 9100 in ports:
        add("low", "printer_raw_port", "Impressora aceita trabalhos sem autenticação",
            f"{who_full} tem a porta 9100 (impressão direta) aberta: qualquer aparelho da rede "
            "pode enviar trabalhos de impressão.",
            "Desative a impressão direta (RAW/JetDirect) se não usa e atualize o firmware.", 9100)

    http_ports = sorted(p for p in ports if p in HTTP_PORTS)
    if http_ports:
        port = http_ports[0]
        info = device.http.get(port) or {}
        title = info.get("title") or ""
        title_text = f" (título da página: '{title}')" if title else ""
        if looks_like_camera(device):
            add("medium", "camera_admin_http", "Painel web de câmera sem HTTPS",
                f"{who_full} exibe um painel web via HTTP na porta {port}{title_text}. Senhas "
                "digitadas nele trafegam sem criptografia.",
                "Troque a senha padrão, atualize o firmware e não redirecione essa porta para a "
                "Internet. Prefira o acesso pelo app oficial do fabricante.", port)
        elif device.is_gateway:
            add("low", "router_admin_http", "Painel do roteador acessível sem HTTPS",
                f"{who_full} exibe o painel de administração via HTTP na porta {port}{title_text}. "
                "A senha do painel trafega sem criptografia na rede local.",
                "Troque a senha padrão do painel por uma forte, desative o 'gerenciamento "
                "remoto' e use HTTPS se o roteador oferecer.", port)
        elif any(word in title.lower() for word in _ADMIN_WORDS):
            add("low", "admin_panel_http", "Painel de administração sem HTTPS",
                f"{who_full} exibe uma página de login/administração via HTTP na porta "
                f"{port}{title_text}.",
                "Troque senhas padrão e prefira acessar o painel apenas quando necessário; "
                "atualize o firmware do aparelho.", port)
        else:
            add("info", "http_service", "Serviço web sem HTTPS",
                f"{who_full} responde a HTTP na porta {port}{title_text}.",
                "Se for um painel de configuração, troque a senha padrão e mantenha o aparelho "
                "atualizado.", port)

    if device.upnp:
        if device.upnp_igd or device.is_gateway:
            add("low", "upnp_enabled", "UPnP ativo no roteador",
                f"{who_full} responde à descoberta UPnP"
                + (" e anuncia o serviço de gateway (IGD)" if device.upnp_igd else "")
                + ". Com isso, programas e aparelhos da rede podem abrir portas para a "
                "Internet automaticamente, sem você saber.",
                "Se não usa consoles/jogos online que dependem disso, desative o UPnP no painel "
                "do roteador (geralmente em 'Avançado' > 'UPnP').")
        else:
            add("low", "upnp_enabled", "Dispositivo anuncia serviços UPnP",
                f"{who_full} responde à descoberta UPnP (SSDP), revelando modelo e serviços "
                "para qualquer aparelho da rede.",
                "É comum em TVs e caixas de som. Desative UPnP/DLNA no aparelho se não usar e "
                "mantenha o firmware atualizado.")

    version_sources: list[tuple[int | None, str]] = []
    for port in sorted(device.banners):
        version_sources.append((port, device.banners[port]))
    for port in sorted(device.http):
        version_sources.append((port, device.http[port].get("server") or ""))
    version_sources.append((None, device.upnp_server or ""))
    versions: list[str] = []
    version_port = None
    for port, text in version_sources:
        for version in extract_versions(text):
            if version not in versions:
                versions.append(version)
                if version_port is None:
                    version_port = port
    if versions:
        add("low", "possibly_outdated_software", "Versão de software exposta: verifique atualização",
            f"{who_full} informou a versão: {', '.join(versions[:3])}. O Radar360 não confirma "
            "se há atualização disponível, mas esse software pode estar possivelmente "
            "desatualizado, e versões antigas costumam ter falhas conhecidas.",
            "Procure 'atualização de firmware' no painel ou app do fabricante e ative "
            "atualizações automáticas, se houver.", version_port)
    return findings


def build_home_findings(devices: list[Device]) -> list[dict]:
    findings = []
    for device in devices:
        findings.extend(build_device_findings(device))
    return findings


def upnp_mapping_is_sensitive(mapping: dict) -> bool:
    return (mapping.get("externalPort") in UPNP_SENSITIVE_PORTS
            or mapping.get("internalPort") in UPNP_SENSITIVE_PORTS)


def build_upnp_mapping_findings(mappings: list[dict]) -> list[dict]:
    """One finding per port the router opened to the Internet through UPnP."""
    findings = []
    for mapping in mappings:
        external, protocol = mapping["externalPort"], mapping["protocol"]
        internal, client = mapping["internalPort"], mapping["internalClient"]
        sensitive = upnp_mapping_is_sensitive(mapping)
        service = SERVICE_NAMES.get(internal) or SERVICE_NAMES.get(external)
        severity = "high" if sensitive else "medium"
        detail = (
            f"O roteador {mapping['routerIp']} encaminha a porta externa {external}/{protocol} da "
            f"Internet para {client}:{internal}" + (f" ({service})" if service else "") + "."
        )
        if mapping.get("remoteHost"):
            detail += f" Só o endereço remoto {mapping['remoteHost']} pode usar essa abertura."
        if mapping.get("description"):
            detail += f" Descrição informada por quem pediu a abertura: '{mapping['description'][:80]}'."
        if mapping.get("enabled", True):
            detail += " Qualquer pessoa na Internet pode tentar se conectar a esse serviço."
        else:
            severity = "low"
            detail += " O mapeamento está cadastrado, mas desativado no roteador."
        if sensitive:
            detail += (" Essa porta é de um serviço muito visado (acesso remoto, banco de dados, "
                       "compartilhamento ou gerenciamento).")
        findings.append(make_finding(
            severity, "upnp_port_mapping",
            f"Porta {external}/{protocol} aberta para a Internet pelo UPnP",
            detail,
            "Se não reconhece essa abertura, feche-a: rode o agente com --corrigir (pede SIM antes) "
            "ou remova no painel do roteador. Para evitar novas aberturas automáticas, desative o "
            "UPnP no roteador.",
            mapping["routerIp"], external,
        ))
    return findings


# =============================================================================
# Home-mode probes (ONLY after consent; every function checks the guard)
# =============================================================================

def tcp_probe(ip: str, port: int, timeout: float = CONNECT_TIMEOUT) -> str:
    """TCP connect check. Returns 'open', 'closed' (host replied RST) or 'filtered'."""
    _check_probe_target(ip)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((ip, port))
        return "open"
    except ConnectionRefusedError:
        return "closed"
    except OSError:
        return "filtered"
    finally:
        sock.close()


def _probe_task(ip: str, port: int, deadline: float) -> str | None:
    if time.monotonic() > deadline:
        return None
    return tcp_probe(ip, port)


def probe_hosts(
    hosts: list[str], ports: tuple[int, ...], deadline: float
) -> tuple[dict[str, set[int]], set[str]]:
    """Returns ({ip: open ports}, alive ips). Concurrency capped at MAX_THREADS."""
    _require_probe_consent()
    for ip in hosts:
        _check_probe_target(ip)
    open_map: dict[str, set[int]] = {}
    alive: set[str] = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as pool:
        futures = {
            pool.submit(_probe_task, ip, port, deadline): (ip, port)
            for ip in hosts for port in ports
        }
        for future in concurrent.futures.as_completed(futures):
            ip, port = futures[future]
            state = future.result()
            if state == "open":
                open_map.setdefault(ip, set()).add(port)
                alive.add(ip)
            elif state == "closed":
                alive.add(ip)
    return open_map, alive


def clean_banner(data: bytes, limit: int = 200) -> str | None:
    if not data:
        return None
    data = re.sub(rb"\xff\xfa.*?\xff\xf0", b"", data, flags=re.S)  # telnet sub-negotiation
    data = re.sub(rb"\xff[\xfb-\xfe][\x00-\xff]", b"", data)  # telnet WILL/WONT/DO/DONT
    data = re.sub(rb"\xff[\x00-\xff]", b"", data)
    text = data.decode("utf-8", errors="replace")
    text = "".join(ch if ch.isprintable() else " " for ch in text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] or None


def grab_banner(ip: str, port: int, timeout: float = BANNER_TIMEOUT) -> str | None:
    """Passive: connect and read what the service sends by itself. Sends nothing."""
    _check_probe_target(ip)
    try:
        with socket.create_connection((ip, port), timeout=CONNECT_TIMEOUT * 2) as sock:
            sock.settimeout(timeout)
            data = sock.recv(1024)
    except OSError:
        return None
    return clean_banner(data)


def parse_http_response(data: bytes) -> dict:
    text = data.decode("utf-8", errors="replace")
    head, _, body = text.partition("\r\n\r\n")
    if not body and "\n\n" in text:
        head, _, body = text.partition("\n\n")
    status_match = re.match(r"HTTP/\d(?:\.\d)?\s+(\d{3})", head)
    server_match = re.search(r"^server:[ \t]*(.+?)\s*$", head, re.I | re.M)
    title_match = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
    title = None
    if title_match:
        title = re.sub(r"\s+", " ", html.unescape(title_match.group(1))).strip()[:120] or None
    return {
        "status": int(status_match.group(1)) if status_match else None,
        "server": server_match.group(1)[:120] if server_match else None,
        "title": title,
    }


def http_probe(ip: str, port: int, timeout: float = HTTP_TIMEOUT) -> dict | None:
    """One plain ``GET /`` without credentials; reads at most 4 KB."""
    _check_probe_target(ip)
    host = ip if port == 80 else f"{ip}:{port}"
    request = (
        f"GET / HTTP/1.0\r\nHost: {host}\r\nUser-Agent: {USER_AGENT}\r\n"
        "Accept: text/html\r\nConnection: close\r\n\r\n"
    ).encode("ascii")
    chunks: list[bytes] = []
    total = 0
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(request)
            while total < HTTP_READ_LIMIT:
                chunk = sock.recv(HTTP_READ_LIMIT - total)
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
    except OSError:
        if not chunks:
            return None
    return parse_http_response(b"".join(chunks)[:HTTP_READ_LIMIT])


def _enrich_one(ip: str, port: int, deadline: float) -> dict | None:
    if time.monotonic() > deadline:
        return None
    if port in HTTP_PORTS:
        info = http_probe(ip, port)
        return {"http": info} if info else None
    banner = grab_banner(ip, port)
    return {"banner": banner} if banner else None


def enrich_services(open_map: dict[str, set[int]], deadline: float) -> dict[tuple[str, int], dict]:
    tasks = [
        (ip, port) for ip, ports in open_map.items() for port in sorted(ports)
        if port in HTTP_PORTS or port in BANNER_PORTS
    ]
    if not tasks:
        return {}
    _require_probe_consent()
    results: dict[tuple[str, int], dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(16, len(tasks))) as pool:
        futures = {pool.submit(_enrich_one, ip, port, deadline): (ip, port) for ip, port in tasks}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                results[futures[future]] = result
    return results


def parse_ssdp_response(data: bytes) -> dict[str, str]:
    text = data.decode("utf-8", errors="replace")
    lines = text.replace("\r\n", "\n").split("\n")
    if not lines or not re.match(r"HTTP/1\.[01]\s+200", lines[0].strip(), re.I):
        return {}
    headers = {}
    for line in lines[1:]:
        key, separator, value = line.partition(":")
        if separator and key.strip():
            headers[key.strip().lower()] = value.strip()
    return headers


def _is_igd(text: str | None) -> bool:
    low = (text or "").lower()
    return any(word in low for word in ("internetgatewaydevice", "wanipconnection", "wanpppconnection"))


def ssdp_discover(local_ip: str, network: ipaddress.IPv4Network, wait: float = SSDP_WAIT) -> dict[str, dict]:
    """Single SSDP M-SEARCH; keeps only replies from inside the scanned subnet."""
    scope = _require_probe_consent()
    message = (
        "M-SEARCH * HTTP/1.1\r\n"
        f"HOST: {SSDP_GROUP[0]}:{SSDP_GROUP[1]}\r\n"
        'MAN: "ssdp:discover"\r\n'
        "MX: 2\r\n"
        "ST: ssdp:all\r\n"
        f"USER-AGENT: {USER_AGENT}\r\n\r\n"
    ).encode("ascii")
    results: dict[str, dict] = {}
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    try:
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)  # stay on the local link
        try:
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(local_ip))
        except OSError:
            pass
        sock.bind((local_ip, 0))
        sock.settimeout(0.5)
        sock.sendto(message, SSDP_GROUP)
        end = time.monotonic() + wait
        while time.monotonic() < end:
            try:
                data, (source, _port) = sock.recvfrom(8192)
            except socket.timeout:
                continue
            except OSError:
                break
            try:
                if ipaddress.IPv4Address(source) not in network or ipaddress.IPv4Address(source) not in scope:
                    continue
            except ValueError:
                continue
            headers = parse_ssdp_response(data)
            if not headers:
                continue
            entry = results.setdefault(source, {"server": None, "locations": [], "igd": False})
            if headers.get("server") and not entry["server"]:
                entry["server"] = headers["server"][:200]
            location = headers.get("location")
            if location and location not in entry["locations"] and len(entry["locations"]) < 4:
                entry["locations"].append(location)
            if _is_igd(headers.get("st")) or _is_igd(headers.get("usn")):
                entry["igd"] = True
    except OSError:
        pass
    finally:
        sock.close()
    return results


def _xml_tag(text: str, tag: str, limit: int = 100) -> str | None:
    match = re.search(rf"<(?:\w+:)?{tag}\b[^>]*>(.*?)</(?:\w+:)?{tag}\s*>", text, re.S | re.I)
    if not match:
        return None
    value = re.sub(r"\s+", " ", html.unescape(match.group(1))).strip()
    return value[:limit] or None


def parse_device_description(xml_text: str) -> dict:
    """Regex extraction (no XML parser): manufacturer, modelName, modelNumber, deviceType."""
    return {
        "manufacturer": _xml_tag(xml_text, "manufacturer"),
        "modelName": _xml_tag(xml_text, "modelName"),
        "modelNumber": _xml_tag(xml_text, "modelNumber"),
        "deviceType": _xml_tag(xml_text, "deviceType"),
    }


def model_from_description(description: dict) -> str | None:
    manufacturer = description.get("manufacturer")
    name = description.get("modelName")
    number = description.get("modelNumber")
    parts: list[str] = [name] if name else []
    if manufacturer and (not name or manufacturer.lower() not in name.lower()):
        parts.insert(0, manufacturer)
    if number and number.lower() not in " ".join(parts).lower():
        parts.append(number)
    return " ".join(parts)[:150] or None


def location_allowed(location: str, network: ipaddress.IPv4Network) -> tuple[str, int, str] | None:
    """Only http:// URLs whose host is a literal IPv4 inside the scanned subnet."""
    try:
        parts = urllib.parse.urlsplit(location)
        port = parts.port or 80
    except ValueError:
        return None
    if parts.scheme.lower() != "http" or not _is_ipv4(parts.hostname):
        return None
    if ipaddress.IPv4Address(parts.hostname) not in network:
        return None
    path = parts.path or "/"
    if parts.query:
        path += "?" + parts.query
    return parts.hostname, port, path


def fetch_device_description(location: str, network: ipaddress.IPv4Network) -> dict | None:
    allowed = location_allowed(location, network)
    if not allowed:
        return None
    host, port, path = allowed
    _check_probe_target(host)
    connection = http.client.HTTPConnection(host, port, timeout=DESCRIPTION_TIMEOUT)  # no proxy, no redirects
    try:
        connection.request("GET", path, headers={"User-Agent": USER_AGENT, "Connection": "close"})
        response = connection.getresponse()
        if response.status != 200:
            return None
        data = response.read(DESCRIPTION_READ_LIMIT)
    except (OSError, http.client.HTTPException, ValueError):
        return None
    finally:
        connection.close()
    text = data.decode("utf-8", errors="replace")
    description = parse_device_description(text)
    description["wanServices"] = parse_wan_services(text, location)
    return description


def fetch_descriptions(ssdp: dict[str, dict], network: ipaddress.IPv4Network, deadline: float) -> dict[str, dict]:
    locations = []
    for entry in ssdp.values():
        for location in entry["locations"]:
            if location not in locations and location_allowed(location, network):
                locations.append(location)
    locations = locations[:MAX_DESCRIPTION_FETCHES]
    if not locations or time.monotonic() > deadline:
        return {}
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_device_description, loc, network): loc for loc in locations}
        for future in concurrent.futures.as_completed(futures):
            description = future.result()
            if description:
                results[futures[future]] = description
    return results


# --- UPnP IGD: port mappings of the user's own router ------------------------
# Only three SOAP actions exist in this agent: GetGenericPortMappingEntry (read),
# DeletePortMapping (a fix the user confirmed with SIM) and AddPortMapping (only
# to undo a removed mapping). No login, no password, nothing else.

_SERVICE_BLOCK_RE = re.compile(r"<(?:\w+:)?service\b[^>]*>(.*?)</(?:\w+:)?service\s*>", re.S | re.I)


def parse_wan_services(xml_text: str, location: str) -> list[dict]:
    """WANIPConnection/WANPPPConnection services with their absolute controlURL."""
    base = _xml_tag(xml_text, "URLBase", 300) or location
    services: list[dict] = []
    for block in _SERVICE_BLOCK_RE.findall(xml_text):
        service_type = _xml_tag(block, "serviceType", 200)
        control = _xml_tag(block, "controlURL", 300)
        if not service_type or not control or not _WAN_SERVICE_RE.match(service_type):
            continue
        try:
            url = urllib.parse.urljoin(base, control)
        except ValueError:
            continue
        item = {"serviceType": service_type, "controlURL": url}
        if item not in services:
            services.append(item)
    return services[:MAX_IGD_SERVICES]


def igd_services(
    descriptions: dict[str, dict], network: ipaddress.IPv4Network, gateway: str | None
) -> list[dict]:
    """IGD services whose controlURL is inside the scanned subnet.

    When the gateway is known, only the gateway's own IGD counts (the user's router): another
    device that merely announces an IGD is never listed or changed.
    """
    services: list[dict] = []
    for description in descriptions.values():
        for service in description.get("wanServices") or []:
            allowed = location_allowed(str(service.get("controlURL") or ""), network)
            if not allowed or not _WAN_SERVICE_RE.match(str(service.get("serviceType") or "")):
                continue
            if gateway and allowed[0] != gateway:
                continue
            entry = {
                "routerIp": allowed[0],
                "serviceType": service["serviceType"],
                "controlURL": service["controlURL"],
            }
            if entry not in services:
                services.append(entry)
    return services[:MAX_IGD_SERVICES]


def build_soap_envelope(service_type: str, action: str, arguments: list[tuple[str, str]]) -> bytes:
    body = "".join(f"<{name}>{html.escape(value, quote=False)}</{name}>" for name, value in arguments)
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
        's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>'
        f'<u:{action} xmlns:u="{html.escape(service_type)}">{body}</u:{action}>'
        "</s:Body></s:Envelope>"
    ).encode("utf-8")


def _soap_post(url: str, headers: dict, body: bytes, timeout: float) -> tuple[int | None, str]:
    """The only network primitive for SOAP: no proxy, no redirects, response capped."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
    request = urllib.request.Request(url, data=body, method="POST", headers=headers)
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.status, response.read(UPNP_READ_LIMIT).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        try:
            text = exc.read(UPNP_READ_LIMIT).decode("utf-8", errors="replace")
        except Exception:  # pragma: no cover - defensive
            text = ""
        return exc.code, text
    except (urllib.error.URLError, OSError, ValueError, http.client.HTTPException) as exc:
        return None, str(getattr(exc, "reason", exc))


def upnp_soap_call(
    control_url: str, service_type: str, action: str, arguments: list[tuple[str, str]]
) -> tuple[int | None, str]:
    """One SOAP call to the router's IGD. Refuses anything outside the allowed actions/scope."""
    if action not in UPNP_ALLOWED_ACTIONS:
        raise ProbeNotAuthorized(f"Ação UPnP não permitida: {action!r}")
    if not _WAN_SERVICE_RE.match(service_type or ""):
        raise ProbeNotAuthorized(f"Serviço UPnP não permitido: {service_type!r}")
    scope = _require_probe_consent()
    allowed = location_allowed(control_url or "", scope)
    if not allowed:
        raise ProbeNotAuthorized(f"Endereço de controle UPnP fora da faixa autorizada: {control_url!r}")
    host, port, path = allowed
    _check_probe_target(host)
    headers = {
        "Content-Type": 'text/xml; charset="utf-8"',
        "SOAPAction": f'"{service_type}#{action}"',
        "User-Agent": USER_AGENT,
        "Connection": "close",
    }
    return _soap_post(
        f"http://{host}:{port}{path}", headers, build_soap_envelope(service_type, action, arguments),
        UPNP_TIMEOUT,
    )


def _strict_int(value, low: int, high: int) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value.isdigit():
            return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if low <= number <= high else None


def _printable(text: str | None, limit: int) -> str:
    return "".join(ch for ch in (text or "") if ch.isprintable())[:limit].strip()


def parse_port_mapping_entry(body: str) -> dict | None:
    """Fields of a GetGenericPortMappingEntry response, validated."""
    external = _strict_int(_xml_tag(body, "NewExternalPort"), 1, 65535)
    internal = _strict_int(_xml_tag(body, "NewInternalPort"), 1, 65535)
    protocol = (_xml_tag(body, "NewProtocol") or "").upper()
    client = _xml_tag(body, "NewInternalClient") or ""
    remote = _xml_tag(body, "NewRemoteHost") or ""
    if external is None or internal is None or protocol not in ("TCP", "UDP") or not _is_ipv4(client):
        return None
    if remote and not _is_ipv4(remote):
        return None
    enabled = (_xml_tag(body, "NewEnabled") or "1").strip().lower() not in ("0", "false", "no")
    lease = _strict_int(_xml_tag(body, "NewLeaseDuration") or "0", 0, 2**32 - 1) or 0
    return {
        "remoteHost": remote,
        "externalPort": external,
        "protocol": protocol,
        "internalPort": internal,
        "internalClient": client,
        "enabled": enabled,
        "description": _printable(_xml_tag(body, "NewPortMappingDescription", 256), 256),
        "leaseDuration": lease,
    }


def list_port_mappings(service: dict, deadline: float) -> list[dict]:
    """GetGenericPortMappingEntry with index 0, 1, 2... until the router answers with an error."""
    mappings: list[dict] = []
    for index in range(MAX_UPNP_MAPPINGS):
        if time.monotonic() > deadline:
            break
        status, body = upnp_soap_call(
            service["controlURL"], service["serviceType"], "GetGenericPortMappingEntry",
            [("NewPortMappingIndex", str(index))],
        )
        if status != 200:
            break  # 713 SpecifiedArrayIndexInvalid marks the end of the table
        mapping = parse_port_mapping_entry(body)
        if mapping is None:
            continue
        mapping.update(
            routerIp=service["routerIp"], controlURL=service["controlURL"],
            serviceType=service["serviceType"],
        )
        mappings.append(mapping)
    return mappings


def list_all_port_mappings(services: list[dict], deadline: float) -> list[dict]:
    seen: set[tuple] = set()
    result: list[dict] = []
    for service in services:
        for mapping in list_port_mappings(service, deadline):
            key = (mapping["routerIp"], mapping["externalPort"], mapping["protocol"], mapping["remoteHost"])
            if key not in seen:
                seen.add(key)
                result.append(mapping)
    return result


def assemble_devices(
    scan_net: ipaddress.IPv4Network,
    local_ip: str,
    gateway: str | None,
    hostname: str,
    open_map: dict[str, set[int]],
    alive: set[str],
    enrichment: dict[tuple[str, int], dict],
    ssdp: dict[str, dict],
    descriptions: dict[str, dict],
    arp: list[tuple[str, str]],
) -> list[Device]:
    usable = {str(h) for h in scan_net.hosts()}
    devices: dict[str, Device] = {}

    def get(ip: str) -> Device | None:
        if ip not in usable:
            return None
        return devices.setdefault(ip, Device(ip=ip))

    for ip, ports in open_map.items():
        device = get(ip)
        if device:
            device.open_ports |= set(ports)
    for ip in alive:
        get(ip)
    for ip, mac in arp:
        device = get(ip)
        if device and not device.mac:
            device.mac = mac
    for (ip, port), info in enrichment.items():
        device = get(ip)
        if not device:
            continue
        if info.get("banner"):
            device.banners[port] = info["banner"]
        if info.get("http"):
            device.http[port] = info["http"]
    for ip, entry in ssdp.items():
        device = get(ip)
        if not device:
            continue
        device.upnp = True
        device.upnp_server = entry.get("server")
        device.upnp_igd = device.upnp_igd or bool(entry.get("igd"))
        for location in entry.get("locations", []):
            description = descriptions.get(location)
            if not description:
                continue
            if _is_igd(description.get("deviceType")):
                device.upnp_igd = True
            if not device.model:
                device.model = model_from_description(description)
    if gateway and gateway in devices:
        devices[gateway].is_gateway = True
    if local_ip in devices:
        devices[local_ip].is_self = True
        devices[local_ip].hostname = hostname
    ordered = sorted(devices.values(), key=lambda d: _ip_sort_key(d.ip))
    return ordered[:MAX_DEVICES]


# =============================================================================
# Payload
# =============================================================================

def _clip(value, limit: int = MAX_STRING) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text if len(text) <= limit else text[: limit - 3] + "..."


def sanitize_kind(kind) -> str:
    value = re.sub(r"[^a-z0-9_]+", "_", str(kind or "").lower())[:MAX_KIND].strip("_")
    return value or "unknown"


def _clean_port(value) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if 1 <= number <= 65535 else None


def _sanitize_device(device: dict) -> dict:
    ports = sorted({p for p in (_clean_port(x) for x in device.get("openPorts") or []) if p})
    services = []
    for service in (device.get("services") or [])[:MAX_SERVICES_PER_DEVICE]:
        port = _clean_port(service.get("port"))
        if port is None:
            continue
        services.append({
            "port": port,
            "protocol": "tcp",
            "name": _clip(service.get("name") or "unknown"),
            "banner": _clip(service.get("banner")),
        })
    return {
        "ip": _clip(device.get("ip") or ""),
        "mac": _clip(device.get("mac")),
        "vendor": None,
        "hostname": _clip(device.get("hostname")),
        "model": _clip(device.get("model")),
        "openPorts": ports,
        "services": services,
    }


def _sanitize_finding(finding: dict) -> dict:
    severity = finding.get("severity")
    if severity not in SEVERITY_RANK:
        severity = "info"
    return {
        "severity": severity,
        "kind": sanitize_kind(finding.get("kind")),
        "title": _clip(finding.get("title") or ""),
        "detail": _clip(finding.get("detail") or ""),
        "recommendation": _clip(finding.get("recommendation") or ""),
        "deviceIp": _clip(finding.get("deviceIp")),
        "port": _clean_port(finding.get("port")),
    }


_ISO_UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$")


def _sanitize_fix(fix) -> dict | None:
    if not isinstance(fix, dict) or fix.get("target") not in FIX_TARGETS:
        return None
    applied_at = fix.get("appliedAt")
    if not isinstance(applied_at, str) or not _ISO_UTC_RE.match(applied_at):
        applied_at = now_iso()
    item = {
        "kind": sanitize_kind(fix.get("kind")),
        "target": fix["target"],
        "title": _clip(fix.get("title") or "Correção aplicada", MAX_FIX_TITLE),
        "appliedAt": applied_at,
    }
    if fix.get("findingKind"):
        item["findingKind"] = sanitize_kind(fix["findingKind"])
    return item


def sanitize_fixes(fixes) -> list[dict]:
    """Fixes applied in THIS run (contract: optional field, at most 50 items)."""
    items = [_sanitize_fix(fix) for fix in (fixes or [])]
    return [item for item in items if item][:MAX_FIXES]


def sanitize_payload(payload: dict) -> dict:
    """Enforce the API contract: exact keys, enums, list and string limits.

    ``fixes`` is optional in the contract and is only included when the run applied a fix.
    """
    mode = payload.get("mode")
    if mode not in VALID_MODES:
        raise ValueError(f"modo inválido: {mode!r}")
    host = payload.get("host") or {}
    network = payload.get("network") or {}
    os_name = host.get("os") if host.get("os") in VALID_OS else detect_os()
    devices = [] if mode == "public" else [
        _sanitize_device(d) for d in (payload.get("devices") or [])[:MAX_DEVICES]
    ]
    findings = sort_findings([_sanitize_finding(f) for f in payload.get("findings") or []])
    result = {
        "agentVersion": _clip(payload.get("agentVersion") or AGENT_VERSION),
        "mode": mode,
        "startedAt": _clip(payload.get("startedAt") or now_iso()),
        "finishedAt": _clip(payload.get("finishedAt") or now_iso()),
        "host": {"os": os_name, "hostname": _clip(host.get("hostname") or "desconhecido")},
        "network": {
            "localIp": _clip(network.get("localIp")),
            "cidr": _clip(network.get("cidr")),
            "gateway": _clip(network.get("gateway")),
            "isPrivate": bool(network.get("isPrivate")),
            "wifiSecurity": _clip(network.get("wifiSecurity")),
        },
        "devices": devices,
        "findings": findings[:MAX_FINDINGS],
    }
    fixes = sanitize_fixes(payload.get("fixes"))
    if fixes:
        result["fixes"] = fixes
    return result


def build_payload(
    mode: str,
    started_at: str,
    os_name: str,
    hostname: str,
    local_ip: str | None,
    cidr: str | None,
    gateway: str | None,
    wifi_security: str | None,
    devices: list[dict],
    findings: list[dict],
    fixes: list[dict] | None = None,
) -> dict:
    return sanitize_payload({
        "agentVersion": AGENT_VERSION,
        "mode": mode,
        "startedAt": started_at,
        "finishedAt": now_iso(),
        "host": {"os": os_name, "hostname": hostname},
        "network": {
            "localIp": local_ip,
            "cidr": cidr,
            "gateway": gateway,
            "isPrivate": is_rfc1918(local_ip),
            "wifiSecurity": wifi_security,
        },
        "devices": devices,
        "findings": findings,
        "fixes": fixes or [],
    })


# =============================================================================
# Upload
# =============================================================================

def validate_api_url(url: str) -> str:
    text = (url or "").strip()
    try:
        parts = urllib.parse.urlsplit(text)
    except ValueError as exc:
        raise ValueError("URL da API inválida.") from exc
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError("URL da API inválida: use https://servidor[/caminho].")
    if parts.username or parts.password:
        raise ValueError("Não coloque usuário/senha na URL da API.")
    host = parts.hostname.lower()
    if parts.scheme == "http" and host not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("A API precisa usar https:// (http:// só é aceito para localhost/127.0.0.1).")
    return text.rstrip("/")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow redirects: the pairing token must not leak to another host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        return None


def _build_opener(api_base: str) -> urllib.request.OpenerDirector:
    host = (urllib.parse.urlsplit(api_base).hostname or "").lower()
    handlers: list = [_NoRedirect()]
    if host in ("localhost", "127.0.0.1", "::1"):
        handlers.append(urllib.request.ProxyHandler({}))
    return urllib.request.build_opener(*handlers)


def upload_payload(payload: dict, api_base: str, token: str, timeout: float = UPLOAD_TIMEOUT) -> tuple[int | None, str]:
    url = validate_api_url(api_base) + "/network/scans"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Pairing-Token": token,
            "User-Agent": USER_AGENT,
        },
    )
    opener = _build_opener(api_base)
    try:
        with opener.open(request, timeout=timeout) as response:
            body = response.read(2000).decode("utf-8", errors="replace")
            return response.status, body
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read(2000).decode("utf-8", errors="replace")
        except Exception:  # pragma: no cover - defensive
            body = ""
        return exc.code, body
    except (urllib.error.URLError, OSError, ValueError, http.client.HTTPException) as exc:
        reason = getattr(exc, "reason", exc)
        return None, str(reason)


# =============================================================================
# Output
# =============================================================================

_WIFI_DISPLAY = {
    "OPEN": "aberta (sem senha)", "WEP": "WEP (fraca)", "WPA": "WPA (antiga)",
}


def format_summary(payload: dict, elapsed: float | None = None) -> str:
    lines = ["=" * 66, f" Radar360 - agente local v{payload['agentVersion']}", "=" * 66]
    mode = (
        "casa (rede local, com consentimento)" if payload["mode"] == "home"
        else "público (somente este computador)"
    )
    host = payload["host"]
    network = payload["network"]
    wifi = network.get("wifiSecurity")
    wifi_text = _WIFI_DISPLAY.get(wifi or "", wifi) if wifi else "desconhecido / sem Wi-Fi"
    lines += [
        f"Modo         : {mode}",
        f"Computador   : {host['hostname']} ({OS_LABEL.get(host['os'], host['os'])})",
        f"IP local     : {network['localIp'] or 'desconhecido'}"
        f" ({'rede privada' if network['isPrivate'] else 'não é rede privada'})",
        f"Rede (CIDR)  : {network['cidr'] or 'desconhecida'}",
        f"Gateway      : {network['gateway'] or 'desconhecido'}",
        f"Wi-Fi        : {wifi_text}",
    ]
    if elapsed is not None:
        lines.append(f"Duração      : {elapsed:.1f} s")
    if payload["mode"] == "home":
        devices = payload["devices"]
        lines += ["", f"Dispositivos encontrados: {len(devices)}"]
        for device in devices:
            ports = ", ".join(str(p) for p in device["openPorts"]) or "nenhuma porta aberta"
            model = f" | {device['model']}" if device.get("model") else ""
            lines.append(f"  - {device['ip']:<15} {device['mac'] or '-':<17} portas: {ports}{model}")
    findings = payload["findings"]
    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in SEVERITIES}
    lines += [
        "",
        f"Achados: {len(findings)} (crítico {counts['critical']}, alto {counts['high']}, "
        f"médio {counts['medium']}, baixo {counts['low']}, info {counts['info']})",
    ]
    if not findings:
        lines.append("  Nenhum problema encontrado.")
    for finding in findings:
        where = ""
        if finding.get("deviceIp"):
            where = f" [{finding['deviceIp']}" + (f":{finding['port']}" if finding.get("port") else "") + "]"
        elif finding.get("port") and f"porta {finding['port']}" not in finding["title"]:
            where = f" [porta {finding['port']}]"
        lines.append("")
        lines.append(f"[{SEVERITY_LABEL[finding['severity']]}] {finding['title']}{where}")
        lines.append(textwrap.fill(finding["detail"], width=78, initial_indent="    ", subsequent_indent="    "))
        lines.append(textwrap.fill(
            "Como corrigir: " + finding["recommendation"], width=78,
            initial_indent="    ", subsequent_indent="    ",
        ))
    fixes = payload.get("fixes") or []
    fixable = (FIXABLE_FINDING_KINDS if payload["host"]["os"] == "windows"
               else {"firewall_disabled", "upnp_port_mapping"})
    if fixes:
        lines += ["", f"Correções aplicadas nesta execução, com a sua confirmação: {len(fixes)}"]
        for fix in fixes:
            where = "roteador" if fix["target"] == "router" else "este computador"
            lines.append(f"  - {fix['title']} ({where})")
        lines.append("Para desfazer: python scanner.py --desfazer")
    elif any(f["kind"] in fixable for f in findings):
        lines += [
            "",
            "O agente não alterou nenhuma configuração. Alguns achados têm correção automática: "
            "rode com --corrigir (pede SIM antes de cada uma) ou --simular (só mostra).",
        ]
    else:
        lines += ["", "O agente não alterou nenhuma configuração; ele apenas explica como corrigir."]
    return "\n".join(lines)


def finish(payload: dict, args: argparse.Namespace, elapsed: float | None = None) -> int:
    summary = format_summary(payload, elapsed)
    if args.json:
        print(summary, file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=True, indent=2))
    else:
        print(summary)
    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
            log(f"Relatório salvo em: {args.output}")
        except OSError as exc:
            log(f"Não foi possível salvar o arquivo {args.output}: {exc}")
    if not args.api:
        return EXIT_OK
    if args.dry_run:
        log("--dry-run: nada foi enviado para a API.")
        return EXIT_OK
    log(f"Enviando resultado para {args.api}/network/scans ...")
    status, body = upload_payload(payload, args.api, args.token)
    if status is None:
        log(f"Falha no envio para a API: {body}")
        return EXIT_UPLOAD_FAILED
    snippet = re.sub(r"\s+", " ", body).strip()[:300]
    log(f"Resposta da API: HTTP {status}" + (f" - {snippet}" if snippet else ""))
    return EXIT_OK if 200 <= status < 300 else EXIT_UPLOAD_FAILED


# =============================================================================
# Fixes: one at a time, each confirmed with SIM, each recorded for undo
# =============================================================================

FIXABLE_FINDING_KINDS = frozenset({
    "firewall_disabled", "firewall_profile_disabled", "firewall_partially_disabled",
    "network_marked_private", "exposed_smb", "exposed_rdp", "exposed_database",
    "exposed_dev_server", "upnp_port_mapping",
})


@dataclasses.dataclass
class FixPlan:
    kind: str                # fix kind sent to the API (e.g. firewall_enabled)
    target: str              # computer | router
    title: str               # what was done, pt-BR, sent to the API
    label: str               # what will be done, shown before asking
    finding_kind: str | None
    problem: str
    change: str
    risk: str
    undo_text: str
    steps: list[tuple[dict, dict]]  # (do, undo) specs; commands are rebuilt from a whitelist
    needs_admin: bool = True


class JournalError(RuntimeError):
    """The local fix journal cannot be read or written."""


def is_admin(os_name: str | None = None) -> bool:
    if (os_name or detect_os()) == "windows":
        try:
            import ctypes
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except (ImportError, AttributeError, OSError):
            return False
    geteuid = getattr(os, "geteuid", None)
    if geteuid is None:
        return False
    try:
        return geteuid() == 0
    except OSError:
        return False


def admin_help(os_name: str) -> str:
    if os_name == "windows":
        return (
            "As correções neste computador precisam de administrador. Feche este terminal, abra o "
            "menu Iniciar, clique com o botão direito em 'Terminal' (ou 'Windows PowerShell'), "
            "escolha 'Executar como administrador' e rode o mesmo comando de novo. Por enquanto, "
            "sigo só com o que não precisa de administrador."
        )
    return (
        "As correções neste computador precisam de administrador (root). Rode o mesmo comando de "
        "novo com sudo, por exemplo: sudo python3 scanner.py --mode public --corrigir. Por "
        "enquanto, sigo só com o que não precisa de administrador."
    )


# --- Journal (local file with what changed and how to undo it) ---------------

def journal_path() -> str:
    if detect_os() == "windows":
        base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
        return os.path.join(base, "Olharium", "fixes.json")
    return os.path.join(os.path.expanduser("~"), ".olharium", "fixes.json")


def load_journal(path: str) -> dict:
    if not os.path.exists(path):
        return {"version": JOURNAL_VERSION, "fixes": []}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError) as exc:
        raise JournalError(f"Não foi possível ler o diário de correções ({path}): {exc}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("fixes"), list):
        raise JournalError(f"O diário de correções ({path}) está num formato desconhecido.")
    return data


def save_journal(path: str, data: dict) -> None:
    temp = path + ".tmp"
    try:
        os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
        with open(temp, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        os.replace(temp, path)
        if os.name != "nt":
            os.chmod(path, 0o600)
    except OSError as exc:
        raise JournalError(f"Não foi possível gravar o diário de correções ({path}): {exc}") from exc


def record_fix(entry: dict) -> None:
    path = journal_path()
    data = load_journal(path)
    data["version"] = JOURNAL_VERSION
    data["fixes"].append(entry)
    save_journal(path, data)


# --- Exact commands (rebuilt from validated data, never read as text) ---------

def _require_int(value, low: int, high: int, what: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not low <= value <= high:
        raise ValueError(f"{what} inválido")
    return value


def _powershell_change(script: str) -> list[str]:
    return [
        "powershell", "-NoProfile", "-NonInteractive", "-Command",
        f"$ErrorActionPreference = 'Stop'; {script}",
    ]


def build_command(spec: dict) -> list[str]:
    """Exact command of a computer fix/undo step. Raises ValueError for anything unexpected.

    The journal is a user-writable file, so undo data is validated here and turned into a
    command from this fixed list; nothing in the journal is ever executed as text.
    """
    if not isinstance(spec, dict):
        raise ValueError("passo inválido")
    action = spec.get("action")
    if action == "firewall_set":
        state, os_name = spec.get("state"), spec.get("os")
        if state not in ("on", "off"):
            raise ValueError("estado do firewall inválido")
        if os_name == "windows":
            profile = spec.get("profile")
            if profile not in ("domain", "private", "public"):
                raise ValueError("perfil do firewall inválido")
            return ["netsh", "advfirewall", "set", f"{profile}profile", "state", state]
        if os_name == "macos":
            return [MACOS_SOCKETFILTERFW, "--setglobalstate", state]
        if os_name == "linux":
            return ["ufw", "enable" if state == "on" else "disable"]
        raise ValueError("sistema operacional inválido")
    if action == "network_category":
        index = _require_int(spec.get("index"), 1, 999_999, "índice da interface")
        category = spec.get("category")
        if category not in ("Public", "Private"):
            raise ValueError("categoria de rede inválida")
        return _powershell_change(
            f"Set-NetConnectionProfile -InterfaceIndex {index} -NetworkCategory {category}"
        )
    if action == "firewall_rules":
        names, enabled = spec.get("names"), spec.get("enabled")
        if (not isinstance(names, list) or not 1 <= len(names) <= 64
                or not all(isinstance(name, str) and _RULE_NAME_RE.match(name) for name in names)):
            raise ValueError("nomes de regra do firewall inválidos")
        if not isinstance(enabled, bool):
            raise ValueError("estado da regra inválido")
        verb = "Enable" if enabled else "Disable"
        return _powershell_change(f"{verb}-NetFirewallRule -Name " + ",".join(f"'{n}'" for n in names))
    if action == "rdp_deny":
        value = _require_int(spec.get("value"), 0, 1, "valor de fDenyTSConnections")
        return ["reg", "add", RDP_KEY, "/v", "fDenyTSConnections", "/t", "REG_DWORD", "/d", str(value), "/f"]
    if action == "port_block":
        port = _require_int(spec.get("port"), 1, 65535, "porta")
        present = spec.get("present")
        if not isinstance(present, bool):
            raise ValueError("operação da regra inválida")
        name = f"{BLOCK_RULE_PREFIX}{port}"
        if present:
            return _powershell_change(
                f"New-NetFirewallRule -Name '{name}' -DisplayName 'Olharium: bloqueio da porta {port}' "
                f"-Direction Inbound -Action Block -Protocol TCP -LocalPort {port} -Profile Any | Out-Null"
            )
        return _powershell_change(f"Remove-NetFirewallRule -Name '{name}'")
    raise ValueError(f"ação desconhecida: {action!r}")


def validate_upnp_spec(spec: dict) -> dict:
    """Validated copy of a router step (DeletePortMapping / AddPortMapping)."""
    if not isinstance(spec, dict) or spec.get("action") not in ("upnp_delete", "upnp_add"):
        raise ValueError("passo UPnP inválido")
    control = spec.get("controlURL")
    if not isinstance(control, str) or len(control) > 300:
        raise ValueError("endereço de controle UPnP inválido")
    try:
        parts = urllib.parse.urlsplit(control)
        parts.port  # noqa: B018 - raises ValueError on a bad port
    except ValueError as exc:
        raise ValueError("endereço de controle UPnP inválido") from exc
    if parts.scheme != "http" or not is_rfc1918(parts.hostname):
        raise ValueError("o endereço de controle UPnP precisa ser http:// num IP privado")
    service_type = spec.get("serviceType")
    if not isinstance(service_type, str) or not _WAN_SERVICE_RE.match(service_type):
        raise ValueError("serviço UPnP inválido")
    remote = spec.get("remoteHost") or ""
    if not isinstance(remote, str) or (remote and not _is_ipv4(remote)):
        raise ValueError("endereço remoto inválido")
    protocol = spec.get("protocol")
    if protocol not in ("TCP", "UDP"):
        raise ValueError("protocolo inválido")
    clean = {
        "action": spec["action"],
        "controlURL": control,
        "serviceType": service_type,
        "remoteHost": remote,
        "externalPort": _require_int(spec.get("externalPort"), 1, 65535, "porta externa"),
        "protocol": protocol,
    }
    if spec["action"] == "upnp_add":
        client = spec.get("internalClient")
        if not isinstance(client, str) or not is_rfc1918(client):
            raise ValueError("endereço interno inválido")
        enabled = spec.get("enabled")
        description = spec.get("description") or ""
        if not isinstance(enabled, bool) or not isinstance(description, str):
            raise ValueError("dados do mapeamento inválidos")
        clean.update(
            internalPort=_require_int(spec.get("internalPort"), 1, 65535, "porta interna"),
            internalClient=client,
            enabled=enabled,
            description=_printable(description, 256),
            leaseDuration=_require_int(spec.get("leaseDuration") or 0, 0, 2**32 - 1, "duração"),
        )
    return clean


def _upnp_arguments(clean: dict) -> tuple[str, list[tuple[str, str]]]:
    arguments = [
        ("NewRemoteHost", clean["remoteHost"]),
        ("NewExternalPort", str(clean["externalPort"])),
        ("NewProtocol", clean["protocol"]),
    ]
    if clean["action"] == "upnp_delete":
        return "DeletePortMapping", arguments
    return "AddPortMapping", arguments + [
        ("NewInternalPort", str(clean["internalPort"])),
        ("NewInternalClient", clean["internalClient"]),
        ("NewEnabled", "1" if clean["enabled"] else "0"),
        ("NewPortMappingDescription", clean["description"]),
        ("NewLeaseDuration", str(clean["leaseDuration"])),
    ]


def format_argv(argv: list[str]) -> str:
    if argv and argv[0] in ("netsh", "powershell", "reg"):
        return subprocess.list2cmdline(argv)
    return shlex.join(argv)


def describe_spec(spec) -> str:
    """The exact command (or SOAP action) a step runs, for display."""
    if isinstance(spec, dict) and spec.get("action") in ("upnp_delete", "upnp_add"):
        try:
            clean = validate_upnp_spec(spec)
        except ValueError:
            return "(passo inválido: não será executado)"
        action, arguments = _upnp_arguments(clean)
        shown = ", ".join(
            f"{name}='{value}'" if name in ("NewRemoteHost", "NewPortMappingDescription") else f"{name}={value}"
            for name, value in arguments
        )
        return f"UPnP {action} em {clean['controlURL']} ({shown})"
    try:
        return format_argv(build_command(spec))
    except ValueError:
        return "(passo inválido: não será executado)"


_UPNP_ERRORS = {
    "606": "o roteador não autorizou a ação. Muitos roteadores só deixam um aparelho mexer nos "
           "mapeamentos que ele mesmo criou: feche o programa que abriu a porta ou remova pelo "
           "painel do roteador",
    "714": "o mapeamento não existe mais no roteador",
    "718": "já existe outro mapeamento nessa porta",
    "725": "o roteador só aceita mapeamentos permanentes",
}


def _upnp_error_text(status: int | None, body: str) -> str:
    if status is None:
        return f"o roteador não respondeu ({(body or '')[:120]})"
    code = _xml_tag(body or "", "errorCode")
    if code in _UPNP_ERRORS:
        return f"{_UPNP_ERRORS[code]} (erro UPnP {code})"
    if code:
        reason = _xml_tag(body or "", "errorDescription") or "sem descrição"
        return f"o roteador recusou (erro UPnP {code}: {reason})"
    return f"o roteador respondeu HTTP {status}"


def _execute_upnp(spec: dict) -> tuple[bool, str]:
    try:
        clean = validate_upnp_spec(spec)
    except ValueError as exc:
        return False, f"passo recusado ({exc})"
    action, arguments = _upnp_arguments(clean)
    try:
        status, body = upnp_soap_call(clean["controlURL"], clean["serviceType"], action, arguments)
        if (status != 200 and action == "AddPortMapping" and clean["leaseDuration"]
                and _xml_tag(body or "", "errorCode") == "725"):
            arguments = [(n, "0" if n == "NewLeaseDuration" else v) for n, v in arguments]
            status, body = upnp_soap_call(clean["controlURL"], clean["serviceType"], action, arguments)
    except ProbeNotAuthorized as exc:
        return False, str(exc)
    if status == 200:
        return True, ""
    return False, _upnp_error_text(status, body)


def execute_spec(spec) -> tuple[bool, str]:
    """Runs one validated step. Returns (ok, message)."""
    if isinstance(spec, dict) and spec.get("action") in ("upnp_delete", "upnp_add"):
        return _execute_upnp(spec)
    try:
        argv = build_command(spec)
    except ValueError as exc:
        return False, f"passo recusado ({exc})"
    code, output = run_change_cmd(argv)
    if code == 0:
        return True, output
    snippet = re.sub(r"\s+", " ", output or "").strip()[:300]
    return False, snippet or f"o comando terminou com código {code}"


# --- Plans ----------------------------------------------------------------------

@dataclasses.dataclass
class PublicAudit:
    os_name: str
    hostname: str
    net: NetworkInfo
    profiles: list[dict]
    firewall: FirewallStatus
    fw_rules: WindowsFirewallRules
    listeners: list[Listener] | None
    wifi_raw: str | None
    findings: list[dict]


def _join_pt(items) -> str:
    items = list(items)
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " e " + items[-1]


_FIREWALL_RISK = (
    "Baixo. Programas que recebem conexões de outros aparelhos (jogos em rede local, "
    "compartilhamento, servidores de desenvolvimento) podem parar de recebê-las até você liberar "
    "cada um."
)


def _plan_firewall(audit: PublicAudit, finding_kind: str) -> FixPlan | None:
    status = audit.firewall
    if audit.os_name == "windows":
        off = [p for p in ("domain", "private", "public") if p in status.off_profiles]
        if not off:
            return None
        where = f"{'no perfil' if len(off) == 1 else 'nos perfis'} {_join_pt(PROFILE_LABEL[p] for p in off)}"
        return FixPlan(
            kind="firewall_enabled", target="computer", title=f"Firewall ativado {where}",
            label=f"Ligar o firewall do Windows {where}", finding_kind=finding_kind,
            problem=f"O firewall do Windows está desligado {where}.",
            change=f"Liga o firewall {where}. Perfis que já estão ligados e as regras existentes não mudam.",
            risk=_FIREWALL_RISK,
            undo_text=f"'python scanner.py --desfazer' desliga o firewall de novo só {where}.",
            steps=[
                ({"action": "firewall_set", "os": "windows", "profile": p, "state": "on"},
                 {"action": "firewall_set", "os": "windows", "profile": p, "state": "off"})
                for p in off
            ],
        )
    if status.enabled is not False:
        return None
    if audit.os_name == "macos":
        return FixPlan(
            kind="firewall_enabled", target="computer", title="Firewall do macOS ativado",
            label="Ligar o firewall do macOS", finding_kind=finding_kind,
            problem="O firewall de aplicativos do macOS está desligado.",
            change="Liga o firewall de aplicativos (o mesmo de Ajustes do Sistema > Rede > Firewall).",
            risk=_FIREWALL_RISK,
            undo_text="'python scanner.py --desfazer' desliga o firewall de novo.",
            steps=[({"action": "firewall_set", "os": "macos", "state": "on"},
                    {"action": "firewall_set", "os": "macos", "state": "off"})],
        )
    if audit.os_name == "linux" and status.source == "ufw":
        return FixPlan(
            kind="firewall_enabled", target="computer", title="Firewall ufw ativado",
            label="Ligar o firewall ufw", finding_kind=finding_kind,
            problem="O firewall ufw está instalado, mas inativo.",
            change="Liga o ufw, que passa a valer também quando o computador reinicia, com a política "
                   "padrão do ufw (bloqueia conexões de entrada).",
            risk=_FIREWALL_RISK + " Se você acessa este computador por SSH, libere antes a porta "
                 "(sudo ufw allow ssh) para não perder o acesso.",
            undo_text="'python scanner.py --desfazer' desliga o ufw de novo.",
            steps=[({"action": "firewall_set", "os": "linux", "state": "on"},
                    {"action": "firewall_set", "os": "linux", "state": "off"})],
        )
    return None


def _plan_profile(audit: PublicAudit) -> FixPlan | None:
    private, seen = [], set()
    for profile in audit.profiles:
        index = profile.get("index")
        if profile.get("category") == "private" and isinstance(index, int) and index not in seen:
            seen.add(index)
            private.append(profile)
    if not private:
        return None
    names = _join_pt(
        f"'{p['name']}'" if p.get("name") else f"da interface {p['index']}" for p in private
    )
    plural = len(private) > 1
    return FixPlan(
        kind="network_set_public", target="computer",
        # The title goes to the API: never include the network name (SSID).
        title="Redes atuais marcadas como Públicas no Windows" if plural
        else "Rede atual marcada como Pública no Windows",
        label=f"Marcar a rede {names} como Pública", finding_kind="network_marked_private",
        problem=f"O Windows trata a rede {names} como Privada, perfil que libera a descoberta de rede "
                "e o compartilhamento para os outros aparelhos conectados.",
        change="Muda o perfil da rede para Pública (Set-NetConnectionProfile). Nesse perfil o Windows "
               "esconde o computador dos outros aparelhos e usa as regras de firewall mais restritas.",
        risk="Baixo. Impressoras, pastas compartilhadas e outros aparelhos desta rede podem deixar de "
             "enxergar este computador. Na rede de casa, você pode voltar para Privada depois.",
        undo_text="'python scanner.py --desfazer' volta a rede para Privada.",
        steps=[
            ({"action": "network_category", "index": p["index"], "category": "Public"},
             {"action": "network_category", "index": p["index"], "category": "Private"})
            for p in private
        ],
    )


def _plan_smb(audit: PublicAudit) -> FixPlan | None:
    rules = audit.fw_rules.smb_public_rules[:64]
    if not audit.fw_rules.known or not rules:
        return None
    names = [rule["name"] for rule in rules]
    shown = _join_pt(sorted({f"'{rule['displayName']}'" for rule in rules}))
    other_profiles = any(
        rule["profile"] is None or rule["profile"] == 0 or rule["profile"] & 3 for rule in rules
    )
    one = len(rules) == 1
    return FixPlan(
        kind="smb_public_rules_disabled", target="computer",
        title="Compartilhamento de arquivos bloqueado no perfil Público do firewall",
        label="Desativar o Compartilhamento de arquivos e impressoras nas redes públicas",
        finding_kind="exposed_smb",
        problem="O firewall libera o Compartilhamento de arquivos e impressoras (SMB, portas 445 e 139) "
                f"em redes públicas: {len(rules)} regra(s) ativa(s) no perfil Público.",
        change=f"Desativa {'a regra' if one else 'as regras'} de entrada do grupo 'Compartilhamento de "
               f"arquivos e impressoras' que valem no perfil Público: {shown}. O grupo é identificado "
               f"pelo código {SMB_RULE_GROUP}, igual em qualquer idioma do Windows. As regras não são "
               "apagadas, só desativadas. Protege quando a rede está marcada como Pública.",
        risk="Outros aparelhos deixam de acessar pastas e impressoras compartilhadas por este "
             "computador nas redes públicas."
             + (" Parte dessas regras também vale para redes Privadas ou de Domínio, então o "
                "compartilhamento para nelas também até você desfazer." if other_profiles else ""),
        undo_text=f"'python scanner.py --desfazer' reativa exatamente "
                  f"{'essa regra' if one else f'essas {len(rules)} regras'}.",
        steps=[({"action": "firewall_rules", "names": names, "enabled": False},
                {"action": "firewall_rules", "names": names, "enabled": True})],
    )


def parse_reg_dword(text: str, name: str) -> int | None:
    match = re.search(rf"\b{re.escape(name)}\s+REG_DWORD\s+0x([0-9a-fA-F]+)", text or "")
    return int(match.group(1), 16) if match else None


def read_rdp_deny() -> int | None:
    out = run_cmd(["reg", "query", RDP_KEY, "/v", "fDenyTSConnections"])
    return parse_reg_dword(out or "", "fDenyTSConnections")


def _plan_rdp() -> FixPlan | None:
    if read_rdp_deny() != 0:  # unknown, or RDP already off (something else uses 3389)
        return None
    return FixPlan(
        kind="rdp_disabled", target="computer", title="Área de Trabalho Remota desativada",
        label="Desligar a Área de Trabalho Remota (RDP)", finding_kind="exposed_rdp",
        problem="A Área de Trabalho Remota do Windows está ligada e a porta 3389 aceita conexões da rede.",
        change="Muda o valor fDenyTSConnections de 0 para 1 no registro (HKLM\\SYSTEM\\"
               "CurrentControlSet\\Control\\Terminal Server). É o mesmo que desligar a Área de "
               "Trabalho Remota em Configurações > Sistema.",
        risk="Ninguém consegue mais acessar este computador por Área de Trabalho Remota (inclusive "
             "você e o suporte de TI) até desfazer. Uma sessão remota aberta agora pode cair.",
        undo_text="'python scanner.py --desfazer' volta o valor para 0 (Área de Trabalho Remota ligada).",
        steps=[({"action": "rdp_deny", "value": 1}, {"action": "rdp_deny", "value": 0})],
    )


def _plan_port_blocks(audit: PublicAudit) -> list[FixPlan]:
    plans, seen = [], set()
    for finding in audit.findings:
        port = finding.get("port")
        if finding.get("kind") not in ("exposed_database", "exposed_dev_server") or not port:
            continue
        if port in seen or port in audit.fw_rules.blocked_ports:
            continue
        seen.add(port)
        subject = PUBLIC_PORT_RULES[port][2] if port in PUBLIC_PORT_RULES else f"Serviço na porta {port}"
        rule = f"{BLOCK_RULE_PREFIX}{port}"
        plans.append(FixPlan(
            kind="port_blocked", target="computer",
            title=f"Porta {port} bloqueada no firewall ({subject})",
            label=f"Bloquear a porta {port} no firewall ({subject})", finding_kind=finding["kind"],
            problem=f"{subject} aceita conexões de outros aparelhos da rede na porta {port}/TCP.",
            change=f"Cria a regra de entrada 'Olharium: bloqueio da porta {port}' (nome interno {rule}), "
                   f"que bloqueia conexões TCP de outros aparelhos na porta {port} em todos os perfis de "
                   "rede. O programa continua funcionando neste computador (localhost). A regra só "
                   "vale com o firewall ligado.",
            risk="Outros aparelhos (seu celular, colegas na mesma rede, máquinas virtuais) deixam de "
                 "acessar esse serviço até você desfazer. O programa não é fechado.",
            undo_text=f"'python scanner.py --desfazer' apaga a regra {rule}.",
            steps=[({"action": "port_block", "port": port, "present": True},
                    {"action": "port_block", "port": port, "present": False})],
        ))
    return plans


def plan_computer_fixes(audit: PublicAudit) -> list[FixPlan]:
    """Safe fixes for THIS computer, in a sensible order. Only reads the system."""
    kinds = {finding.get("kind") for finding in audit.findings}
    plans: list[FixPlan | None] = []
    firewall_kind = next(
        (k for k in ("firewall_disabled", "firewall_partially_disabled", "firewall_profile_disabled")
         if k in kinds), None,
    )
    if firewall_kind:
        plans.append(_plan_firewall(audit, firewall_kind))
    if audit.os_name == "windows":
        if "network_marked_private" in kinds:
            plans.append(_plan_profile(audit))
        if "exposed_smb" in kinds:
            plans.append(_plan_smb(audit))
        if "exposed_rdp" in kinds:
            plans.append(_plan_rdp())
        plans.extend(_plan_port_blocks(audit))
    return [plan for plan in plans if plan]


def plan_router_fixes(mappings: list[dict]) -> list[FixPlan]:
    """One fix per UPnP mapping of the user's own router (most sensitive first)."""
    plans = []
    for mapping in sorted(mappings, key=lambda m: 0 if upnp_mapping_is_sensitive(m) else 1):
        base = {key: mapping[key] for key in
                ("controlURL", "serviceType", "remoteHost", "externalPort", "protocol")}
        delete = {"action": "upnp_delete", **base}
        add = {"action": "upnp_add", **base, **{key: mapping[key] for key in
               ("internalPort", "internalClient", "enabled", "description", "leaseDuration")}}
        try:
            validate_upnp_spec(delete)
            validate_upnp_spec(add)
        except ValueError:
            continue
        external, protocol, router = mapping["externalPort"], mapping["protocol"], mapping["routerIp"]
        described = f" ('{mapping['description'][:60]}')" if mapping.get("description") else ""
        plans.append(FixPlan(
            kind="upnp_mapping_removed", target="router",
            title=f"Porta {external}/{protocol} fechada no roteador (mapeamento UPnP removido)",
            label=f"Fechar a porta {external}/{protocol} aberta pelo UPnP no roteador {router}",
            finding_kind="upnp_port_mapping",
            problem=f"O roteador {router} encaminha a porta externa {external}/{protocol} da Internet para "
                    f"{mapping['internalClient']}:{mapping['internalPort']}{described}."
                    + (" É uma porta muito visada por ataques." if upnp_mapping_is_sensitive(mapping) else ""),
            change="Remove só esse mapeamento do roteador, com a ação UPnP DeletePortMapping. Nenhuma "
                   "outra configuração do roteador muda, e o agente não faz login nem usa senha.",
            risk="O programa ou aparelho que pediu a abertura (console, jogo, câmera, torrent, acesso "
                 "remoto) pode deixar de receber conexões da Internet. Com o UPnP ligado, ele pode "
                 "abrir a porta de novo: para impedir, desative o UPnP no painel do roteador.",
            undo_text="'python scanner.py --desfazer', conectado a esta mesma rede, recria o mapeamento "
                      "igual (ação UPnP AddPortMapping).",
            steps=[(delete, add)],
            needs_admin=False,
        ))
    return plans


# --- Interaction ------------------------------------------------------------------

def ask_line(prompt: str) -> str | None:
    """Prompt on stderr (stdout may carry JSON). None when the input was closed."""
    sys.stderr.write(prompt)
    sys.stderr.flush()
    try:
        return input()
    except EOFError:
        return None


def _wrap_field(label: str, text: str) -> list[str]:
    return textwrap.wrap(f"{label}: {text}", width=78, initial_indent=" ", subsequent_indent="   ")


def format_plan(plan: FixPlan, index: int, total: int) -> str:
    where = "este computador" if plan.target == "computer" else "o seu roteador (UPnP)"
    lines = [
        "",
        "-" * 66,
        f" Correção {index} de {total}: {plan.label}",
        f" Onde: {where}" + (" | precisa de administrador" if plan.needs_admin else ""),
        "-" * 66,
    ]
    lines += _wrap_field("Problema", plan.problem)
    lines += _wrap_field("O que muda", plan.change)
    lines.append(" Comando exato:")
    lines += [f"   {describe_spec(do)}" for do, _undo in plan.steps]
    lines += _wrap_field("Risco", plan.risk)
    lines += _wrap_field("Como desfazer", plan.undo_text)
    lines.append(" Comando que desfaz:")
    lines += [f"   {describe_spec(undo)}" for _do, undo in reversed(plan.steps)]
    return "\n".join(lines)


def show_simulation(plans: list[FixPlan]) -> None:
    if not plans:
        log("\n--simular: nenhum achado tem correção automática disponível neste sistema. Siga as "
            "recomendações de cada achado.")
        return
    log(f"\n--simular: {len(plans)} correção(ões) que o --corrigir ofereceria, uma por vez. "
        "NADA foi aplicado.")
    for index, plan in enumerate(plans, 1):
        log(format_plan(plan, index, len(plans)))
    if any(plan.needs_admin for plan in plans):
        log("\nAs correções neste computador precisam de terminal aberto como administrador.")


def _new_fix_id() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + os.urandom(3).hex()


def _journal_entry(plan: FixPlan, os_name: str, hostname: str, applied_at: str,
                   undo_specs: list[dict], partial: bool = False) -> dict:
    return {
        "id": _new_fix_id(),
        "kind": plan.kind,
        "target": plan.target,
        "title": plan.title + (" (parcial)" if partial else ""),
        "findingKind": plan.finding_kind,
        "appliedAt": applied_at,
        "os": os_name,
        "hostname": hostname,
        "changed": plan.change,
        "commands": [describe_spec(do) for do, _undo in plan.steps],
        "undo": undo_specs,  # run newest step first
        "undoneAt": None,
    }


def apply_plan(plan: FixPlan, os_name: str, hostname: str) -> dict | None:
    """Applies one confirmed plan. Returns the API ``fixes`` item, or None if it failed."""
    applied_at = now_iso()
    done: list[dict] = []
    log("  Aplicando (pode levar até um minuto)...")
    for do_spec, undo_spec in plan.steps:
        ok, message = execute_spec(do_spec)
        if ok:
            done.append(undo_spec)
            continue
        log(f"  Falhou: {message}")
        leftover = [spec for spec in reversed(done) if not execute_spec(spec)[0]]
        if not leftover:
            log("  Nada ficou alterado." if not done else "  As etapas já feitas foram desfeitas; nada ficou alterado.")
            return None
        leftover.reverse()
        log("  Atenção: parte da correção ficou aplicada e não pôde ser revertida agora.")
        try:
            record_fix(_journal_entry(plan, os_name, hostname, applied_at, leftover, partial=True))
            log("  Ela foi registrada no diário: use 'python scanner.py --desfazer'.")
        except JournalError as exc:
            log(f"  {exc} Para desfazer manualmente: "
                + " ; ".join(describe_spec(spec) for spec in reversed(leftover)))
        return None
    try:
        record_fix(_journal_entry(plan, os_name, hostname, applied_at, done))
        log(f"  Aplicada e registrada no diário ({journal_path()}). Para desfazer: python scanner.py --desfazer")
    except JournalError as exc:
        log(f"  Aplicada, mas {exc} Para desfazer manualmente: "
            + " ; ".join(describe_spec(spec) for spec in reversed(done)))
    return {
        "kind": plan.kind,
        "target": plan.target,
        "title": plan.title,
        "appliedAt": applied_at,
        "findingKind": plan.finding_kind,
    }


def run_fix_flow(plans: list[FixPlan], os_name: str, hostname: str) -> list[dict]:
    """Offers each plan, one at a time; applies only after the user types SIM.

    There is deliberately no way to apply everything at once.
    """
    if not plans:
        log("\nNenhum achado tem correção automática segura neste sistema. Siga as recomendações "
            "de cada achado.")
        return []
    if not _stdin_is_interactive():
        log("\n--corrigir precisa de um terminal interativo: cada correção só é aplicada depois que "
            "você digita SIM. Nada foi alterado.")
        show_simulation(plans)
        return []
    try:
        load_journal(journal_path())
    except JournalError as exc:
        log(f"\n{exc} Sem o diário não dá para guardar o 'desfazer', então nenhuma correção será aplicada.")
        return []
    admin = is_admin(os_name) if any(plan.needs_admin for plan in plans) else True
    if not admin:
        log("\n" + admin_help(os_name))
    log(f"\n{len(plans)} correção(ões) disponível(is). Cada uma só é aplicada se você digitar SIM.")
    applied: list[dict] = []
    for index, plan in enumerate(plans, 1):
        log(format_plan(plan, index, len(plans)))
        if plan.needs_admin and not admin:
            log("  Pulada: precisa de administrador (veja acima como abrir o terminal como administrador).")
            continue
        answer = ask_line("Aplicar esta correção? Digite SIM: ")
        if answer is None:
            log("\nEntrada encerrada: as correções restantes não foram aplicadas.")
            break
        if answer.strip().upper() != "SIM":
            log("  Não aplicada.")
            continue
        fix = apply_plan(plan, os_name, hostname)
        if fix:
            applied.append(fix)
    return applied


# --- Undo -----------------------------------------------------------------------

def _format_when(value) -> str:
    try:
        moment = _dt.datetime.strptime(str(value), "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return str(value)
    return moment.strftime("%d/%m/%Y %H:%M UTC")


def _router_undo_scope(specs: list) -> ipaddress.IPv4Network | None:
    """The current home network, if it is private and contains the router of the fix."""
    net = detect_network(detect_os())
    allowed, reason = check_home_network_allowed(net.local_ip)
    scope = compute_scan_network(net.local_ip, net.prefix) if allowed else None
    if scope is None:
        log(f"  Não dá para falar com o roteador agora: {reason or 'rede não permitida.'}")
        return None
    for spec in specs:
        control = spec.get("controlURL") if isinstance(spec, dict) else None
        allowed = location_allowed(control, scope) if isinstance(control, str) else None
        if not allowed or (net.gateway and allowed[0] != net.gateway):
            log(f"  O roteador desta correção não está na rede atual ({scope}). Conecte-se à mesma "
                "rede de casa e tente de novo.")
            return None
    return scope


def undo_entry(entry: dict) -> bool:
    title = entry.get("title") or entry.get("kind") or "correção"
    specs = entry.get("undo")
    if not isinstance(specs, list) or not specs:
        log(f"  '{title}': o diário não tem dados para desfazer.")
        return False
    if entry.get("os") and entry.get("os") != detect_os():
        log(f"  '{title}' foi feita em outro sistema operacional; nada foi alterado.")
        return False
    pending = list(specs)
    scope = None
    if entry.get("target") == "router":
        scope = _router_undo_scope(specs)
        if scope is None:
            return False
        _authorize_probes(scope)
    try:
        while pending:
            ok, message = execute_spec(pending[-1])
            if not ok:
                log(f"  Falhou ao desfazer '{title}': {message}")
                break
            pending.pop()
    finally:
        if scope is not None:
            _revoke_probes()
    if pending:
        entry["undo"] = pending  # only what is still applied
        return False
    entry["undoneAt"] = now_iso()
    log(f"  Desfeita: {title}")
    return True


def run_undo(args: argparse.Namespace) -> int:
    path = journal_path()
    try:
        journal = load_journal(path)
    except JournalError as exc:
        log(str(exc))
        return EXIT_REFUSED
    active = [e for e in journal["fixes"] if isinstance(e, dict) and not e.get("undoneAt")]
    if not active:
        log(f"Nenhuma correção para desfazer (diário: {path}).")
        return EXIT_OK
    active.reverse()  # newest first
    lines = [f"Correções aplicadas pelo agente (diário: {path}):"]
    for number, entry in enumerate(active, 1):
        where = "roteador" if entry.get("target") == "router" else "este computador"
        lines.append(f"  {number}. {_format_when(entry.get('appliedAt'))} - {entry.get('title')} ({where})")
    log("\n".join(lines))
    if args.simular:
        for number, entry in enumerate(active, 1):
            specs = entry.get("undo") if isinstance(entry.get("undo"), list) else []
            log(f"\n  {number}. Para desfazer, o agente rodaria:")
            for spec in reversed(specs):
                log(f"     {describe_spec(spec)}")
        log("\n--simular: nada foi desfeito.")
        return EXIT_OK
    if not _stdin_is_interactive():
        log("--desfazer precisa de um terminal interativo: cada ação pede confirmação. Nada foi desfeito.")
        return EXIT_REFUSED
    answer = ask_line(
        "Digite o número da correção que quer desfazer, TODAS para desfazer todas, ou Enter para sair: "
    )
    choice = (answer or "").strip().upper()
    if not choice:
        log("Nada foi desfeito.")
        return EXIT_OK
    if choice == "TODAS":
        selected = active
    elif choice.isdigit() and 1 <= int(choice) <= len(active):
        selected = [active[int(choice) - 1]]
    else:
        log("Opção inválida. Nada foi desfeito.")
        return EXIT_REFUSED
    for entry in selected:
        specs = entry.get("undo") if isinstance(entry.get("undo"), list) else []
        log(f"\nDesfazer: {entry.get('title')}")
        for spec in reversed(specs):
            log(f"   {describe_spec(spec)}")
    prompt = ("Desfazer esta correção? Digite SIM: " if len(selected) == 1
              else f"Desfazer estas {len(selected)} correções? Digite SIM: ")
    confirmation = ask_line(prompt)
    if confirmation is None or confirmation.strip().upper() != "SIM":
        log("Nada foi desfeito.")
        return EXIT_REFUSED
    os_name = detect_os()
    admin = is_admin(os_name) if any(e.get("target") != "router" for e in selected) else True
    if not admin:
        log(admin_help(os_name))
    failures = 0
    for entry in selected:
        if entry.get("target") != "router" and not admin:
            log(f"  Pulada (precisa de administrador): {entry.get('title')}")
            failures += 1
            continue
        if not undo_entry(entry):
            failures += 1
        try:
            save_journal(path, journal)
        except JournalError as exc:
            log(f"  {exc}")
            failures += 1
    return EXIT_OK if failures == 0 else EXIT_FIX_FAILED


# =============================================================================
# Modes
# =============================================================================

def _stdin_is_interactive() -> bool:
    try:
        return bool(sys.stdin) and sys.stdin.isatty()
    except (AttributeError, ValueError):
        return False


def obtain_consent(flag: bool) -> bool:
    if flag:
        log("Consentimento informado com --confirmo-rede-propria.")
        return True
    if not _stdin_is_interactive():
        log(
            "Sem terminal interativo para confirmar. Rode novamente com "
            "--confirmo-rede-propria SOMENTE se a rede for sua ou se você tiver autorização "
            "por escrito."
        )
        return False
    sys.stderr.write(
        "Digite SIM para confirmar que esta rede é sua ou que você tem autorização por "
        "escrito para analisá-la: "
    )
    sys.stderr.flush()
    try:
        answer = input()
    except (EOFError, KeyboardInterrupt):
        return False
    return answer.strip().upper() == "SIM"


def _print_home_banner(net: NetworkInfo, scan_net: ipaddress.IPv4Network, fixing: bool = False) -> None:
    host_count = max(scan_net.num_addresses - 2, 1)
    lines = [
        "=" * 66,
        " Radar360 - modo CASA (análise da rede local)",
        "=" * 66,
        f" IP deste computador : {net.local_ip}",
        f" Rede detectada      : {net.cidr or 'máscara desconhecida (usando /24)'}",
        f" Faixa que será lida : {scan_net} ({host_count} endereços)",
        f" Gateway (roteador)  : {net.gateway or 'desconhecido'}",
        "",
        f" O que será feito: teste de conexão TCP em {len(HOME_PORTS)} portas comuns, leitura",
        " passiva de banners, um único GET / em portas HTTP, descoberta UPnP (SSDP) e",
        " leitura das portas que o roteador abriu pelo UPnP. Nenhuma senha é testada.",
    ]
    if fixing:
        lines += [
            " Com --corrigir: depois da análise, o agente pode propor fechar no SEU roteador",
            " portas abertas pelo UPnP, uma por vez, e só fecha se você digitar SIM.",
        ]
    else:
        lines.append(" Nada é alterado nos aparelhos.")
    lines += [
        "",
        " ATENÇÃO: analise apenas redes que são SUAS ou para as quais você tem",
        " autorização por escrito do responsável. Analisar redes de terceiros pode",
        " ser ilegal.",
    ]
    if net.gateway and _is_ipv4(net.gateway) and ipaddress.IPv4Address(net.gateway) not in scan_net:
        lines.append(" Aviso: o gateway está fora da faixa analisada (pode ser VPN ou rede incomum).")
    lines.append("=" * 66)
    log("\n".join(lines))


def run_home(args: argparse.Namespace) -> int:
    started_at = now_iso()
    started = time.monotonic()
    os_name = detect_os()
    hostname = get_hostname()
    net = detect_network(os_name)

    allowed, reason = check_home_network_allowed(net.local_ip)
    if not allowed:
        log(f"Modo casa recusado: {reason} Nenhum pacote foi enviado para a rede.")
        return EXIT_REFUSED
    scan_net = compute_scan_network(net.local_ip, net.prefix)
    if scan_net is None:
        log(
            "Modo casa recusado: a interface usa uma rede ponto a ponto (/31 ou /32), típica de "
            "VPN. Nenhum pacote foi enviado para a rede."
        )
        return EXIT_REFUSED

    fixing = args.corrigir and not args.simular
    _print_home_banner(net, scan_net, fixing)
    if not obtain_consent(args.confirmo_rede_propria):
        log("Consentimento não confirmado. Análise cancelada: nenhum pacote foi enviado para a rede.")
        return EXIT_REFUSED

    hosts = [str(h) for h in scan_net.hosts()]
    deadline = time.monotonic() + GLOBAL_TIME_CAP  # counted from consent, not from the prompt
    services: list[dict] = []
    mappings: list[dict] = []
    _authorize_probes(scan_net)
    try:
        log(f"Testando {len(HOME_PORTS)} portas TCP em {len(hosts)} endereços (até {MAX_THREADS} conexões simultâneas)...")
        open_map, alive = probe_hosts(hosts, HOME_PORTS, deadline)
        log(f"Lendo identificação de {sum(len(p) for p in open_map.values())} serviços abertos...")
        enrichment = enrich_services(open_map, deadline)
        ssdp: dict[str, dict] = {}
        descriptions: dict[str, dict] = {}
        if time.monotonic() + SSDP_WAIT < deadline:
            log(f"Descoberta UPnP (SSDP) por {SSDP_WAIT:.0f} s...")
            ssdp = ssdp_discover(net.local_ip, scan_net)
            descriptions = fetch_descriptions(ssdp, scan_net, deadline)
        else:
            log("Tempo máximo atingido: descoberta UPnP pulada.")
        services = igd_services(descriptions, scan_net, net.gateway)
        if services and time.monotonic() < deadline:
            log("Lendo as portas que o roteador abriu pelo UPnP (GetGenericPortMappingEntry)...")
            mappings = list_all_port_mappings(services, deadline)
        elif services:
            log("Tempo máximo atingido: leitura das portas abertas pelo UPnP pulada.")
    finally:
        _revoke_probes()

    arp = read_arp_table(os_name)
    wifi_raw = get_wifi_security(os_name)
    devices = assemble_devices(
        scan_net, net.local_ip, net.gateway, hostname, open_map, alive, enrichment, ssdp, descriptions, arp
    )
    base_findings = build_home_findings(devices)
    for extra in (build_wifi_finding(wifi_raw, "home"), detect_arp_spoofing(arp, net.gateway)):
        if extra:
            base_findings.append(extra)

    plans = plan_router_fixes(mappings) if (args.corrigir or args.simular) else []
    applied: list[dict] = []
    if fixing:
        _authorize_probes(scan_net)  # same consented network, own router only
        try:
            applied = run_fix_flow(plans, os_name, hostname)
            if applied:
                log("Conferindo de novo as portas abertas pelo UPnP no roteador...")
                mappings = list_all_port_mappings(services, time.monotonic() + UPNP_RELIST_CAP)
        finally:
            _revoke_probes()
        if not plans:
            log("Para corrigir este computador (firewall, compartilhamento etc.), use --mode public --corrigir.")

    findings = base_findings + build_upnp_mapping_findings(mappings)
    payload = build_payload(
        "home", started_at, os_name, hostname, net.local_ip, str(scan_net), net.gateway,
        wifi_security_label(wifi_raw), [d.to_payload() for d in devices], findings, applied,
    )
    code = finish(payload, args, time.monotonic() - started)
    if args.simular:
        show_simulation(plans)
    return code


def audit_public(os_name: str, hostname: str) -> PublicAudit:
    """Local read-only checks of this computer. Sends no packet to any other host."""
    net = detect_network(os_name)
    profiles = get_connection_profiles(os_name)
    active = {p["category"] for p in profiles if p.get("category")}
    firewall = get_firewall_status(os_name, active)
    fw_rules = get_windows_firewall_rules(os_name)
    listeners = get_listening_ports(os_name)
    wifi_raw = get_wifi_security(os_name)
    arp = read_arp_table(os_name)

    findings: list[dict] = [build_firewall_finding(firewall, os_name)]
    findings += build_profile_findings(profiles)
    if listeners is None:
        findings.append(make_finding(
            "info", "listening_ports_unknown", "Não foi possível listar as portas abertas",
            "Os comandos do sistema para listar portas em escuta não estão disponíveis "
            "(desconhecido).",
            "Rode o agente com um usuário que tenha acesso a netstat/ss/lsof.",
        ))
    else:
        blocked = compute_blocked_ports(firewall, fw_rules, active)
        findings += build_listener_findings(listeners, firewall.enabled, blocked)
    for extra in (
        build_wifi_finding(wifi_raw, "public"),
        build_hostname_finding(hostname),
        detect_arp_spoofing(arp, net.gateway),
    ):
        if extra:
            findings.append(extra)
    findings += build_ip_findings(net.local_ip)
    return PublicAudit(os_name, hostname, net, profiles, firewall, fw_rules, listeners, wifi_raw, findings)


def run_public(args: argparse.Namespace) -> int:
    """Audits only this computer. Sends no packet to any other host."""
    started_at = now_iso()
    started = time.monotonic()
    os_name = detect_os()
    hostname = get_hostname()
    log("Modo público: verificando apenas este computador (nenhum pacote é enviado para outros aparelhos).")
    audit = audit_public(os_name, hostname)

    plans = plan_computer_fixes(audit) if (args.corrigir or args.simular) else []
    applied: list[dict] = []
    if args.corrigir and not args.simular:
        applied = run_fix_flow(plans, os_name, hostname)
        if applied:
            log("Refazendo a auditoria para conferir o resultado das correções...")
            audit = audit_public(os_name, hostname)

    net = audit.net
    payload = build_payload(
        "public", started_at, os_name, hostname, net.local_ip, net.cidr, net.gateway,
        wifi_security_label(audit.wifi_raw), [], audit.findings, applied,
    )
    code = finish(payload, args, time.monotonic() - started)
    if args.simular:
        show_simulation(plans)
    return code


# =============================================================================
# CLI
# =============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="scanner.py",
        allow_abbrev=False,  # consent and fix flags must be typed in full
        description=(
            "Radar360 - agente local de auditoria de rede. Modo 'home' analisa a SUA rede "
            "doméstica (exige consentimento); modo 'public' verifica só este computador."
        ),
    )
    parser.add_argument("--mode", choices=VALID_MODES,
                        help="home = rede de casa (com consentimento); public = só este computador")
    parser.add_argument("--confirmo-rede-propria", dest="confirmo_rede_propria", action="store_true",
                        help="confirma, sem pergunta interativa, que a rede é sua ou que você tem autorização")
    # Deliberately there is no flag to apply every fix at once: each one asks for SIM.
    parser.add_argument("--corrigir", action="store_true",
                        help="depois da auditoria, oferece correções seguras uma a uma; cada uma só é "
                             "aplicada se você digitar SIM")
    parser.add_argument("--simular", action="store_true",
                        help="mostra as correções que seriam feitas, sem aplicar nada")
    parser.add_argument("--desfazer", action="store_true",
                        help="lista as correções feitas pelo agente e desfaz a escolhida (ou todas), "
                             "com confirmação")
    parser.add_argument("--api", help="URL base da API do Radar360 (https://...)")
    parser.add_argument("--token", help=f"token de pareamento (ou variável de ambiente {TOKEN_ENV_VAR})")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true",
                        help="nunca envia nada para a API")
    parser.add_argument("--json", action="store_true", help="imprime o JSON enviado à API")
    parser.add_argument("--output", help="salva o JSON neste arquivo")
    parser.add_argument("--version", action="version", version=AGENT_VERSION)
    return parser


def _configure_streams() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass


def main(argv: list[str] | None = None) -> int:
    _configure_streams()
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    if args.desfazer:
        if args.corrigir:
            parser.error("--desfazer não pode ser usado junto com --corrigir.")
        try:
            return run_undo(args)
        except KeyboardInterrupt:
            _revoke_probes()
            log("Interrompido pelo usuário.")
            return 130
    if not args.mode:
        parser.error("informe --mode home ou --mode public (ou use --desfazer).")
    if args.api:
        try:
            args.api = validate_api_url(args.api)
        except ValueError as exc:
            parser.error(str(exc))
        args.token = (args.token or os.environ.get(TOKEN_ENV_VAR) or "").strip() or None
        if not args.token and not args.dry_run:
            parser.error(f"--api exige --token (ou a variável de ambiente {TOKEN_ENV_VAR}).")
    try:
        if args.mode == "home":
            return run_home(args)
        return run_public(args)
    except KeyboardInterrupt:
        _revoke_probes()
        log("Interrompido pelo usuário.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
