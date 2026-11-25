# Olharium: pitch honesto e limites do produto

Pesquisa feita em 25/11/2026 para o Hack Brasil 2026, Trilha 06 (Cibersegurança). O código e os endereços ainda usam o nome antigo, **Radar360** (`radar360-web.vercel.app`).

**Como este documento foi feito:**
- O estado do produto veio do código (`apps/api/src`, `apps/web/src`, `packages/local-agent`), do [`CLAUDE.md`](../CLAUDE.md) e do [`STATUS.md`](STATUS.md) de 24/11.
- Preços, APIs e leis vieram das fontes citadas no fim de cada seção, consultadas em 25/11/2026.
- Nenhuma varredura de rede nem teste com dado real foi feito.
- Quando algo não pôde ser confirmado, está escrito "não confirmado".

> **Não é parecer jurídico.** As seções 3 e 5 citam leis para orientar decisões de produto. Para uma dúvida concreta, falem com um advogado ou com a Comissão do Hack Brasil (oi@hackbrasil.com).

> **Atualização da noite de 25/11.** Depois desta pesquisa, o produto mudou em três pontos. Onde este documento disser o contrário, valem estes:
> 1. **Vazamentos reais:** "Minhas contas" mostra os vazamentos verificados do catálogo público do HIBP para os serviços que a pessoa usa (só metadados). O monitoramento deixou de ser só fictício.
> 2. **Notificação LGPD para qualquer pessoa:** ela sai também para vazamentos reais e para o caso "uma empresa me avisou".
> 3. **O agente corrige, com o OK da pessoa:** a regra 1 do `CLAUDE.md` mudou. O agente liga o firewall, muda o perfil de rede, desliga o compartilhamento e o RDP, bloqueia portas e fecha portas UPnP no próprio roteador, sempre com confirmação a cada ação e com "desfazer".
>
> O checklist atualizado está em [FUNCIONALIDADES.md](FUNCIONALIDADES.md).

---

## Resumo em 5 linhas

1. **Pitch:** três coisas funcionam de verdade, para qualquer pessoa, hoje: o copiloto com relato livre, os modelos de notificação LGPD e petição à ANPD, e o agente de rede. O monitoramento de vazamentos só funciona com dados fictícios, e cadastro real e alerta por e-mail ainda não existem. A notificação LGPD hoje só sai para vazamentos detectados, ou seja, só na base fictícia.
2. **Alerta ou corrige?** O Olharium diagnostica, orienta, escreve os documentos e, **com o OK da pessoa a cada ação**, corrige o próprio computador e fecha portas UPnP do próprio roteador (com "desfazer"). Nunca mexe nas contas do usuário nem age sozinho. É um copiloto, não um piloto automático.
3. **Fonte de vazamentos:** não existe API oficial ou pública no Brasil que diga se um CPF vazou. Para e-mail, a referência é a API paga do Have I Been Pwned, a partir de US$ 4,39/mês no plano anual. Para os dados de uma pessoa, a fonte mais confiável é a própria empresa: a LGPD a obriga a responder em 15 dias (arts. 18 e 19), e o Olharium já gera esse pedido.
4. **Aviso ao conectar:** no computador dá para fazer, com um "modo vigia" do agente Python que consulta a rede a cada poucos segundos e mostra uma notificação nativa. Custa de 8 a 12 horas, e o Windows 11 24H2 pode exigir a permissão de localização. No celular, só com um app nativo (fora do MVP); no navegador, é impossível.
5. **Wi-Fi alheio:** só dá para ler o que o próprio sistema já mostra (nome e tipo de segurança das redes próximas). Mandar pacotes, varrer portas, testar senhas ou capturar o tráfego de rede alheia é proibido pelo regulamento (5.2, 6.8 e 6.9) e pode ser crime (CP, art. 154-A; Lei 9.296/1996, art. 10).

---

## 1. Pitch honesto: o que o app faz de verdade

### 1.1 Funciona de verdade (com qualquer pessoa, hoje)

| Recurso | O que dá para afirmar | Ressalva honesta |
| --- | --- | --- |
| **Copiloto por relato** (`/painel/copiloto`) | Qualquer relato livre vira um plano de 15 min, 1 h e 24 h, com checklist e links oficiais (Registrato, Celular Seguro, consumidor.gov.br, reclamação no BC, Google e Apple Find). São cinco tipos: golpe do Pix, link falso, conta invadida ou WhatsApp clonado, celular roubado, conta ou dívida em seu nome. | Só se entra pela demo, então o histórico some quando a sessão expira. Em produção, a classificação usa **palavras-chave**, porque o Gemini está desligado. A IA, quando ligada, só escolhe o tipo; o plano vem de `catalog.ts`. |
| **Limpeza do relato** (`redact.ts`) | CPF, cartão, telefone, e-mail e chave Pix são removidos antes de salvar o relato e antes de mandá-lo à IA. | Nenhuma. É uma proteção automática real. |
| **Modelos LGPD** (`lgpd.ts`) | Texto fixo com os artigos certos (arts. 18, 19, 41 e 48 e 55-J). O sistema conta os 15 dias e gera a petição à ANPD quando o prazo vence. Abre o e-mail do usuário já preenchido (`mailto`). | **Só existe para incidentes do tipo vazamento detectado**, que hoje vêm da base fictícia. Um relato do tipo "a empresa X vazou meus dados" não gera notificação (`service.ts`, linha 304). |
| **Agente de rede** (`scanner.py`) | Roda de verdade no Windows, no macOS e no Linux, só com Python e sem instalar nada. No modo casa, varre a própria rede depois do `SIM`. No modo rede pública, audita o próprio computador: firewall, portas expostas, perfil de rede, tipo de Wi-Fi, nome do host e sinal de ARP spoofing. Tem 68 testes. | O envio do resultado para o painel de produção **ainda não foi testado** (item 5 do STATUS). O jurado não roda o agente (item 7.4), então ele precisa aparecer no vídeo. Veja os limites de Windows e macOS na seção 4.3. |
| **Score de exposição** (`score.ts`) | A fórmula é fixa, sem IA, e aparece explicada na tela. | Na demo, as entradas são fictícias. |
| **Proteções da demo** | Limite de uso por IP e por sessão, e cada jurado vê só os próprios incidentes. | Nenhuma. |

### 1.2 Funciona, mas só com dados fictícios

