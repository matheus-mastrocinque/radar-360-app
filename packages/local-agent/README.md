# Olharium — agente local

Script Python (`scanner.py`, arquivo único, só biblioteca padrão, Python 3.11+) que audita a
segurança da **sua** rede doméstica ou do **seu** computador e, opcionalmente, envia o
resultado para a API. Funciona em Windows, macOS e Linux.

Por padrão o agente **só audita** e explica como corrigir. Com `--corrigir`, ele oferece
correções seguras **uma por vez** e só aplica cada uma depois que você digita `SIM`. Não existe
opção para aplicar tudo de uma vez. Toda correção pode ser desfeita com `--desfazer`.

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
- no Windows, se o firewall comprovadamente bloqueia a porta: regra de bloqueio do agente
  (`Olharium: bloqueio da porta N`) ou, para SMB, rede no perfil Público com as regras de
  "Compartilhamento de arquivos e impressoras" desativadas. Nesse caso o achado vira
  `port_blocked_by_firewall` (info). A leitura usa o repositório de regras do firewall no
  registro (`HKLM\...\FirewallPolicy\FirewallRules`), que não depende do idioma e leva ~1 s;
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

**Portas abertas para a Internet pelo UPnP.** Se o roteador anuncia o serviço IGD
(`WANIPConnection:1/2` ou `WANPPPConnection:1`) num `LOCATION` dentro da sub-rede analisada, o
agente lê o `controlURL` do XML de descrição e lista os mapeamentos com
`GetGenericPortMappingEntry` (índice 0, 1, 2... até o roteador responder erro; no máximo 64).
Quando o gateway é conhecido, só o IGD do gateway é usado. Cada mapeamento vira um achado
`upnp_port_mapping` com porta externa, protocolo, IP e porta internos e a descrição:
**alto** quando a porta (externa ou interna) é sensível (23, 22, 3389, 445, 139, 5900, 1883,
3306, 5432, 6379, 27017, 7547), **médio** nos demais casos e **baixo** se o mapeamento estiver
desativado.

## Correções: `--corrigir`, `--simular` e `--desfazer`

```bash
python scanner.py --mode public --corrigir     # este computador (abra o terminal como administrador)
python scanner.py --mode home --corrigir       # mapeamentos UPnP do seu roteador
python scanner.py --mode public --simular      # mostra o que seria feito, não aplica nada
python scanner.py --desfazer                   # lista o que o agente mudou e desfaz, com confirmação
python scanner.py --desfazer --simular         # só mostra os comandos que desfariam
```

Depois da auditoria normal, para **cada** achado com correção segura o agente mostra o
problema, o que vai mudar, o **comando exato**, o risco, como desfazer e o comando que desfaz,
e pergunta `Aplicar esta correção? Digite SIM`. Qualquer outra resposta (ou fim da entrada)
não aplica. Sem terminal interativo, nada é aplicado e o agente só mostra as correções. Se uma
correção tem várias etapas e uma falha, as etapas já feitas são revertidas na hora.

Depois das correções, o agente **refaz a auditoria** (no modo casa, lê de novo os mapeamentos
UPnP) e envia o resultado à API com o campo `fixes` (ver abaixo).

### O que é corrigido

