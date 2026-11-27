# Olharium: roteiro de teste

Roteiro para testar o produto à mão antes do vídeo e da submissão. Atualizado em 26/11/2026.

Os testes vão do **mais complexo** (agente corrigindo o PC e o roteador de verdade) ao **mais simples** (abrir o site). Os níveis 5 e 4 precisam de terminal e configuração; do nível 3 para baixo, basta o navegador.

**Endereços:**
- Site: [radar360-web.vercel.app](https://radar360-web.vercel.app)
- API: [radar360-api-hazel.vercel.app/health](https://radar360-api-hazel.vercel.app/health)
- Local: site em `http://localhost:3000` e API em `http://localhost:3333`, depois de `npm run db:up` e `npm run dev`

> **Não envie auditoria real para a produção.** As auditorias de rede pertencem à persona da demo, e o painel mostra a mais recente. Uma auditoria enviada à API de produção passa a aparecer para **todo jurado**, com os IPs e os aparelhos da sua rede, no lugar das auditorias de exemplo. O envio se testa só no ambiente local (teste 5.5). Na produção, use sempre `--dry-run`.

| Nível | O que testa | Onde | Tempo |
| --- | --- | --- | --- |
| 5 | Agente local: auditar e corrigir de verdade, desfazer, enviar o resultado | Seu PC e seu roteador, terminal | 40 min |
| 4 | Monitoramento automático (GitHub Actions) | GitHub | 10 min |
| 3 | Copiloto: LGPD, relato livre, "empresa me avisou" | Navegador | 25 min |
| 2 | Minhas contas e a central de comando | Navegador | 20 min |
| 1 | Entrada, sessão, privacidade, celular e saúde do sistema | Navegador | 10 min |

---

## Nível 5: agente local (o mais complexo)

O agente fica em `packages/local-agent`. Rode os comandos dessa pasta, com Python 3.11 ou mais novo. Use só o seu PC e a sua rede.

### 5.1 Simulação, sem mudar nada

```powershell
python scanner.py --mode public --dry-run --simular
```

- [ ] Mostra o resumo da auditoria deste computador: firewall, portas, perfil de rede e Wi-Fi.
- [ ] Lista as correções possíveis com o comando de cada uma, **sem aplicar** nenhuma.
- [ ] Nada sai do computador: sem `--api`, o agente não envia o resultado a lugar nenhum.

### 5.2 Correção real neste computador, e desfazer

Abra o terminal **como administrador** (Win + X → Terminal (Admin)).

**Prepare um cenário seguro**, porque um PC já bem configurado não tem o que corrigir:
1. Anote como a sua rede está agora:
   ```powershell
   Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory
   ```
2. Se ela estiver como `Public`, marque como Privada (troque `Wi-Fi` pelo `InterfaceAlias` que apareceu):
   ```powershell
   Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
   ```

**Corrija com o agente:**

```powershell
python scanner.py --mode public --corrigir
```

- [ ] O agente acha "Rede atual marcada como Privada no Windows" e oferece "Marcar a rede … como Pública".
- [ ] Antes de aplicar, mostra o que vai mudar e como desfazer, e pede `SIM`.
- [ ] Digite qualquer outra coisa: aparece "Não aplicada.", e nada muda.
- [ ] Rode de novo e digite `SIM`: `Get-NetConnectionProfile` passa a mostrar `Public`.
- [ ] O arquivo `%LOCALAPPDATA%\Olharium\fixes.json` foi criado com essa correção.
- [ ] Não existe opção de aplicar tudo de uma vez: cada correção pede o próprio `SIM`.

**Desfaça:**

```powershell
python scanner.py --desfazer
```

- [ ] Lista a correção ativa, pede o número (ou `TODAS`) e depois `SIM`.
- [ ] A rede volta para `Private`.
- [ ] Rodando `--desfazer` de novo, não há mais nada para desfazer.

**Sem administrador:** num terminal comum, `python scanner.py --mode public --corrigir`.
- [ ] O agente explica como abrir como administrador e pula as correções deste computador.

No fim, deixe a rede como estava no passo 1.

### 5.3 Rede de casa com consentimento

Conectado à **sua** rede de casa, num terminal comum:

```powershell
python scanner.py --mode home --dry-run
```

- [ ] Antes de enviar qualquer pacote, mostra o IP local, a rede (por exemplo `192.168.0.0/24`) e o gateway.
- [ ] Pede `SIM`. Digite `nao`: o agente sai sem varrer nada, com código 1.
- [ ] Rode de novo e digite `SIM`: lista os aparelhos, as portas abertas e os achados (Telnet, painel sem HTTPS, UPnP...).
- [ ] Nenhum achado vem de tentativa de senha: o agente só olha portas e respostas públicas.

### 5.4 Fechar uma porta do roteador (UPnP), e desfazer

Só funciona se o seu roteador tiver o UPnP ligado e algum mapeamento aberto (videogame, câmera, torrent costumam abrir).

```powershell
python scanner.py --mode home --corrigir
```

- [ ] Se houver mapeamento, aparece o achado "Porta <número>/TCP aberta para a Internet pelo UPnP", com o IP interno e a descrição.
- [ ] Antes de qualquer correção, o agente mostra o IP e o endereço físico do roteador e pede `MEU ROTEADOR`. Digite outra coisa: aparece "Roteador não confirmado como seu" e nada muda.
- [ ] Rode de novo e digite `MEU ROTEADOR`: o agente oferece remover o mapeamento, mostra como desfazer e pede `SIM`.
- [ ] Num Wi-Fi aberto (sem senha), o agente avisa "Correções no roteador desativadas" e não oferece nada no roteador.
- [ ] Depois do `SIM`, rodando de novo, o mapeamento sumiu.
- [ ] O agente **não pediu senha do roteador** nem tentou entrar no painel dele.
- [ ] `python scanner.py --desfazer` (na mesma rede) recria o mapeamento.

Se o roteador não tiver mapeamentos, anote "sem UPnP para testar". O fluxo está coberto pelos testes automáticos (nível 0).

### 5.5 Enviar o resultado ao painel (só no ambiente local)

1. Na raiz do repositório, rode `npm run db:up`, depois `npm run db:seed` e depois `npm run dev`.
2. O `db:seed` imprime um "Token de pareamento do agente". Copie.
3. Na pasta do agente:
   ```powershell
   $env:RADAR360_PAIRING_TOKEN = "<token do seed local>"
   python scanner.py --mode public --api http://localhost:3333
   ```

- [ ] O agente termina com "Resposta da API: HTTP 201".
- [ ] Em `http://localhost:3000` → "Entrar como demo": o nó "Wi-Fi público" do mapa e o painel "Agente local" mostram a auditoria nova.
- [ ] Se você aplicou correções nessa execução, elas aparecem com o selo verde ✓ e em "Corrigido pelo agente, com o seu OK".
- [ ] Com um token errado, o agente informa a falha no envio e sai com código 3.

---

## Nível 4: monitoramento automático

Antes, crie os dois secrets em GitHub → Settings → Secrets and variables → Actions:
- `RADAR_API_URL` = `https://radar360-api-hazel.vercel.app`, sem barra no fim;
- `RADAR_JOBS_SECRET` = o valor de `JOBS_SECRET` da API (o Matheus tem).

### 4.1 Rodar o job na mão

Opcional, antes de criar os secrets: rode o workflow uma vez.
- [ ] Ele só avisa que faltam os secrets e termina verde, sem chamar a API.

Com os secrets criados: GitHub → Actions → **Busca de vazamentos** → Run workflow.

- [ ] O passo do `breach-catalog` responde 200 com `received`, `created`, `updated`, `skipped` e `removed`. Hoje vem cerca de 1.055 recebidos e 0 criados.
- [ ] O passo do `breach-check` responde 200 com `assetsChecked` e `newExposures`.
- [ ] O workflow passa a rodar sozinho a cada 6 horas. Confira na aba Actions no dia seguinte.

---

## Nível 3: copiloto de incidentes

Do nível 3 para baixo, tudo é na produção, pelo botão "Entrar como demo".

### 3.1 Notificação LGPD com prazo vencido e petição à ANPD

A demo já traz um caso pronto: a notificação à TeleConecta foi "enviada" há 17 dias.

Copiloto → Acompanhamento → o plano da **TeleConecta Telecom (fictícia)**.

- [ ] A régua do prazo mostra "15 de 15 dias · vencido", e o aviso diz "Prazo vencido" com a data.
- [ ] A **petição à ANPD** aparece pronta, com o texto, o checklist e os links do gov.br.
- [ ] O botão "Copiar texto" copia a petição.
- [ ] "A empresa respondeu" muda o estado para "Respondida em …".
- [ ] "Desfazer o envio" volta o caso para "não enviada", e a petição some.
- [ ] O checklist da petição avisa que a ANPD pode pedir uma espera maior, que vale a autodeclaração sem comprovante e que a ANPD analisa as petições em conjunto.
- [ ] A página do plano termina com o aviso "Não é assessoria jurídica".

### 3.2 Plano a partir de um vazamento detectado

Central de comando → no mapa, o nó **Clínica Vida+** (marcado como "novo") → "Plano de resposta".

- [ ] O plano abre **no topo** da página, com as etapas de 15 min, 1 h e 24 h.
- [ ] Marcar uma etapa como feita e recarregar a página: a marcação continua.
- [ ] A notificação LGPD vem endereçada à empresa, com as categorias que vazaram e **sem nenhum dado vazado**.
- [ ] "Marquei como enviada" inicia o prazo: aparece "Prazo correndo." com a data-limite, 15 dias depois do envio.

### 3.3 Relato livre

Copiloto → "O que aconteceu?". Teste um tipo por vez, com "Deixe o Olharium identificar" marcado:

| Relato de teste | Tipo esperado |
| --- | --- |
| Um falso funcionário do banco me ligou e eu fiz um Pix | Golpe do Pix |
| Levaram meu celular no ônibus | Celular roubado |
| Clonaram meu WhatsApp e estão pedindo dinheiro aos meus contatos | Conta invadida ou WhatsApp clonado |
| Digitei a senha do banco num site falso | Link ou site falso |
| Abriram um empréstimo no meu CPF | Conta ou dívida em meu nome |

- [ ] Cada relato gera um plano do tipo esperado, com links oficiais.
- [ ] No celular roubado, o plano cita Celular Seguro, bancos, operadora, IMEI e boletim de ocorrência.
- [ ] **Limpeza de dados pessoais:** escreva "meu CPF é 123.456.789-00, meu e-mail é teste@exemplo.com e meu telefone (11) 91234-5678". No plano, o bloco "Seu relato (sem dados pessoais)" mostra `[CPF]`, `[e-mail]` e `[telefone]` no lugar dos dados.
- [ ] Sem a chave do Gemini, a classificação funciona por palavras-chave. Isso é esperado.
- [ ] **Kit MED:** no plano do golpe do Pix aparece "Pedido de devolução ao seu banco". Preencha valor, data e quem recebeu: o texto ao lado muda na hora, e "Copiar texto" copia. O aviso diz que nada sai do navegador e que a devolução não é garantida.

### 3.4 "Uma empresa me avisou que vazou meus dados"

Copiloto → "Uma empresa avisou que vazou seus dados?":
1. Empresa: "Loja Exemplo".
2. Mês: deixe em branco (é opcional).
3. Marque E-mail e CPF.

- [ ] Gera um plano com a notificação LGPD endereçada à "Loja Exemplo".
- [ ] Sem marcar nenhum dado, aparece "Marque ao menos um dado que a empresa disse ter vazado." e nada é criado.
- [ ] O caso aparece em "Acompanhamento" como "Aviso de empresa, informado por você".

---

## Nível 2: Minhas contas e central de comando

### 2.1 Minhas contas

- [ ] Busque **Catho** e adicione: aparece o vazamento real, com as categorias (nunca o dado), o número de contas afetadas e o link "Fonte: Catho no Have I Been Pwned".
- [ ] "Plano de resposta" de um vazamento real abre o plano com o selo "Vazamento real" e a fonte.
- [ ] Marque "Mexe com dinheiro" sem marcar "Verificação em duas etapas": aparece o aviso para ativar a verificação.
- [ ] Recarregue a página: as marcações continuam.
- [ ] Adicione um site sem vazamento (por exemplo `exemplo.com.br`): aparece "Nenhum vazamento conhecido".
- [ ] Adicionar a Catho de novo não duplica.
- [ ] "Remover" tira o serviço da lista.

### 2.2 Central de comando (`/painel`)

- [ ] Numa tela de computador, aparecem juntos o score, o mapa de exposição, a fila de ação e a linha do tempo.
- [ ] Cada número do topo (Vazamentos, Alertas de rede, Correções, Contas, Dados vigiados) abre o detalhe numa gaveta lateral.
- [ ] Clicar em pontos do mapa abre a gaveta certa: Clínica Vida+ abre o vazamento, Roteador Wi-Fi abre o aparelho, LinkedIn abre o serviço e o centro ("Você") abre os dados monitorados.
- [ ] Na gaveta do Roteador Wi-Fi, clicar em "Telnet aberto" empilha o alerta e mostra o botão "Voltar".
- [ ] O Telnet no roteador diz **"Correção manual"**; o SMB do Wi-Fi público diz **"O agente corrige isso com o seu OK"**.
- [ ] A gaveta fecha com Esc, com o X e clicando fora dela.
- [ ] Os itens da fila mostram quanto pesam no score (+12, +8…) e abrem o "o que fazer".
- [ ] "Fórmula", no score, abre o cálculo: subtotal 55 dos vazamentos, 20 da rede e total 75.
- [ ] O anel pulsando e as linhas tracejadas em movimento só aparecem em ameaça nova ou grave.

---

## Nível 1: entrada, sessão e o básico (o mais simples)

### 1.1 Entrar e sair

- [ ] Na landing, "Entrar como demo" leva à central de comando, com a faixa amarela "Você está na demo".
- [ ] "Sair" volta à landing. Abrir `/painel` sem sessão leva de volta à landing.

### 1.2 Sessões isoladas

Abra a demo numa janela normal e numa anônima.

- [ ] Uma conta adicionada numa janela não aparece na outra.
- [ ] Um relato feito numa janela não aparece no copiloto da outra.

### 1.3 Privacidade na tela

- [ ] Os dados da persona aparecem só mascarados: `d**o@example.com`, `***.456.789-**`, `(11) *****-0001`.
- [ ] Nenhuma tela mostra senha, CPF ou e-mail vazado: só a empresa, as datas e as categorias.
- [ ] O rodapé diz que as orientações "não são assessoria jurídica".

### 1.4 Celular

Abra o site no celular ou com a janela do navegador estreita.

- [ ] Nada passa da borda: não há rolagem para o lado.
- [ ] O mapa aparece na versão vertical, e a gaveta ocupa a tela inteira.
- [ ] Os números do topo rolam para o lado dentro da própria faixa.

### 1.5 Saúde do sistema

- [ ] [radar360-api-hazel.vercel.app/health](https://radar360-api-hazel.vercel.app/health) responde `{"status":"ok","database":"ok"}`.
- [ ] O primeiro acesso depois de um tempo parado pode levar alguns segundos, porque a Vercel e o Neon "acordam". Abra o site uma vez antes de apresentar.

---

## Nível 0: checagem automática (para quem mexer no código)

Na raiz do repositório:

```powershell
npm test
```

```powershell
npm run typecheck
```

```powershell
npm run lint
```

- [ ] `npm test` passa todos: 83 testes da API e 141 do agente. Os do agente cobrem as recusas de rede (CGNAT, IP público, loopback) e as correções, sem alterar o sistema.
- [ ] Typecheck e lint sem erros.

---

## Registro

| Teste | Quem | Data | Resultado | Observação |
| --- | --- | --- | --- | --- |
| 5.1 Simulação | | | | |
| 5.2 Correção no PC e desfazer | | | | |
| 5.3 Rede de casa com consentimento | | | | |
| 5.4 UPnP no roteador | | | | |
| 5.5 Envio ao painel (local) | | | | |
| 4.1 Job no GitHub Actions | | | | |
| 3.1 LGPD vencida e petição | | | | |
| 3.2 Plano de vazamento detectado | | | | |
| 3.3 Relato livre e limpeza de dados | | | | |
| 3.4 Empresa me avisou | | | | |
| 2.1 Minhas contas | | | | |
| 2.2 Central de comando | | | | |
| 1.1 a 1.5 Básico | | | | |
| 0 Checagem automática | | | | |