| Recurso | O que é real | O que é fictício |
| --- | --- | --- |
| **Detecção de vazamentos** | O motor de cruzamento é real: compara HMAC-SHA256 com chave fora do banco e deduplica por (`assetId`, `breachId`) (`breaches/job.ts`). | A base: TeleConecta, LojaFácil e ClínicaVida são empresas inventadas, com contatos de encarregado em `.invalid`. |
| **Monitoramento contínuo** | O job e o workflow `breach-check.yml`, a cada 6 h, existem. | Em 24/11, os segredos do GitHub ainda não estavam configurados (item 1 do STATUS). E, mesmo ligado, o job só cruza os ativos da persona com a base fictícia. |
| **Painel** | Mostra score, vazamentos, ativos e auditorias. | Persona, ativos e as duas auditorias de rede vêm do `seed.ts`; não são saídas reais do agente. |
| **Incidente de exemplo** | A notificação vencida e a petição à ANPD são geradas pelo código de verdade. | A empresa (TeleConecta) e as datas. |

### 1.3 Ainda não existe

- **Cadastro e login reais**, com e-mail confirmado por link. Também não dá para adicionar o próprio CPF ou telefone. Sem isso, ninguém monitora os próprios dados.
- **Alerta por e-mail** quando surge um risco novo. O job já devolve `newExposures`, mas nada é enviado.
- **Fonte real de vazamentos**, seja o HIBP ou qualquer outra (veja a seção 3).
- **Gemini em produção:** a chave não está configurada.
- **Notificação LGPD para um relato** ("a empresa X avisou que vazou meus dados").
- **Aviso automático ao conectar num Wi-Fi** (veja a seção 4).
- **Leitura de termos e inventário de contas**, as duas features leves do MVP.
- **App de celular:** fora do MVP de propósito.
- **Envio automático da notificação ou da petição:** não existe por decisão. Quem envia é o usuário.

### 1.4 O site promete mais do que entrega

Estas frases estão na landing (`apps/web/src/app/page.tsx`). Ajustar texto é correção, não feature, então dá para fazer depois de 28/11. Essa é a nossa leitura; confirmem entre vocês.

| Linha | Frase atual | Problema | Sugestão |
| --- | --- | --- | --- |
| 28 | "Verificamos seu e-mail, CPF e telefone em vazamentos e avisamos só quando surge um risco novo." | Não há cadastro, não há aviso por e-mail e a base é fictícia. | "Cruzamos e-mail, CPF e telefone com uma base de vazamentos e destacamos só o que é novo. Na demo, com dados fictícios." |
| 28 | "Guardamos apenas uma assinatura criptográfica dos seus dados, nunca o dado em si." | `User.email` fica em texto claro, e `Asset.masked` guarda parte do dado. HMAC também não é "assinatura". | "CPF e telefone ficam só como HMAC-SHA256, com a chave guardada fora do banco." |
| 35 | "Conte o que aconteceu ou abra um alerta: você recebe [...] a notificação pronta para a empresa responsável." | O relato não gera notificação, só o vazamento detectado. | "[...] e, quando há vazamento, a notificação pronta para a empresa responsável." |
| 56 | "Monitoramos apenas o e-mail, o CPF e o telefone confirmados como seus" | O fluxo de confirmação não existe; o `verifiedAt` da persona vem do seed. | Mantenham a frase como princípio e acrescentem "(na demo, os da persona fictícia)". Ou implementem o cadastro. |

### 1.5 Frases que a dupla pode usar

1. "O Olharium junta três coisas que hoje estão espalhadas: saber se seus dados vazaram, saber o que fazer nos primeiros 15 minutos e conferir a rede onde você está."
2. "O copiloto já funciona com qualquer relato. Escreva 'caí no golpe do Pix' e você recebe o que fazer nos próximos 15 minutos, na primeira hora e nas 24 horas, com os canais oficiais."
3. "Quando um vazamento é detectado, o Olharium escreve a notificação LGPD ao encarregado da empresa, conta os 15 dias do art. 19 e, se ninguém responder, prepara a petição à ANPD."
4. "A IA não escreve nada jurídico. Artigos, passos e links vêm de tabelas revisadas à mão; a IA, quando ligada, só identifica o tipo de golpe."
5. "Na demo, todos os dados são fictícios, como o regulamento exige. O motor que cruza os dados é o mesmo que rodaria com dados reais."
6. "CPF e telefone ficam guardados só como HMAC-SHA256, com a chave fora do banco. Quem roubar só o banco não lê esses dados."
7. "Nunca mostramos o dado vazado, só a fonte, a data e o tipo de dado. Assim a ferramenta não serve para expor ninguém."
8. "O agente roda no seu computador, só com Python, e corrige com o seu OK: mostra o que vai mudar, pede confirmação a cada passo e sabe desfazer."
9. "Em Wi-Fi público, o agente não manda nenhum pacote a outros aparelhos. Ele olha só para o seu computador e para a sua conexão."
10. "Na sua casa, ele só varre depois que você confirma que a rede é sua, e nunca tenta senha."
11. "Em 2026, o Google encerrou o relatório da dark web dizendo que ele não oferecia próximos passos úteis. O Olharium começa justamente no próximo passo." (fonte na seção 3)

### 1.6 Frases a evitar

| Evite | Por quê | Diga em vez disso |
| --- | --- | --- |
| "Monitoramos seus dados 24 horas por dia" ou "em tempo real" | Não há cadastro, o job não está ligado em produção, a base é fictícia e o job roda a cada 6 h. | "O monitoramento periódico está pronto e, na demo, roda com dados fictícios." |
| "Descubra se o seu CPF vazou" | Não existe fonte legítima para isso (seção 3), e o jurado pode tentar com o próprio CPF. | "Mostramos, com uma persona fictícia, como o Olharium avisaria." |
| "Você recebe um alerta por e-mail" | Não está implementado. | Só usem depois de implementar e testar. |
| "Varremos a dark web" | Não varremos nada fora da base local. | Não digam. |
| "Corrigimos sua rede", "bloqueamos ataques" ou "protege você no Wi-Fi público" | O produto só diagnostica, e só quando a pessoa roda o agente. | "Mostra o que o seu computador está expondo e como fechar." |
| "Nossa IA resolve o golpe" ou "IA jurídica" | A IA só classifica e está desligada em produção. Viola a regra 6 do `CLAUDE.md`. | "Os passos vêm de roteiros revisados à mão." |
| "Zero-knowledge", "anônimo" ou "não temos acesso aos seus dados" | É falso: o servidor recebe o dado para calcular o HMAC e guarda o e-mail de login em claro. A regra 4 do `CLAUDE.md` proíbe essas palavras. | Frase 6 acima. |
| "Garantimos o dinheiro do Pix de volta" | O MED depende do banco e não tem garantia. | "Mostra como pedir o MED ao seu banco nos primeiros minutos." |
| "Detectamos hackers na sua rede" | O ARP spoofing é uma heurística e aparece como "possível". | "Aponta sinais de que alguém pode estar se passando pelo roteador." |
| "Avisamos quando você entra num Wi-Fi inseguro" | Não existe (seção 4). | Só depois de implementar o modo vigia. |
| "Funciona no celular" | Não há app. A web abre no celular, mas o agente não roda lá. | "A web funciona no celular; a auditoria de rede é no computador." |
| "Já protegemos X pessoas" ou "conforme a LGPD" | Não há usuários reais nem auditoria de conformidade. | Não digam. |