| Achado (`kind`) | Correção (`kind` da correção) | Comando | Desfazer |
| --- | --- | --- | --- |
| `firewall_disabled`, `firewall_partially_disabled`, `firewall_profile_disabled` (Windows) | Liga o firewall só nos perfis desligados (`firewall_enabled`) | `netsh advfirewall set <domain\|private\|public>profile state on` | `... state off` só nesses perfis |
| `firewall_disabled` (macOS) | `firewall_enabled` | `/usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on` | `--setglobalstate off` |
| `firewall_disabled` com ufw instalado (Linux) | `firewall_enabled` | `ufw enable` | `ufw disable` |
| `network_marked_private` (Windows) | Rede vira Pública (`network_set_public`) | `Set-NetConnectionProfile -InterfaceIndex <i> -NetworkCategory Public` | `-NetworkCategory Private` |
| `exposed_smb` (Windows) | Desativa as regras de entrada ativas do grupo "Compartilhamento de arquivos e impressoras" que valem no perfil Público (`smb_public_rules_disabled`). O grupo é identificado por `@FirewallAPI.dll,-28502`, igual em qualquer idioma | `Disable-NetFirewallRule -Name '<regra>',...` | `Enable-NetFirewallRule` com exatamente as mesmas regras |
| `exposed_rdp` (Windows, com `fDenyTSConnections = 0`) | Desliga a Área de Trabalho Remota (`rdp_disabled`) | `reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 1 /f` | o mesmo com `/d 0` |
| `exposed_database`, `exposed_dev_server` (Windows) | Regra de bloqueio de entrada (`port_blocked`) | `New-NetFirewallRule -Name 'Olharium-Block-TCP-<porta>' -DisplayName 'Olharium: bloqueio da porta <porta>' -Direction Inbound -Action Block -Protocol TCP -LocalPort <porta> -Profile Any` | `Remove-NetFirewallRule -Name 'Olharium-Block-TCP-<porta>'` |
| `upnp_port_mapping` (modo casa) | Remove o mapeamento do **seu** roteador (`upnp_mapping_removed`) | ação UPnP `DeletePortMapping` | `AddPortMapping` com os mesmos dados (se o roteador só aceitar permanentes, repete com duração 0) |

Os comandos do PowerShell rodam com `$ErrorActionPreference = 'Stop'`, para que qualquer erro
vire falha. Os demais achados (SSH, VNC, Wi-Fi, nome do computador, firewalld etc.) continuam só
com orientação. No macOS e no Linux, só o firewall é corrigido.

### Administrador

As correções neste computador exigem administrador (Windows: `IsUserAnAdmin`; macOS/Linux:
`root`). Sem privilégio, o agente explica como abrir o terminal como administrador (ou usar
`sudo`), pula essas correções e segue com as que não precisam, como as do roteador. O
`--desfazer` segue a mesma regra.

### Diário e `--desfazer`

Cada correção aplicada é gravada em um diário local, com o que mudou e os dados para desfazer:

- Windows: `%LOCALAPPDATA%\Olharium\fixes.json`
- macOS/Linux: `~/.olharium/fixes.json` (permissão `600`)

Se o diário não puder ser lido, nenhuma correção é aplicada (não haveria como desfazer). Se não
puder ser gravado depois de aplicar, o agente mostra na tela o comando que desfaz.

`--desfazer` lista as correções ativas (mais recente primeiro) e pede o número de uma, `TODAS`
ou Enter para sair; depois mostra os comandos e pede `SIM`. As etapas são desfeitas da mais
recente para a mais antiga. Se uma etapa falhar, o diário guarda só o que ainda está aplicado.
Para desfazer uma correção do roteador, é preciso estar na mesma rede (privada, RFC1918, com o
roteador dentro da faixa analisada).

O diário é um arquivo que o usuário pode editar, então **nada dele é executado como texto**: os
dados de desfazer são validados (perfis, índices, nomes de regra, portas, IPs privados, ações
UPnP permitidas) e o comando é remontado a partir de uma lista fixa. Dado inválido é recusado.

## Garantias de segurança

- Só faz: conexão TCP (connect), leitura passiva do banner que o serviço envia sozinho, **um**
  `GET /` sem autenticação (lê no máximo 4 KB) em portas HTTP, um M-SEARCH SSDP, o download do
  XML de descrição UPnP **somente** se o `LOCATION` for um IP dentro da sub-rede analisada e,
  no IGD do roteador, as ações SOAP `GetGenericPortMappingEntry` (leitura), `DeletePortMapping`
  (só numa correção confirmada com `SIM`) e `AddPortMapping` (só para desfazer). Nenhuma outra
  ação UPnP é aceita.
- Nunca: login, senha (nem no roteador), força bruta, exploit, fuzzing, DNS reverso, alteração
  de outro aparelho.
- Nada é alterado sem `--corrigir` e um `SIM` digitado para aquela correção específica. Não há
  modo de aplicar tudo de uma vez, e as opções não aceitam abreviação.
- **Roteador só se for seu.** O `SIM` do modo casa não distingue a sua casa de um café (os dois
  usam 192.168.x.x). Por isso, antes de qualquer correção no roteador, o agente mostra o IP e o
  endereço físico (MAC) do gateway e pede que você digite `MEU ROTEADOR`. Em Wi-Fi aberto (sem
  senha) ou corporativo (Enterprise/802.1X), ele nem oferece correção no roteador.
