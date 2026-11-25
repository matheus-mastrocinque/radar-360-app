# Estado do projeto: Radar360

Atualizado em 24/11/2026, depois do deploy em produção.

**Demo no ar:** [radar360-web.vercel.app](https://radar360-web.vercel.app) (API: [radar360-api-hazel.vercel.app/health](https://radar360-api-hazel.vercel.app/health)).

Este arquivo diz o que está pronto, o que falta para a submissão e quais decisões não ficam óbvias lendo o código. As regras do projeto estão no [`CLAUDE.md`](../CLAUDE.md). Leia os dois antes de começar e atualize este arquivo quando fechar uma tarefa.

## Onde paramos

| Commit | O que entrou |
| --- | --- |
| `70bf52e` | Login da demo e painel de exposição |
| `58b5fd4` | Copiloto de incidentes, com notificação LGPD e petição à ANPD |
| `7f19217` | Redesign da landing, do painel e do copiloto |
| `6f0aa53` | Este arquivo |
| `ee08a45` | Preparação para produção: limites por visitante, teto do Gemini, workflow do job |
| `6e55eb1` | Correções para a API rodar na Vercel e documentação de produção |
| `f9d6d7a` | Agente corrige com consentimento a cada ação (`--corrigir`, `--simular`, `--desfazer`) |
| `0852af8` | Vazamentos reais (catálogo HIBP), Minhas contas e "a empresa me avisou" |
| `f401e64` | Marca Olharium (HUD Neon), design system e telas refeitas |

A produção roda o código do `f401e64`, publicado na noite de 25/11, com as duas migrações novas aplicadas no Neon e o catálogo de vazamentos reais importado (872 vazamentos). Todos os roteiros de verificação passaram no endereço público.

## Prazos

| Data | O que acontece |
| --- | --- |
| 28/11 | Fim das features novas; daqui em diante, só correção de bugs, README e dados de exemplo |
| 29/11 | Gravar e editar o vídeo |
| 30/11, 23h59 (Brasília) | Fim da submissão; a meta é enviar à tarde |
| Depois de 30/11 | Nenhum commit até a final (12/12), porque um commit pode desclassificar |

## O que a submissão exige

| Item | Situação |
| --- | --- |
| Repositório público no GitHub, criado depois de 04/11 às 21h, sem fork nem histórico importado | Pronto: público, criado em 21/11 |
| Link da demo no ar durante a avaliação, até 12/12 | Pronto: [radar360-web.vercel.app](https://radar360-web.vercel.app), em planos gratuitos |
| Vídeo de até 3 min, que abre sem login | **Falta** |
| Nome, frase curta e descrição | **Falta escrever** |
| README com instruções e link da demo | Tem o link; faltam prints e a revisão final |

**Avaliação:** quatro critérios de peso igual, de 0 a 10 cada: execução técnica, implementação técnica, impacto e comunicação (o vídeo). São precisos 20 de 40 pontos para ir à final.

## O que está pronto

### API (`apps/api`)

- **Banco** (`prisma/schema.prisma` e `prisma/migrations`): usuários, ativos guardados como HMAC, base sintética de vazamentos, exposições, tokens de pareamento, sessões, auditorias de rede e incidentes.
- **Login da demo:** `POST /auth/demo` e `POST /auth/logout` abrem e fecham uma sessão curta na persona fictícia. Cada login cria também um incidente de exemplo, o vazamento da TeleConecta com a notificação LGPD vencida, para mostrar a petição à ANPD.
- **Painel:** `GET /me/dashboard` devolve o score, os vazamentos, os ativos e as auditorias de rede. A fórmula do score fica em `modules/dashboard/score.ts`; é fixa e explicada na tela.
- **Job de vazamentos** (`modules/breaches/job.ts`):
  - cruza os ativos verificados com a base por HMAC;
  - deduplica pelo índice único (`assetId`, `breachId`);
  - roda com `RUN_CRON=true` ou com `POST /internal/jobs/breach-check` e o header `X-Jobs-Secret`;
  - **ainda não envia e-mail.**
- **Rede:** `POST /network/scans` recebe o resultado do agente local, autenticado pelo token de pareamento. O contrato está em `modules/network/schema.ts`. O campo opcional `fixes` traz as correções que o agente aplicou com o OK do usuário; o painel mostra "Corrigido pelo agente".
- **Vazamentos reais** (`modules/breaches/hibp.ts`): importa o catálogo público do Have I Been Pwned, só metadados (empresa, domínio, data, categorias, contas afetadas). Entram só vazamentos **verificados** pelo HIBP; ficam de fora os atribuídos à empresa errada, os sensíveis, as listas de spam e os sem domínio. Hoje são 872, 7 deles de empresas brasileiras. Rota: `POST /internal/jobs/breach-catalog` (com `X-Jobs-Secret`); local: `npm run catalog:import -w @radar/api`. A licença é CC BY 4.0, por isso toda tela mostra a atribuição.
- **Minhas contas** (`modules/accounts`): a pessoa marca os serviços que usa (lista curada + catálogo), e cada um mostra os vazamentos reais do mesmo domínio, com "Plano de resposta". Guarda só nome e domínio, nunca login nem senha. Na demo, as contas pertencem à sessão; cada login demo já vem com Netshoes, LinkedIn e Nubank.
- **"A empresa me avisou"** (`POST /me/incidents/company-notice`): empresa, mês opcional e o que vazou (lista fechada) viram um plano com a notificação LGPD pronta.
- **Copiloto de incidentes** (`modules/incidents`):

  | Rota | O que faz |
  | --- | --- |
  | `GET /me/incidents` e `GET /me/incidents/:id` | Lista os incidentes e mostra um com o plano |
  | `POST /me/incidents/from-breach` | Abre o plano de um vazamento detectado |
  | `POST /me/incidents/report` | Recebe o relato livre do usuário |
  | `PATCH /me/incidents/:id/steps` | Marca e desmarca passos do plano |
  | `POST /me/incidents/:id/lgpd` | Registra que a notificação foi enviada ou respondida, ou desfaz o envio |

- **Testes:** 83 testes passando (`npm test`).

### Web (`apps/web`)

- **Landing:** tem o botão "Entrar como demo".
- **Painel `/painel`:** score, vazamentos (cada um com o botão "Plano de resposta"), ativos e rede.
- **Copiloto:** `/painel/copiloto` recebe o relato, o formulário "Uma empresa avisou que vazou seus dados?" e lista os incidentes; `/painel/copiloto/[id]` mostra o plano de 15 min, 1 h e 24 h e a notificação LGPD com a petição à ANPD. Vazamentos reais aparecem com o selo "Vazamento real" e a fonte.
- **Minhas contas:** `/painel/contas`, com busca, sugestões, verificação em duas etapas, "mexe com dinheiro" e os vazamentos reais de cada serviço.
- **Layout comum** (`app/painel/layout.tsx`): navegação, aviso de demo e o aviso "não é assessoria jurídica" no rodapé.
- **Sessão:** o Next guarda o cookie httpOnly `r360_session` e o repassa à API como Bearer (`lib/session.ts`).
- **Chamadas à API:** todas passam por `lib/api-fetch.ts`, que também repassa o IP do visitante. O formulário de relato roda no navegador e, por isso, pega as opções de `lib/report-options.ts`, não de `lib/incidents.ts`.

### Agente local (`packages/local-agent`)

- `scanner.py` usa só a biblioteca padrão e tem dois modos: casa e rede pública. Segue todas as travas do `CLAUDE.md`.
- Tem 68 testes passando. O contrato com a API está no `README.md` do agente.

## O que falta, por prioridade

1. **Ligar o job agendado no GitHub** (Matheus, que tem o valor do segredo). Em Settings → Secrets and variables → Actions, crie `RADAR_API_URL` (`https://radar360-api-hazel.vercel.app`) e `RADAR_JOBS_SECRET` (o mesmo `JOBS_SECRET` da API). Depois rode o workflow "Busca de vazamentos" uma vez à mão para conferir.
2. **Cadastro real com e-mail confirmado por link.** Hoje só existe o login da demo. Falta:
   - cadastro e login por link mágico;
   - adicionar CPF e telefone, com o CPF preso a uma única conta e tudo guardado como HMAC.

   Esse é o núcleo 1 e a regra 2 do `CLAUDE.md`.
3. **Alerta por e-mail só para risco novo,** via Resend com `RESEND_API_KEY`. O job já devolve `newExposures`; falta mandar o e-mail para essas exposições. Sem a chave, o job só registra no log e segue.
4. **Gemini ao vivo.** Ponha `GEMINI_API_KEY` no `.env` local e, em produção, com `npx vercel env add GEMINI_API_KEY production` na pasta ligada à API. Depois publique a API de novo e teste um relato. Sem a chave, o copiloto classifica por palavras-chave, e já funciona assim.
5. **Agente local contra a produção.** Ainda não foi testado. Rode `scanner.py --mode home --api https://radar360-api-hazel.vercel.app --token <token de produção>` na nossa rede e confira a auditoria no painel. Isso já serve de ensaio para o vídeo.
6. **Vídeo** (29/11). Mostre o agente rodando na nossa própria rede, já que o júri não roda o agente, e depois o fluxo da demo: painel, vazamento, plano, LGPD e relato.
7. **README final:** o link da demo já está lá; faltam prints e a revisão final.
8. **Texto da submissão:** nome, frase curta e descrição. Assim que o vídeo existir, enviem uma primeira versão de garantia: vale a última versão enviada até 30/11 às 23h59.
9. **Versões leves:** o inventário de contas já entrou, como "Minhas contas". Falta a leitura de termos, só se os itens 1 a 3 estiverem prontos até 26/11.
10. **Testar as correções do agente de verdade.** `scanner.py --corrigir` (com `--simular` e `--desfazer`) já existe, com 138 testes, mas os comandos de mudança e o UPnP só foram exercitados com mocks. Antes do vídeo, rodem num computador e num roteador de vocês: `--mode public --corrigir` num terminal de administrador e `--mode home --corrigir` na rede de casa. Muitos roteadores só deixam fechar portas abertas pelo próprio aparelho (erros 606/718), e o agente explica isso.

Confirmem também entre vocês se o e-mail à Comissão (oi@hackbrasil.com) perguntando sobre o scanner já foi enviado.

**Divisão sugerida (a combinar):** o item 1 é do Matheus. Os itens 2 e 3 (cadastro e alertas) são o maior bloco de código e cabem em quem pegar API e worker. O resto se divide entre os dois.

## Decisões que não aparecem só lendo o código

- **A demo é isolada por sessão.** Os incidentes de um usuário demo guardam o `sessionId`. As consultas filtram por `{ userId, sessionId }`, e os incidentes somem junto com a sessão. Assim, um jurado não vê o relato de outro.
- **O plano de resposta não é salvo.** Ele é montado a cada leitura a partir do playbook em `modules/incidents/catalog.ts` e dos sinais do relato; o banco guarda só `completedSteps`. Por isso, não renomeie ids de passo: um passo renomeado some do progresso de quem já o tinha marcado.
- **A IA só classifica.** Ela escolhe o tipo e os sinais em listas fechadas e escreve um resumo curto. Passos, links oficiais e artigos da LGPD vêm de `catalog.ts`. Se o usuário escolhe o tipo, a IA nem é chamada.
- **O relato é limpo antes de tudo.** `redact.ts` tira CPF, cartão, telefone, e-mail e chave Pix antes de salvar o relato e antes de mandá-lo à IA.
- **A notificação LGPD e a petição à ANPD são modelos fixos** (`lgpd.ts`). CPF e e-mail aparecem como `[preencha]`, porque o sistema só os guarda como HMAC. O prazo é de 15 dias corridos (art. 19, II).
- **Limites de uso:**
  - relato: 6 por minuto por IP e 20 por hora por usuário ou sessão;
  - leituras: 60 por minuto;
  - escritas: 30 por minuto.
- **Modelo do Gemini:** o padrão é `gemini-3.5-flash-lite` e pode ser trocado com `GEMINI_MODEL`.
- **Vazamento de serviço não é exposição confirmada.** Quando um serviço de "Minhas contas" teve vazamento, não sabemos se a conta da pessoa estava nele. Por isso a tela diz "o serviço teve um vazamento", e a notificação LGPD pede à empresa que confirme (art. 18, I e II). Esses vazamentos não entram no score; só as exposições confirmadas por HMAC entram.
- **Quem pode abrir plano de um vazamento:** quem tem um dado verificado exposto nele, ou quem marcou o serviço (mesmo domínio) em "Minhas contas". Qualquer outro caso devolve 404.

## Produção

Tudo em planos gratuitos, sem cartão, na conta Vercel do Matheus. O plano Hobby não aceita outros membros, então publicar, ver logs e mudar variáveis passa pelo login dele. O Victor trabalha local e pelo GitHub.

| Projeto Vercel | Root Directory | Endereço |
| --- | --- | --- |
| `radar360-web` | `apps/web` | [radar360-web.vercel.app](https://radar360-web.vercel.app) |
| `radar360-api` | `apps/api` | [radar360-api-hazel.vercel.app](https://radar360-api-hazel.vercel.app/health) |

O banco é um Neon Free em São Paulo (`sa-east-1`), criado pela integração da Vercel e ligado ao `radar360-api`. Ele preenche `DATABASE_URL` (com pool) e `DATABASE_URL_UNPOOLED` (direta).

**Variáveis de produção** (os valores ficam só na Vercel):

| Projeto | Variáveis |
| --- | --- |
| API | `DATABASE_URL` (da integração), `HMAC_SECRET`, `JOBS_SECRET`, `PROXY_SECRET`, `WEB_ORIGIN`, `PORT=3000` |
| Web | `API_URL`, `PROXY_SECRET` (o mesmo valor da API) |

Os segredos estão como "Secret": nem a CLI consegue ler o valor de volta. O `PORT=3000` ficou de um teste e não atrapalha: na Vercel, o `listen()` é interceptado.

**Como publicar de novo:**
- **Sem Git integrado:** a publicação é feita pela CLI, a partir de uma cópia limpa do commit, para que nenhum `.env` local suba:

  ```bash
  git archive HEAD | tar -x -C <pasta-vazia>
  cd <pasta-vazia>
  npx vercel link --project radar360-api   # ou radar360-web
  npx vercel deploy --prod
  ```

- **Migrações:** rode `npx prisma migrate deploy` em `apps/api` com `DATABASE_URL` apontando para a `DATABASE_URL_UNPOOLED`, que você tira de `npx vercel env pull`.
- **Catálogo de vazamentos reais:** depois de publicar, chame `POST /internal/jobs/breach-catalog` com o `X-Jobs-Secret` (o workflow do GitHub Actions também faz isso a cada 6 horas).
- **Migração nova sem terminal interativo:** o `prisma migrate dev` recusa rodar sem terminal interativo. Gere o SQL com `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, salve em `prisma/migrations/<data>_<nome>/migration.sql` e aplique com `npx prisma migrate deploy`.
- **Seed de novo:** precisa do mesmo `HMAC_SECRET` de produção. Se ninguém tiver o valor, gere outro, grave com `npx vercel env add HMAC_SECRET production --force`, rode o seed com esse valor e publique a API de novo.

**Armadilhas já resolvidas:**
- **Entrada da API:** a Vercel só aceita como entrada um arquivo que importe `fastify` diretamente. Por isso a instância é criada em `server.ts`, e as rotas ficam em `build-app.ts`.
- **listen() sem `await`:** na Vercel, um `await` no `listen()` deixa toda requisição pendurada.
- **Limites de uso por visitante:** o site repassa o IP do visitante à API, protegido pelo `PROXY_SECRET`. Sem ele, todos os visitantes contariam como um só IP.
- **Token do agente local de produção:** foi gerado de novo no seed de 25/11 e vale 30 dias, até 25/12; o token anterior deixou de valer. Fica com o Matheus, junto com o `JOBS_SECRET` e o `HMAC_SECRET` de produção, e nunca vai para o git.
- **Roteiros de verificação que bloqueiam sites externos:** se um roteiro bloqueia tudo o que não é `localhost`, ele também bloqueia o site de produção. Libere o domínio `radar360-web.vercel.app` ao rodar contra a produção.

## Como rodar

Siga o [README](../README.md). Pontos que costumam travar:

- **Banco:** o Postgres do Docker fica em `127.0.0.1:5433`, não na porta 5432.
- **Cliente do Prisma:** depois de clonar ou de mudar o `schema.prisma`, rode `npm run db:generate -w @radar/api`. O cliente gerado (`apps/api/src/generated/`) não vai para o git.
- **Segredos:** cada um gera os próprios `HMAC_SECRET` e `JOBS_SECRET` locais. O seed calcula os HMACs da base sintética com o seu `HMAC_SECRET`, então rode `npm run db:seed` de novo se trocar o segredo.
- **Teste rápido:** `npm run dev` sobe a API na porta 3333 e o web na 3000; entre com "Entrar como demo".
- **Antes de cada commit:** rode `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.

## Como trabalhar em dupla

- **Git:**
  - rode `git pull --rebase` antes de começar e antes de cada push;
  - faça commits pequenos, com mensagem em inglês;
  - para mudanças grandes, crie um branch e abra um PR para a `main`.
- **Nunca vão para o git:** os arquivos `.env`, as chaves de API e o `briefing-hackbrasil.md`.
- **Ao fechar uma tarefa:** atualize este arquivo, para o outro saber em que pé está.