**Fontes da seção 1:**
- [`CLAUDE.md`](../CLAUDE.md) e [`docs/STATUS.md`](STATUS.md)
- `apps/api/src/modules/incidents/{catalog,classify,lgpd,service,redact}.ts`
- `apps/api/src/modules/breaches/job.ts`
- `apps/api/prisma/{schema.prisma,seed.ts}`
- `apps/web/src/app/page.tsx`
- `apps/web/src/components/copilot/lgpd-panel.tsx`
- [`packages/local-agent/README.md`](../packages/local-agent/README.md)
- Fim do relatório da dark web do Google: veja as fontes da seção 3.

---

## 2. Só alerta ou corrige de verdade?

**Resposta curta:** o Olharium é mais do que um alarme, mas não corrige nada sozinho. Ele detecta, diz o que fazer na ordem certa e prepara os documentos. Quem executa é sempre a pessoa. Isso é proposital e é um argumento de venda: ele não precisa de senha, de acesso de administrador nem de permissão para mexer em nada.

### 2.1 O que é alerta, orientação ou automação

| Ação | Tipo | Estado |
| --- | --- | --- |
| Avisar só de vazamento novo, sem alerta repetido | Alerta | O motor está pronto, com dados fictícios; falta o e-mail. |
| Score de exposição com a fórmula na tela | Diagnóstico | Pronto. |
| Plano de 15 min, 1 h e 24 h, com checklist marcável | Orientação | Pronto. |
| Links oficiais (Registrato, Celular Seguro, MED via banco, consumidor.gov.br, BC, Google e Apple Find, denúncia de phishing) | Orientação | Pronto. |
| Achados do agente com "como corrigir" | Orientação | Pronto. |
| Notificação LGPD pronta, com os artigos certos, e e-mail aberto já preenchido para o encarregado | **Automação de documento**; o envio é do usuário | Pronto, mas só para vazamento detectado. |
| Contagem do prazo de 15 dias e petição à ANPD pronta quando ele vence | **Automação** | Pronto, também só para vazamento detectado. |
| Remover CPF, cartão, telefone, e-mail e Pix do relato antes de salvar | **Automação de proteção** | Pronto. |

### 2.2 O que o Olharium nunca faz, de propósito

- **Alterar configurações** do sistema, do firewall ou do roteador. Também não fecha portas nem desliga serviços. Isso está na regra 1 do `CLAUDE.md` e no README do agente.
- **Fazer login** em roteador, câmera ou qualquer aparelho, nem testar senha padrão.
- **Pedir ou guardar senha** de serviços do usuário (regra 5).
- **Enviar e-mail, notificação ou petição** em nome do usuário. O `mailto` só abre o cliente de e-mail dele.
- **Bloquear cartão, contestar Pix ou falar com o banco** pelo usuário.
- **Apagar o celular à distância.** No briefing, isso foi visto como parecido com spyware ou com ferramenta de dano (itens 5.2 e 6.8), e foi trocado pelo playbook "celular roubado".

**Por que isso é bom no pitch:**
- Corrigir sozinho exigiria privilégio de administrador.
- Um erro poderia derrubar a rede da pessoa.
- Uma ferramenta que mexe no sistema é exatamente o que o regulamento olha com desconfiança.

### 2.3 Automações seguras que cabem até 28/11

Todas mantêm a regra de não alterar nada no sistema. As estimativas são para uma pessoa, já com testes.

| # | Automação | Por que vale | Esforço | Risco |
| --- | --- | --- | --- | --- |
| A | **Relato "uma empresa avisou que vazou meus dados"**: o usuário digita a empresa e o contato do encarregado, e o sistema gera a mesma notificação LGPD, o prazo e a petição. | Torna a notificação LGPD "funciona de verdade" para casos reais, sem precisar de base de vazamentos. Nome de empresa não é dado pessoal de terceiro. | 3 a 5 h (API, tipo novo, formulário e testes) | Baixo: os modelos já existem e são fixos. |
| B | **"Resolvido desde a última auditoria"**: comparar as duas últimas auditorias pelo `kind`, IP e porta, e marcar o que sumiu. | Fecha o ciclo: o Olharium não corrige, mas confirma que a pessoa corrigiu. | 3 a 4 h | Baixo. |
| C | **Lembrete do prazo de 15 dias** num arquivo `.ics` ("Adicionar à agenda"), gerado no navegador. | Automação útil e visível, sem servidor. | 1 a 2 h | Muito baixo. |
| D | **Atalho para a tela certa:** o agente imprime o atalho `ms-settings:` do Windows correspondente ao achado. | Leva o leigo até a tela onde ele mesmo corrige. | 1 a 2 h | Baixo, mas confiram cada URI na lista da Microsoft. |
| E | **Trava extra no modo casa:** se o Wi-Fi for aberto, avisar "redes abertas quase nunca são domésticas" antes de pedir o `SIM`. | Reforça a regra 1 (detalhes na seção 5.5). | 1 h | Muito baixo. |

**Prioridade honesta:**
- Pelo `STATUS.md`, o maior buraco do núcleo continua sendo o cadastro real e o alerta por e-mail (itens 2 e 3). Isso pesa em "execução técnica".
- As automações A e C são as de melhor custo-benefício para o pitch.
- Façam A e C só se o cadastro e o alerta estiverem prontos, ou se vocês decidirem cortá-los de vez.
- Não comecem nada que não feche até 28/11.

### 2.4 Como falar disso no pitch

> "O Olharium não mexe no seu computador nem nas suas contas. Ele faz o diagnóstico, diz o que fazer nos próximos 15 minutos e escreve por você a notificação para a empresa e a petição para a ANPD. Quem clica é você."

**Fontes da seção 2:**
- [`CLAUDE.md`](../CLAUDE.md): regras 1, 5 e 6.
- `apps/api/src/modules/incidents/{catalog,lgpd,service,redact}.ts`
- `apps/web/src/components/copilot/lgpd-panel.tsx`
- [README do agente](../packages/local-agent/README.md)
- Microsoft, [atalhos `ms-settings:` do app Configurações](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings-app). Não conferimos cada atalho.

---

## 3. Fonte confiável de vazamentos

### 3.1 Resposta curta

- **CPF e telefone:** não existe API oficial nem pública, no Brasil, que diga se um CPF vazou. A ANPD recebe as comunicações de incidente, mas publica só números agregados. O gov.br não tem esse serviço.
- **E-mail:** a referência mundial é o **Have I Been Pwned (HIBP)**. A API é paga e cobre e-mail, não CPF.
- **Os dados de uma pessoa específica:** a fonte mais confiável é **a própria empresa**. Ela é obrigada a comunicar ao titular os incidentes relevantes (LGPD, art. 48) e a responder pedidos de acesso em 15 dias (art. 19, II). O copiloto já gera esse pedido.

