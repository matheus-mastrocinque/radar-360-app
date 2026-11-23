# Radar360 — agente local

Script Python (`scanner.py`, arquivo único, só biblioteca padrão, Python 3.11+) que audita a
segurança da **sua** rede doméstica ou do **seu** computador e, opcionalmente, envia o
resultado para a API do Radar360. Funciona em Windows, macOS e Linux.

O agente **nunca altera configurações** do sistema: ele só explica como corrigir.

## Os dois modos

### `--mode public` — rede pública (café, hotel, aeroporto)

Audita **apenas este computador** com comandos locais do sistema. **Não envia nenhum pacote
para outros aparelhos** (sem ping, sem varredura, sem SSDP). O único tráfego possível é o envio
opcional para a API.

Verifica:

- portas TCP em escuta para a rede x só em `localhost` (`netstat` / `ss` / `lsof`), com destaque
  para SMB 445/139, RDP 3389, SSH 22, VNC 5900, bancos (5432, 3306, 27017, 6379, 1433) e
  servidores de desenvolvimento (3000, 5173, 8000, 8080). Texto: "pode estar exposto" com
  firewall ativo, "provavelmente exposto" com firewall desligado;
- estado do firewall (`netsh advfirewall`, `socketfilterfw`, `ufw` / `firewall-cmd`);
- no Windows, se a rede está marcada como **Privada** (`Get-NetConnectionProfile`);
- segurança do Wi-Fi atual (`netsh wlan`, `nmcli --rescan no`, `airport -I` / `ipconfig getsummary`);
- nome do computador que revela o dono (ex.: `MacBook-de-Joao`, `Joaos-iPhone`);
- sinal de ARP spoofing na tabela ARP local (MAC do gateway repetido em outro IP);
- IP público atribuído diretamente ao computador.

Comando ausente ou sem permissão vira "desconhecido"; o agente não quebra.

### `--mode home` — rede de casa

Analisa os aparelhos da **sua** rede local. Antes de qualquer pacote, mostra IP local, rede
(CIDR) e gateway e exige consentimento: digitar `SIM` (confirmando que a rede é sua ou que
você tem autorização por escrito) ou usar `--confirmo-rede-propria` em uso não interativo.
Sem consentimento, sai sem enviar nada.

Coleta: portas abertas (21, 22, 23, 53, 80, 139, 443, 445, 554, 1883, 3389, 5000, 5900, 7547,
8000, 8080, 8443, 8888, 9100, 49152), banners, `Server`/`<title>` de páginas HTTP, MAC pela
tabela ARP, fabricante/modelo pelo UPnP (SSDP). Gera achados como Telnet aberto (alto), VNC
(alto), SMB/RDP/FTP/RTSP/TR-069/MQTT (médio), painel HTTP do roteador/câmera, UPnP ativo (baixo)
e "possivelmente desatualizado" **apenas** quando uma versão foi realmente lida.

## Garantias de segurança

- Só faz: conexão TCP (connect), leitura passiva do banner que o serviço envia sozinho, **um**
  `GET /` sem autenticação (lê no máximo 4 KB) em portas HTTP, um M-SEARCH SSDP e o download do
  XML de descrição UPnP **somente** se o `LOCATION` for um IP dentro da sub-rede analisada.
- Nunca: login, senha padrão, força bruta, exploit, fuzzing, DNS reverso.
- Modo casa só roda em IP privado RFC1918 (10/8, 172.16/12, 192.168/16). Recusa CGNAT
  (100.64/10), IP público, loopback, link-local e redes /31–/32 (VPN).
- Analisa no máximo uma /24 (254 endereços), até 64 conexões simultâneas, timeout de 0,4 s por
  conexão e limite global de 120 s.
- Toda função de sondagem verifica uma trava interna: sem consentimento registrado, ou com IP
  fora da faixa autorizada, ela se recusa a rodar.
- `vendor` vai sempre `null` (a consulta de fabricante por MAC é feita no servidor). O agente não
  envia nome da rede Wi-Fi (SSID).
- Upload exige `https://` (só `http://localhost`/`127.0.0.1` é aceito), não segue
  redirecionamentos (o token não vaza) e `--dry-run` nunca envia nada.

## Uso

```bash
python scanner.py --version
python scanner.py --mode public                       # resumo legível
python scanner.py --mode public --dry-run --json      # imprime o JSON, não envia
python scanner.py --mode public --output relatorio.json
python scanner.py --mode home                         # pergunta e espera você digitar SIM
python scanner.py --mode home --confirmo-rede-propria --api https://api.exemplo.com --token SEU_TOKEN
```

O token também pode vir da variável de ambiente `RADAR360_PAIRING_TOKEN` (evita deixá-lo no
histórico do terminal). Com `--json`, o JSON sai no stdout e o resumo no stderr.

Códigos de saída: `0` ok, `1` recusado (sem consentimento / rede não permitida), `2` erro de
argumentos, `3` falha no envio para a API.

Testes (da pasta `packages/local-agent`):

```bash
python -I -m unittest discover -s tests
```

## JSON enviado

`POST {api}/network/scans` com `Content-Type: application/json` e `X-Pairing-Token: <token>`:

```json
{
  "agentVersion": "0.1.0",
  "mode": "home",
  "startedAt": "2026-11-22T17:15:50Z",
  "finishedAt": "2026-11-22T17:16:31Z",
  "host": { "os": "windows", "hostname": "notebook-01" },
  "network": { "localIp": "192.168.0.10", "cidr": "192.168.0.0/24", "gateway": "192.168.0.1",
               "isPrivate": true, "wifiSecurity": "WPA2" },
  "devices": [
    { "ip": "192.168.0.1", "mac": "aa:bb:cc:dd:ee:ff", "vendor": null, "hostname": null,
      "model": "ACME Router X RX1", "openPorts": [23, 80],
      "services": [ { "port": 80, "protocol": "tcp", "name": "http", "banner": "Server: lighttpd/1.4.35 | Título: Login" } ] }
  ],
  "findings": [
    { "severity": "high", "kind": "telnet_open", "title": "Telnet aberto (acesso sem criptografia)",
      "detail": "...", "recommendation": "...", "deviceIp": "192.168.0.1", "port": 23 }
  ]
}
```

- `severity`: `info` | `low` | `medium` | `high` | `critical`; achados ordenados do mais grave.
- `wifiSecurity`: `OPEN`, `WEP`, `WPA`, `WPA2`, `WPA3` (com sufixo `-Enterprise` quando for o
  caso) ou `null` se desconhecido / sem Wi-Fi.
- No modo `public`, `devices` é sempre `[]`.
- Limites: até 256 dispositivos, 500 achados, textos com até 500 caracteres (cortados),
  `kind` com até 64 caracteres no formato `^[a-z0-9_]+$`, `port` pode ser `null`.