- Modo casa só roda em IP privado RFC1918 (10/8, 172.16/12, 192.168/16). Recusa CGNAT
  (100.64/10), IP público, loopback, link-local e redes /31–/32 (VPN).
- Analisa no máximo uma /24 (254 endereços), até 64 conexões simultâneas, timeout de 0,4 s por
  conexão e limite global de 120 s.
- Toda função de sondagem (incluindo as chamadas SOAP) verifica uma trava interna: sem
  consentimento registrado, ou com IP fora da faixa autorizada, ela se recusa a rodar.
- `vendor` vai sempre `null` (a consulta de fabricante por MAC é feita no servidor). O agente não
  envia nome da rede Wi-Fi (SSID), nem no título das correções.
- Upload exige `https://` (só `http://localhost`/`127.0.0.1` é aceito), não segue
  redirecionamentos (o token não vaza) e `--dry-run` nunca envia nada.

## Uso

```bash
python scanner.py --version
python scanner.py --mode public                       # resumo legível
python scanner.py --mode public --dry-run --json      # imprime o JSON, não envia
python scanner.py --mode public --output relatorio.json
python scanner.py --mode public --dry-run --simular   # auditoria + correções possíveis, sem aplicar nem enviar
python scanner.py --mode home                         # pergunta e espera você digitar SIM
python scanner.py --mode home --confirmo-rede-propria --api https://api.exemplo.com --token SEU_TOKEN
```

O token também pode vir da variável de ambiente `RADAR360_PAIRING_TOKEN` (evita deixá-lo no
histórico do terminal). Com `--json`, o JSON sai no stdout; o resumo, as correções e as
perguntas saem no stderr.

Códigos de saída: `0` ok, `1` recusado (sem consentimento / rede não permitida / `--desfazer` sem
confirmação), `2` erro de argumentos, `3` falha no envio para a API, `4` alguma correção não pôde
ser desfeita (`--desfazer`).

Testes (da pasta `packages/local-agent`; nenhum teste altera o sistema nem usa a rede):

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
      "detail": "...", "recommendation": "...", "deviceIp": "192.168.0.1", "port": 23 },
    { "severity": "medium", "kind": "upnp_port_mapping", "title": "Porta 8080/TCP aberta para a Internet pelo UPnP",
      "detail": "...", "recommendation": "...", "deviceIp": "192.168.0.1", "port": 8080 }
  ],
  "fixes": [
    { "kind": "upnp_mapping_removed", "target": "router",
      "title": "Porta 3389/TCP fechada no roteador (mapeamento UPnP removido)",
      "appliedAt": "2026-11-22T17:16:20Z", "findingKind": "upnp_port_mapping" }
  ]
}
```

- `severity`: `info` | `low` | `medium` | `high` | `critical`; achados ordenados do mais grave.
- `wifiSecurity`: `OPEN`, `WEP`, `WPA`, `WPA2`, `WPA3` (com sufixo `-Enterprise` quando for o
  caso) ou `null` se desconhecido / sem Wi-Fi.
- No modo `public`, `devices` é sempre `[]`.
- Limites: até 256 dispositivos, 500 achados, textos com até 500 caracteres (cortados),
  `kind` com até 64 caracteres no formato `^[a-z0-9_]+$`, `port` pode ser `null`.
- `fixes` é **opcional** e só aparece quando a execução aplicou alguma correção. Traz apenas as
  correções aplicadas **nesta execução** (nunca as desfeitas), no máximo 50 itens:
  - `kind`: `^[a-z0-9_]+$`, até 64 caracteres (`firewall_enabled`, `network_set_public`,
    `smb_public_rules_disabled`, `rdp_disabled`, `port_blocked`, `upnp_mapping_removed`);
  - `target`: `computer` ou `router`;
  - `title`: até 200 caracteres, em português;
  - `appliedAt`: data e hora ISO 8601 em UTC (`2026-11-26T12:00:00Z`);
  - `findingKind` (opcional): o achado que a correção resolveu, no mesmo formato de `kind`.
- Achados novos: `upnp_port_mapping` (modo casa) e `port_blocked_by_firewall` (modo público, info).