### 3.2 Comparação das fontes

| Fonte | Cobre | API para terceiros? | Preço | Verifica quem consulta? | Serve ao Olharium? |
| --- | --- | --- | --- | --- | --- |
| **HIBP**, busca de conta (API v3) | E-mail. **Não cobre CPF.** A busca por telefone não é oferecida. | Sim, com chave paga. Há uma chave de teste para contas fictícias. | A partir de US$ 4,39/mês (plano Core 1, cobrado US$ 52,68 por ano, 10 consultas por minuto) | A API não checa se o e-mail é de quem consulta. Os termos só permitem consultar e-mails que os próprios usuários forneceram. | **Sim, para e-mail**, como caminho de produção. |
| **HIBP, Pwned Passwords** | Senhas vazadas | Sim, grátis, sem chave e sem limite (k-anonymity) | Grátis; uso comercial permitido | Não se aplica | **Não**: exigiria a pessoa digitar a senha, contra a regra 5. Indiquem o gerenciador de senhas dela. |
| **HIBP no site**, com aviso por e-mail ("Notify me") | E-mail | Não é API: é o site | Grátis | Sim, por e-mail de verificação | Sim, como link de orientação, sem integração. |
| **Mozilla Monitor** | E-mail, com dados do HIBP | **Não encontramos API pública** | O aviso de vazamento é grátis; o Monitor Plus foi encerrado em 17/12/2025 | Sim, com conta | Só como indicação ao usuário. |
| **Relatório da dark web do Google** | Era: e-mail, telefone e outros | Não encontramos API pública | **Encerrado**: as buscas pararam em 15/01/2026 e o recurso saiu do ar em 16/02/2026 | Era com a conta Google | **Não.** Mas o motivo do fim é ótimo para o pitch (seção 3.6). |
| **Serasa**: consulta "Vazamento de dados" e Serasa Premium | CPF, e-mail e telefone, pela tecnologia CyberAgent, segundo a própria Serasa | Não encontramos API pública para terceiros | A consulta pontual é grátis; o monitoramento é pago (preço não confirmado) | Sim, com conta Serasa | Só como indicação. Uma parceria B2B seria uma negociação comercial, não confirmada. |
| **Registrato (BC)** | Não diz "vazou"; mostra as **consequências**: empréstimos (SCR), contas (CCS) e chaves Pix em seu nome | Não; o acesso é pessoal, com gov.br prata ou ouro | Grátis | Sim (gov.br) | **Sim**, como passo do plano. Já está em `catalog.ts`. |
| **Comunicados do BC sobre chaves Pix** | Incidentes por instituição: quantidade de chaves e tipos de dado. Foram 23 desde nov/2020, segundo o BC em mar/2026. | É uma página e uma nota pública, não API | Grátis | Não se aplica | **Sim, como metadado real**: empresa, data e categorias, sem nenhum dado de pessoa. |
| **ANPD** | Recebe as comunicações de incidente (Res. CD/ANPD 15/2024) | Painéis agregados por UF, setor, segmento e tipo | Grátis | Não se aplica | Só como estatística. **Não lista empresas nem titulares** e não consulta CPF. |
| **gov.br** | Não encontramos nenhum serviço oficial "meu CPF vazou" | Não | Não se aplica | Não se aplica | Não. |
| **Bases vazadas e "painéis de consulta"** | Tudo, inclusive o dado em si | São mercado criminoso | Não se aplica | Não | **Nunca** (seção 3.5). |

### 3.3 Have I Been Pwned em detalhe

**Preços** (página de assinatura, valores mensais com cobrança anual, impostos à parte):

| Plano | US$/mês (cobrança anual) | Consultas por minuto |
| --- | --- | --- |
| Core 1 | 4,39 (US$ 52,68 por ano) | 10 |
| Core 2 | 21,59 | 50 |
| Core 3 | 36,99 | 100 |
| Core 4 | 159 | 500 |
| Core 5 | 319 | 1.000 |
| Pro 1 a 5 | 379 a 4.599 | 1.000 a 16.000 |
| High RPM | 1.150 a 5.833 | 4.000 a 24.000 |

**Ressalvas sobre os preços:**
- A página anuncia cobrança mensal, mas só mostra os preços anuais.
- Um artigo de suporte do HIBP cita preços mensais mais altos, por exemplo Pro 2 a US$ 849.
- Não confirmamos qual valor vale hoje para a cobrança mensal.

**O que importa nos termos de uso** (versão consultada em 25/11/2026; os números de cláusula vêm de um resumo, conferir no original):
- **Só e-mails dos próprios usuários.** É permitido consultar e-mails fornecidos pelos próprios usuários e mostrar o resultado no produto (cl. 2.1.4.4). É proibido consultar listas compradas ou raspadas, e proibido usar o resultado para vender serviço à vítima. Isso bate com a regra 2 do `CLAUDE.md`: verifiquem o e-mail por link antes de consultar.
- **Atribuição obrigatória.** Os dados de vazamento seguem a licença CC BY 4.0: onde o resultado aparecer, mostrem "Have I Been Pwned" com link (cl. 2.1.1.4).
- **Limites de uso.** É proibido revender os dados, criar uma base de busca concorrente ou redistribuí-los.
- **Monitoramento periódico pode ser problema.** O "propósito permitido" do plano pago é descrito como consultas sob demanda (cl. 16.1.18). **Não confirmamos** se reconsultar a cada 6 horas é aceito. Perguntem ao HIBP antes de construir.
- **Busca por k-anonymity.** Os planos pagos permitem consultar por prefixo de 6 caracteres do SHA-1 do e-mail, então o HIBP não recebe o endereço inteiro. Os sufixos que não batem precisam ser descartados.
- **Vazamentos sensíveis ficam de fora.** A API pública não devolve vazamentos marcados como sensíveis nem os aposentados.
- **Dá para integrar sem dado real.** Existe a chave de teste `00000000000000000000000000000000`, que só consulta contas fictícias do domínio `hibp-integration-tests.com`. É um caminho para mostrar a integração na demo sem violar o item 6.9, se houver tempo depois do núcleo.

### 3.4 Brasil: CPF, ANPD, BC, Registrato e Serasa

