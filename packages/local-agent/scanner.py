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
(max 4 KB) on HTTP ports, SSDP M-SEARCH and fetching the UPnP device
description from a LOCATION inside the scanned subnet. Nothing else: no logins,
no passwords, no exploits, no fuzzing. The agent never changes system settings.

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

# --- Local commands / upload -------------------------------------------------
CMD_TIMEOUT = 10.0
POWERSHELL_TIMEOUT = 20.0
UPLOAD_TIMEOUT = 15.0

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


def run_cmd(cmd: list[str], timeout: float = CMD_TIMEOUT) -> str | None:
    """Run a local, read-only OS command. Never raises: returns None on failure."""
    kwargs: dict = {}
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    else:
        env = dict(os.environ)
        env["LC_ALL"] = "C"
        env["LANG"] = "C"
        kwargs["env"] = env
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
        profiles.append({"name": str(item.get("Name") or ""), "category": category})
    return profiles


def get_connection_profiles(os_name: str) -> list[dict]:
    if os_name != "windows":
        return []
    out = run_cmd(
        [
            "powershell", "-NoProfile", "-NonInteractive", "-Command",
            "Get-NetConnectionProfile | Select-Object Name,NetworkCategory | ConvertTo-Json",
        ],
        timeout=POWERSHELL_TIMEOUT,
    )
    return parse_connection_profiles(out) if out else []


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


def build_listener_findings(listeners: list[Listener], firewall_enabled: bool | None) -> list[dict]:
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
        "-InterfaceAlias 'Wi-Fi' -NetworkCategory Public. O agente não altera nada sozinho.",
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


def _xml_tag(text: str, tag: str) -> str | None:
    match = re.search(rf"<(?:\w+:)?{tag}\b[^>]*>(.*?)</(?:\w+:)?{tag}\s*>", text, re.S | re.I)
    if not match:
        return None
    value = re.sub(r"\s+", " ", html.unescape(match.group(1))).strip()
    return value[:100] or None


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
    return parse_device_description(data.decode("utf-8", errors="replace"))


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


def sanitize_payload(payload: dict) -> dict:
    """Enforce the API contract: exact keys, enums, list and string limits."""
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
    return {
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


def _print_home_banner(net: NetworkInfo, scan_net: ipaddress.IPv4Network) -> None:
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
        " passiva de banners, um único GET / em portas HTTP e descoberta UPnP (SSDP).",
        " Nenhuma senha é testada e nada é alterado nos aparelhos.",
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

    _print_home_banner(net, scan_net)
    if not obtain_consent(args.confirmo_rede_propria):
        log("Consentimento não confirmado. Análise cancelada: nenhum pacote foi enviado para a rede.")
        return EXIT_REFUSED

    hosts = [str(h) for h in scan_net.hosts()]
    deadline = time.monotonic() + GLOBAL_TIME_CAP  # counted from consent, not from the prompt
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
    finally:
        _revoke_probes()

    arp = read_arp_table(os_name)
    wifi_raw = get_wifi_security(os_name)
    devices = assemble_devices(
        scan_net, net.local_ip, net.gateway, hostname, open_map, alive, enrichment, ssdp, descriptions, arp
    )
    findings = build_home_findings(devices)
    for extra in (build_wifi_finding(wifi_raw, "home"), detect_arp_spoofing(arp, net.gateway)):
        if extra:
            findings.append(extra)
    payload = build_payload(
        "home", started_at, os_name, hostname, net.local_ip, str(scan_net), net.gateway,
        wifi_security_label(wifi_raw), [d.to_payload() for d in devices], findings,
    )
    return finish(payload, args, time.monotonic() - started)


def run_public(args: argparse.Namespace) -> int:
    """Audits only this computer. Sends no packet to any other host."""
    started_at = now_iso()
    started = time.monotonic()
    os_name = detect_os()
    hostname = get_hostname()
    log("Modo público: verificando apenas este computador (nenhum pacote é enviado para outros aparelhos).")
    net = detect_network(os_name)
    profiles = get_connection_profiles(os_name)
    active = {p["category"] for p in profiles if p.get("category")}
    firewall = get_firewall_status(os_name, active)
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
        findings += build_listener_findings(listeners, firewall.enabled)
    for extra in (
        build_wifi_finding(wifi_raw, "public"),
        build_hostname_finding(hostname),
        detect_arp_spoofing(arp, net.gateway),
    ):
        if extra:
            findings.append(extra)
    findings += build_ip_findings(net.local_ip)

    payload = build_payload(
        "public", started_at, os_name, hostname, net.local_ip, net.cidr, net.gateway,
        wifi_security_label(wifi_raw), [], findings,
    )
    return finish(payload, args, time.monotonic() - started)


# =============================================================================
# CLI
# =============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="scanner.py",
        description=(
            "Radar360 - agente local de auditoria de rede. Modo 'home' analisa a SUA rede "
            "doméstica (exige consentimento); modo 'public' verifica só este computador."
        ),
    )
    parser.add_argument("--mode", choices=VALID_MODES, required=True,
                        help="home = rede de casa (com consentimento); public = só este computador")
    parser.add_argument("--confirmo-rede-propria", dest="confirmo_rede_propria", action="store_true",
                        help="confirma, sem pergunta interativa, que a rede é sua ou que você tem autorização")
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