- **ANPD:** desde 2025 publica painéis de Power BI das comunicações de incidente, de 2021 até hoje, com filtros por UF, setor, segmento e tipo. Pelo que encontramos, os painéis **não identificam empresas nem pessoas**. A ANPD também tem um painel de fiscalização. Para o titular, existe o canal de denúncia, não uma consulta.
- **Banco Central:** publica um comunicado a cada incidente com dados ligados a chaves Pix. No caso da Pefisa (mar/2026), por exemplo, foram expostos nome, CPF, agência e conta, mas não senhas nem saldos. Os afetados são avisados **só pelo app ou pelo internet banking** da própria instituição, e o BC pede para ignorar contatos por SMS, telefone ou e-mail. Esse alerta vale como passo de plano no copiloto.
- **Registrato:** é a forma oficial de ver se abriram conta, empréstimo ou chave Pix em seu nome. Mostra a consequência do vazamento, não o vazamento.
- **Serasa:** oferece uma consulta gratuita e pontual em "Meu CPF" → "Vazamento de dados" e um monitoramento pago. A própria Serasa diz que o recurso não garante achar toda exposição.
- **Conclusão:** nenhuma dessas fontes oferece, para um app de terceiros, uma resposta do tipo "o CPF X vazou". Isso é bom: uma API assim seria uma ferramenta de doxxing.

### 3.5 Riscos de usar bases vazadas "de verdade"

1. **LGPD.**
   - Dado vazado continua sendo dado pessoal (art. 5º, I), e tratá-lo exige base legal (arts. 7º e 11).
   - A dispensa de consentimento do art. 7º, § 4º, vale só para dados "tornados manifestamente públicos **pelo titular**". Um vazamento não é isso.
   - Mesmo um dado de acesso público precisa respeitar a "finalidade, a boa-fé e o interesse público" (art. 7º, § 3º).
   - Quem guarda a base vira controlador dela, com deveres de segurança (art. 46) e sujeito a multa de até 2% do faturamento, limitada a R$ 50 milhões por infração (art. 52, II).
2. **Regulamento.**
   - O item 6.9 proíbe expor dados pessoais reais de terceiros na demo.
   - O item 6.8 proíbe ferramenta de doxxing pelo "uso previsível". Um serviço que mostra o dado vazado de qualquer CPF é exatamente isso.
   - Descumprir o regulamento ou a lei pode desclassificar (itens 11.3 e 12.2).
3. **A arquitetura atual dependeria da base.** Hoje o cruzamento compara HMACs com uma base local. Com CPF real, isso exigiria ter a base vazada em mãos para calcular os HMACs. Em produção, o cruzamento precisa acontecer **do lado de uma fonte licenciada** (como o HIBP para e-mail), ou não acontecer.
4. **Mostrar o dado vazado é o problema.**
   - Sites que mostram endereço, telefone ou senha viram "painel de consulta" para golpista. A polícia já desmontou esquemas que vendiam exatamente isso.
   - Dado verdadeiro dá credibilidade ao golpe: é o alerta do próprio BC nos comunicados de incidente com chaves Pix.
   - Até o HIBP evita mostrar o dado: não exibe senhas e esconde os vazamentos sensíveis de quem não provou ser o dono.
   - O Olharium segue a mesma linha: mostra fonte, data e categorias.
5. **Comprar ou baixar uma base alimenta o mercado criminoso**, mesmo com "boa intenção".

### 3.6 Recomendação

**Na demo:**
- Mantenham a base sintética: é obrigatória.
- Deixem um rótulo visível, como "Dados fictícios: empresas e pessoas inventadas".
- Não acrescentem incidentes reais agora. Se fizerem isso depois, usem só metadados de fonte oficial, como o comunicado do BC, com link para a fonte (item 11.3).

**No pitch:**

> "Por regra do Hack Brasil, a base de vazamentos da demo é fictícia. O motor que cruza os dados é real e não depende da fonte. Em produção, ele usaria fontes licenciadas, como a API do Have I Been Pwned para e-mail, e comunicados públicos de incidentes, sempre como metadados. Nunca compramos nem guardamos bases vazadas, e nunca mostramos o dado vazado."

Frase de impacto, com fonte:

> "O Google encerrou o relatório da dark web em fevereiro de 2026 porque ele não oferecia próximos passos úteis. O Olharium começa exatamente no próximo passo."

**O caminho em produção:**
1. **E-mail:**
   - O e-mail entra no monitoramento só depois de verificado por link.
   - A consulta ao HIBP usa o plano Core (o menor custa US$ 52,68 por ano), por k-anonymity, com a atribuição visível.
   - Antes, confirmem com o HIBP se a checagem periódica está permitida.
2. **CPF e telefone, por relacionamento, sem base vazada:**
   - O usuário declara as empresas com que se relaciona; é o inventário de contas do MVP.
   - O Olharium acompanha comunicados públicos de incidente: BC, as próprias empresas e a imprensa, sempre com fonte.
   - Quando uma dessas empresas comunica um incidente, o Olharium avisa e gera o **pedido de acesso LGPD** (arts. 18 e 19), e a empresa diz se os dados daquela pessoa foram afetados.
   - Na prática, é o copiloto atual mais a automação A da seção 2.3.
3. **Consequências:** o Registrato, para conferir contas, empréstimos e chaves Pix em seu nome, como já está no plano.
4. **Birôs (Serasa, Boa Vista):** só por contrato B2B. Custo e viabilidade não confirmados.

**Fontes da seção 3:**
- HIBP:
  - [API v3](https://haveibeenpwned.com/API/v3)
  - [Planos e preços](https://haveibeenpwned.com/Subscription)
  - [Termos de uso](https://haveibeenpwned.com/TermsOfUse)
  - [FAQ](https://haveibeenpwned.com/FAQs)
  - [Artigo de suporte sobre preços](https://support.haveibeenpwned.com/hc/en-au/articles/13262081649935-What-services-do-you-offer-and-how-are-they-priced)
- Mozilla:
  - [Encerramento do Monitor Plus](https://support.mozilla.org/en-US/kb/monitor-plus-shutting-down)
  - [Privacy Guides sobre o Monitor Plus](https://www.privacyguides.org/news/2025/11/19/mozillas-monitor-plus-service-is-shutting-down.md)
  - [FAQ do Mozilla Monitor, com o HIBP como fonte](https://support.mozilla.org/kb/mozilla-monitor-faq)
- Google:
  - [Atualizações do relatório da dark web](https://support.google.com/websearch/answer/16767242)
  - [TechCrunch, 15/12/2025](https://techcrunch.com/2025/12/15/googles-dark-web-report-feature-will-no-longer-be-available-starting-in-february/)
  - [Malwarebytes](https://www.malwarebytes.com/blog/news/2025/12/google-is-discontinuing-its-dark-web-report-why-it-matters)
- ANPD:
  - [Comunicação de Incidente de Segurança](https://www.gov.br/anpd/pt-br/assuntos/incidente-de-seguranca)
  - [Legismap sobre os painéis de dados agregados, 10/06/2025](https://legismap.com.br/conteudos/artigos-e-noticias/anpd-divulga-dados-agregados-sobre-comunicacoes-de-incidentes-de-seguranca-e-reformula-pagina-web)
  - [Resolução CD/ANPD 15/2024](https://www.legisweb.com.br/legislacao/?id=458235)
- Banco Central:
  - [Agência Brasil sobre o incidente da Pefisa, mar/2026](https://agenciabrasil.ebc.com.br/economia/noticia/2026-03/bc-comunica-exposicao-de-dados-de-28-mil-chaves-pix)
  - [Página oficial do BC sobre Registrato e serviços digitais](https://www.gov.br/pt-br/temas/meu-bc-servicos-digitais)
  - [TecMundo: o que é o Registrato](https://www.tecmundo.com.br/mercado/401486-o-que-e-o-registrato-do-banco-central.htm)
- Serasa:
  - [Vazamento de dados na dark web](https://www.serasa.com.br/premium/darkweb/)
  - [Monitoramento do CPF](https://www.serasa.com.br/premium/blog/monitoramento-do-cpf-como-funciona/)
- [LGPD, Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm): arts. 5º, 7º, 18, 19, 48 e 52.
- Polícia sobre a venda de dados: [SBT News, grupo que vendeu R$ 7 milhões em dados](https://sbtnews.sbt.com.br/noticia/brasil/df-policia-mira-grupo-que-vendeu-r-7-mi-em-dados-sigilosos). A data da reportagem não foi confirmada.
- Regulamento do Hack Brasil 2026, itens 6.8, 6.9, 11.3 e 12.2, segundo o resumo no `CLAUDE.md` e no briefing interno.

---

## 4. Avisar ao conectar num Wi-Fi público inseguro

### 4.1 Resposta curta

- **Computador:** dá para fazer, com um **modo vigia** no próprio agente Python. Ele lê o estado da rede a cada poucos segundos e, quando a rede muda e é insegura, mostra uma notificação nativa. Funciona enquanto a janela do terminal estiver aberta. O Windows 11 24H2 pode exigir a permissão de localização para ler o tipo do Wi-Fi.
- **Celular:** só com app nativo. O Android permite; o iOS limita muito. As duas opções estão fora do MVP.
- **Navegador:** impossível. Nenhuma API web informa o nome nem a segurança do Wi-Fi.

**Antes de prometer, saibam que o sistema já avisa em parte:**
- O Windows mostra "outras pessoas podem ver as informações" em redes abertas.
- O iOS mostra "Segurança fraca" em redes WEP, TKIP ou WPA antigas.

O valor do Olharium está no que o sistema não faz: explicar em português simples e juntar outras checagens, como firewall desligado, portas expostas, rede marcada como "Privada" num café e sinal de ARP spoofing.

### 4.2 O que cada plataforma permite

| Plataforma | Perceber a troca de rede | Ler o tipo de segurança | Notificar | Rodar em segundo plano |
| --- | --- | --- | --- | --- |
| **Windows 10/11** | Consultar a cada poucos segundos (gateway, IP e MAC do gateway na tabela ARP) funciona só com a biblioteca padrão. Os eventos nativos (NetworkStatusChanged da WinRT, WlanRegisterNotification) exigem bibliotecas fora da padrão ou `ctypes` complexo. | `netsh wlan show interfaces` dá autenticação e cifra. **No 24H2 em diante, pode exigir permissão de localização.** Alternativa: `NetworkAuthenticationType` da WinRT via PowerShell, que distingue None, WpaPsk, RsnaPsk (WPA2), Wpa3Sae e OWE. Não está na lista de APIs afetadas da Microsoft, mas **não testamos**. | Toast nativo via PowerShell, com a API WinRT `ToastNotificationManager`, a validar. Plano B: caixa de diálogo com `ctypes` e `MessageBoxW`, que é biblioteca padrão. | Sim, se o usuário criar uma tarefa agendada no logon. O agente não deve criá-la sozinho: isso é mudar configuração do sistema. |
| **macOS** | Consulta periódica. A notificação nativa (SystemConfiguration) não está na biblioteca padrão. | O `airport` foi **descontinuado no 14.4**. `ipconfig getsummary` traz o campo `Security`, mas o nome da rede aparece como `<redacted>` a partir do 15.x. **Não confirmamos** se o campo `Security` continua visível no 15.6+ ou no 26. O CoreWLAN exige permissão de localização e não é biblioteca padrão. | `osascript -e 'display notification ...'`, sem instalar nada. | Com um LaunchAgent criado pelo próprio usuário. |
| **Linux** | Consulta periódica ou `nmcli monitor`. Os scripts do dispatcher do NetworkManager exigem root. | `nmcli -t -f ACTIVE,SSID,SECURITY dev wifi list --rescan no`, que o agente já usa. | `notify-send` (libnotify), se estiver instalado. | Com um serviço `systemd --user` criado pelo usuário. |
| **Android** | `ConnectivityManager.NetworkCallback`. A versão com `PendingIntent` (API 23) pode "sobreviver" ao app e acordá-lo. | `WifiInfo.getCurrentSecurityType()` (API 31): OPEN, WEP, PSK, SAE, OWE, EAP e outros. O nome da rede exige localização. Pela documentação, o tipo de segurança não está na lista de campos ocultados, mas não testamos. | Notificação nativa. | Sim, mas exige um app nativo, fora do MVP. |
| **iOS** | Só enquanto o app está aberto (`NWPathMonitor`). Não há gatilho geral em segundo plano para "conectou num Wi-Fi". O NEHotspotHelper exige uma permissão especial da Apple (não confirmado nesta pesquisa). | `NEHotspotNetwork.fetchCurrent` (iOS 14) exige a permissão "Access Wi-Fi Information" e localização precisa, ou rede configurada pelo app, ou VPN, ou DNS. `securityType` (iOS 15) só distingue aberta, WEP, pessoal, empresarial e desconhecida, sem separar WPA2 de WPA3. | Notificação local, com o app ativo. | Na prática, não. E o iOS já mostra "Segurança fraca". |
| **Navegador e web app** | Só os eventos `online` e `offline`. `navigator.connection.type` ("wifi" ou "cellular") é experimental e restrito ao Chromium, quase só no Android. | **Impossível.** Nenhuma API web expõe o nome nem a segurança do Wi-Fi. | Web Push existe, mas não há gatilho de troca de rede. | Não. |

### 4.3 Limites do agente atual

- **Windows 11 24H2 em diante:**
  - A Microsoft passou a exigir a permissão de localização para várias funções de Wi-Fi.
  - Entre elas está `WlanQueryInterface` com `current_connection`, que é o que o `netsh wlan show interfaces` usa.
  - Sem essa permissão, o agente lê "desconhecido" no tipo de Wi-Fi e simplesmente não gera o achado.
  - **Testem no notebook de vocês, com a localização ligada e desligada:** `python scanner.py --mode public --dry-run`.
- **macOS 14.4 em diante:** o agente tenta o `airport` e depois o `ipconfig getsummary`. Isso pode funcionar, mas não foi confirmado nas versões 15.6+ e 26.
- **OWE ("Wi-Fi Enhanced Open"):** cifra o tráfego, mas não autentica a rede. O `classify_wifi_security` provavelmente devolve "desconhecido" para isso. É um ajuste pequeno para depois.

### 4.4 Desenho proposto: `--mode watch` (modo vigia)

A ideia é o mais simples que funciona nos três sistemas, só com a biblioteca padrão e reaproveitando o modo rede pública.

1. **Laço:** a cada 10 s (configurável com `--intervalo`), calcular a "impressão" da rede:
   - IP local e rede (CIDR);
   - IP do gateway;
   - MAC do gateway, lido da tabela ARP;
   - tipo do Wi-Fi.

   O nome da rede **não** entra, porque exigiria localização no Windows e no macOS e é dado sensível.
2. **Quando a impressão mudar:** rodar as checagens locais do modo rede pública (Wi-Fi, firewall, perfil, portas expostas e ARP), **sem mandar nenhum pacote a outros aparelhos**.
3. **Notificar só quando importa:**
   - Wi-Fi aberto, WEP ou WPA antigo;
   - firewall desligado;
   - perfil "Privada" numa rede nova;
   - sinal de ARP spoofing.

   No máximo uma notificação por rede em cada execução.
4. **Notificador por sistema:**
   - Windows: toast via PowerShell; se falhar, `MessageBoxW` via `ctypes`, numa thread.
   - macOS: `osascript`.
   - Linux: `notify-send`, se existir.
   - Em qualquer caso, também imprimir no terminal.
5. **Privacidade:** não envia nada por padrão. Com `--api`, envia só o resultado do modo público, no contrato atual. Nunca guarda nem envia o nome da rede.
6. **Sem instalação automática:** o vigia roda enquanto o terminal estiver aberto. O README ensina como a própria pessoa pode colocá-lo para iniciar com o sistema, se quiser. Assim, a regra "o agente nunca altera configurações do sistema" continua de pé.
7. **No pitch e no vídeo:** mostrem o vigia no Windows, ao trocar de rede. Os jurados não instalam nada (item 7.4).

### 4.5 Esforço e prioridade

| Parte | Horas |
| --- | --- |
| Laço, impressão da rede e decisão de notificar | 2 a 3 |
| Notificadores dos três sistemas, com plano B | 2 a 3 |
| Testes de unidade (com `run_cmd` e notificadores simulados) | 2 |
| Teste manual no Windows e, se houver máquina, macOS e Linux | 1 a 2 |
| README, incluindo a falta de permissão de localização | 1 |
| **Total** | **8 a 11 h** (cerca de um dia de uma pessoa) |
| Opcional: leitura do tipo de Wi-Fi via WinRT no 24H2 sem localização (não testado) | +2 a 3 |

**Recomendação:**
- O vigia é a melhor resposta técnica à pergunta, mas é feature nova e compete com o cadastro e o alerta por e-mail, que são o núcleo.
- Se o núcleo não estiver pronto até 26/11, deixem o vigia como **roadmap** no pitch.
- Enquanto isso, digam: "ao chegar num café, rode o modo rede pública". Isso já existe.

**Fontes da seção 4:**
- Microsoft:
  - [Mudanças de acesso ao Wi-Fi e localização](https://learn.microsoft.com/en-us/windows/win32/nativewifi/wi-fi-access-location-changes)
  - [NetworkAuthenticationType](https://learn.microsoft.com/en-us/uwp/api/windows.networking.connectivity.networkauthenticationtype)
  - [netsh wlan](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-wlan)
  - [ToastNotificationManager](https://learn.microsoft.com/en-us/uwp/api/windows.ui.notifications.toastnotificationmanager)
  - [MessageBoxW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-messageboxw)
  - [Ajuda do Edge sobre redes abertas](https://support.microsoft.com/en-us/help/4468244/microsoft-edge-help)
- Relatos de usuários do Windows 24H2:
  - [ElevenForum sobre o erro de localização no netsh](https://www.elevenforum.com/t/netsh-wlan-query-access-is-denied.45302/latest)
  - [Citrix sobre as mudanças do 24H2](https://docs.citrix.com/en-us/device-trust/23-1/kb/properties/location_and_network_improvements_in_windows11_24h2/)
- Apple:
  - [fetchCurrent](https://developer.apple.com/documentation/networkextension/nehotspotnetwork/fetchcurrent(completionhandler:))
  - [securityType](https://developer.apple.com/documentation/networkextension/nehotspotnetwork/securitytype)
  - [NEHotspotNetworkSecurityType](https://developer.apple.com/documentation/networkextension/nehotspotnetworksecuritytype)
  - [Fórum de desenvolvedores sobre a descontinuação do airport no 14.4](https://developer.apple.com/forums/thread/748397)
  - [Apple Community sobre o nome da rede ocultado no Sequoia](https://discussions.apple.com/thread/255761216)
  - [Apple Community sobre "Segurança fraca"](https://discussions.apple.com/thread/251805737)
  - [Guia de notificações do AppleScript](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/DisplayNotifications.html)
- Android:
  - [WifiInfo](https://developer.android.com/reference/android/net/wifi/WifiInfo)
  - [ConnectivityManager](https://developer.android.com/reference/android/net/ConnectivityManager)
- Web: [MDN, NetworkInformation.type](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/type)
- Linux:
  - [nmcli](https://networkmanager.dev/docs/api/latest/nmcli.html)
  - [NetworkManager-dispatcher](https://networkmanager.dev/docs/api/latest/NetworkManager-dispatcher.html)
- Código: `packages/local-agent/scanner.py`, funções `get_wifi_security`, `classify_wifi_security` e `build_wifi_finding`.

---

## 5. Dá para scanear o Wi-Fi dos outros?

> **Não é parecer jurídico.** Isto é uma leitura de produto da lei e do regulamento. Em caso de dúvida, consultem um advogado ou a Comissão (oi@hackbrasil.com). Confirmem também entre vocês se o e-mail sobre o scanner, citado no `STATUS.md`, já foi enviado.

### 5.1 Resposta curta

**Não.** O Olharium pode **ler** o que o próprio sistema operacional já mostra: a lista de redes próximas, com nome e tipo de segurança. Isso é passivo. Ele **não pode tocar** em rede alheia: mandar pacotes a outros aparelhos, varrer portas, testar senhas ou capturar tráfego.

### 5.2 O que é passivo e o que é ativo

| Ação | Tipo | Pode? | Por quê |
| --- | --- | --- | --- |
| Ler o tipo de segurança da rede **a que você está conectado** | Passivo, sobre o próprio sistema | **Sim**, e o agente já faz | É o seu computador. |
| Ler a tabela ARP local, sem mandar ARP | Passivo | **Sim**, e o agente já faz | É o cache do seu sistema. |
| Listar as redes próximas que o sistema já mostra (nome e segurança) | Passivo | **Sim, com cuidado** | Todo sistema faz isso. Mas o nome de uma rede alheia pode ser dado pessoal ("Wi-Fi do João, apto 42"; LGPD, art. 5º, I). Processem localmente e não guardem nem enviem nome ou BSSID. No Windows 24H2 e no macOS recente, exige permissão de localização. **Hoje o agente não faz isso** (usa `--rescan no` e não envia o nome da rede). |
| Avisar sobre uma "rede gêmea" (mesmo nome, segurança diferente) | Passivo | Sim, como ideia futura | Protege o próprio usuário. Não é feature para esta entrega. |
| Ping, varredura ARP, varredura de portas, pedidos SSDP ou mDNS ou leitura de banner em aparelhos **da rede do café, do hotel ou do vizinho** | **Ativo** | **Não** | Regulamento 5.2 e 6.9. O modo rede pública existe para evitar isso. |
| Abrir o painel do roteador ou da câmera alheia, testar senha padrão ou PIN de WPS | Ativo, invasão | **Não** | Regulamento 5.2; CP, art. 154-A. |
| Capturar tráfego alheio em modo monitor (sniffing) | Ativo, interceptação | **Não** | Lei 9.296/1996, art. 10. |
| Capturar o handshake WPA para quebrar a senha, ou derrubar pessoas da rede (deauth) | Ativo, ataque | **Não** | Regulamento 5.2; CP, art. 154-A. A interferência em radiofrequência também pode violar a regulação de telecomunicações (não confirmado). |
| Usar o Wi-Fi do vizinho sem autorização | Uso indevido | **Não** | Fora do escopo e juridicamente arriscado. |

### 5.3 O que diz o regulamento

Segundo o resumo do `CLAUDE.md` e do briefing interno:

- **Item 5.2:** teste de invasão só com finalidade defensiva, em sistemas próprios ou com autorização por escrito. Ferramentas para invadir, espionar ou escapar de detecção ficam de fora.
- **Item 6.8:** são proibidos doxxing, spyware, malware e ferramentas de dano. Vale a **finalidade principal ou o uso previsível**, não o assunto. Um scanner que roda em qualquer rede tem um uso previsível óbvio: atacar a rede alheia.
- **Item 6.9:** as ferramentas de segurança só podem ser testadas em sistemas próprios ou com autorização por escrito.
- **Itens 11.3 e 12.2:** violar a lei, o regulamento ou direitos de terceiros pode desclassificar.

### 5.4 O que diz a lei brasileira

- **Código Penal, art. 154-A**, criado pela Lei 12.737/2012 e alterado pela Lei 14.155/2021:
  - **Conduta:** "invadir dispositivo informático de uso alheio" para obter, adulterar ou destruir dados, "sem autorização expressa ou tácita do usuário".
  - **Pena:** reclusão de 1 a 4 anos, e multa.
  - **Por que "estava aberto" não é desculpa:** a redação de 2021 tirou a exigência de "violação indevida de mecanismo de segurança". Entrar num painel sem senha também pode caber no artigo.
  - **§ 1º:** a mesma pena vale para quem "produz, oferece, distribui, vende ou difunde" um programa "com o intuito de permitir" a invasão. É mais um motivo para o agente ter as travas que tem.
  - **Art. 154-B:** a ação penal depende, em regra, de representação da vítima. A exceção é crime contra a administração pública ou concessionária de serviço público.
- **Lei 9.296/1996, art. 10:** interceptar comunicações "de informática ou telemática" sem autorização judicial é crime, com reclusão de 2 a 4 anos. Capturar o tráfego de outras pessoas no Wi-Fi do café se encaixa aqui.
- **Varredura de portas, sozinha:** a lei brasileira não cita "varredura de portas". O enquadramento penal dependeria da finalidade e do que vem depois. Para o projeto, essa discussão não importa: **o regulamento já proíbe**, e o risco de reputação com o júri é alto.
- **LGPD:** nome de rede, BSSID e MAC ligados a uma pessoa ou a um lugar podem ser dado pessoal (art. 5º, I). Coletar e enviar esses dados exigiria finalidade e base legal.

### 5.5 Como o agente já respeita isso, e um ponto fraco

- **O que o agente já faz:**
  - o modo rede pública não manda nenhum pacote a outros aparelhos;
  - o modo casa exige `SIM`, só roda em RFC1918 e no máximo numa /24, recusa CGNAT, IP público e loopback, e nunca tenta login;
  - toda função que manda pacotes checa a trava de consentimento.
- **O ponto fraco:**
  - A trava técnica **não distingue a sua casa de um café**: os dois usam 192.168.x.x.
  - Quem garante que a rede é sua é a declaração explícita (`SIM`).
  - **Melhoria barata:** se o Wi-Fi atual for aberto, mostrar um aviso extra antes de pedir o `SIM` (automação E da seção 2.3).

### 5.6 Frase para o pitch

> "Em rede que não é sua, o Olharium olha só para você: o seu computador e a sua conexão. Ele não manda um pacote sequer para os aparelhos dos outros. Na sua casa, ele varre só depois que você confirma que a rede é sua, e nunca tenta senha."

**Fontes da seção 5:**
- [Lei 12.737/2012, texto original](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12737.htm)
- [Lei 14.155/2021, nova redação do art. 154-A](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14155.htm)
- [Lei 9.296/1996, art. 10](https://www.planalto.gov.br/ccivil_03/leis/l9296.htm)
- [LGPD, art. 5º, I](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- Regulamento do Hack Brasil 2026, itens 5.2, 6.8, 6.9, 11.3 e 12.2, segundo o resumo no [`CLAUDE.md`](../CLAUDE.md) e no briefing interno (o texto integral não foi relido nesta pesquisa).
- [README do agente](../packages/local-agent/README.md): garantias de segurança.
- [Microsoft, mudanças de acesso ao Wi-Fi e localização](https://learn.microsoft.com/en-us/windows/win32/nativewifi/wi-fi-access-location-changes), sobre a listagem de redes exigir localização.

---

## O que não pôde ser confirmado

- Se o HIBP aceita consultas periódicas automáticas no plano Core, que fala em "consultas sob demanda".
- Os preços do HIBP com cobrança mensal, e o preço do Serasa Premium.
- Se há API B2B da Serasa ou da Boa Vista acessível a uma startup.
- Se a leitura do tipo de Wi-Fi via WinRT (`NetworkAuthenticationType`) funciona sem permissão de localização no Windows 11 24H2.
- Se o campo `Security` do `ipconfig getsummary` continua visível no macOS 15.6+ e no 26.
- Se o `getCurrentSecurityType()` do Android funciona sem permissão de localização.
- O processo de concessão da permissão do NEHotspotHelper no iOS.
- Se os painéis da ANPD identificam empresas: pelo que encontramos, não identificam.
- A redação literal dos itens do regulamento: usamos o resumo do `CLAUDE.md` e do briefing.
