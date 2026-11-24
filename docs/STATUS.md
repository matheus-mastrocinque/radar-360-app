# Estado do projeto: Radar360

Atualizado em 24/11/2026, no commit `7f19217`.

Este arquivo diz o que está pronto, o que falta para a submissão e quais decisões não ficam óbvias lendo o código. As regras do projeto estão no [`CLAUDE.md`](../CLAUDE.md). Leia os dois antes de começar e atualize este arquivo quando fechar uma tarefa.

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
| Link da demo no ar durante a avaliação, até 12/12 | **Falta o deploy** |
| Vídeo de até 3 min, que abre sem login | **Falta** |
| Nome, frase curta e descrição | **Falta escrever** |
| README com instruções e link da demo | Existe, mas ainda diz "esqueleto em construção" |

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
- **Rede:** `POST /network/scans` recebe o resultado do agente local, autenticado pelo token de pareamento. O contrato está em `modules/network/schema.ts`.
- **Copiloto de incidentes** (`modules/incidents`):

  | Rota | O que faz |
  | --- | --- |
  | `GET /me/incidents` e `GET /me/incidents/:id` | Lista os incidentes e mostra um com o plano |
  | `POST /me/incidents/from-breach` | Abre o plano de um vazamento detectado |
  | `POST /me/incidents/report` | Recebe o relato livre do usuário |
  | `PATCH /me/incidents/:id/steps` | Marca e desmarca passos do plano |
  | `POST /me/incidents/:id/lgpd` | Registra que a notificação foi enviada ou respondida, ou desfaz o envio |

- **Testes:** 63 testes passando (`npm test`).

### Web (`apps/web`)

- **Landing:** tem o botão "Entrar como demo".
- **Painel `/painel`:** score, vazamentos (cada um com o botão "Plano de resposta"), ativos e rede.
- **Copiloto:** `/painel/copiloto` recebe o relato e lista os incidentes; `/painel/copiloto/[id]` mostra o plano de 15 min, 1 h e 24 h e a notificação LGPD com a petição à ANPD.
- **Layout comum** (`app/painel/layout.tsx`): navegação, aviso de demo e o aviso "não é assessoria jurídica" no rodapé.
- **Sessão:** o Next guarda o cookie httpOnly `r360_session` e o repassa à API como Bearer (`lib/session.ts`, `lib/api.ts`).

### Agente local (`packages/local-agent`)

- `scanner.py` usa só a biblioteca padrão e tem dois modos: casa e rede pública. Segue todas as travas do `CLAUDE.md`.
- Tem 68 testes passando. O contrato com a API está no `README.md` do agente.

## O que falta, por prioridade

1. **Deploy, que trava a submissão.**
   - **O que subir:** web, API e Postgres, num host que não hiberne nem estoure cota até 12/12.
   - **Variáveis:** no host, configure `HMAC_SECRET` e `JOBS_SECRET` novos (nunca no git), `WEB_ORIGIN` na API e `API_URL` no web.
   - **Banco:** rode `npm run db:deploy -w @radar/api` e depois o seed. Guarde o token de pareamento que o seed imprime.
   - **Job:** agende `POST /internal/jobs/breach-check` (Cloud Scheduler ou parecido) ou use `RUN_CRON=true` num servidor sempre ligado.
2. **Cadastro real com e-mail confirmado por link.** Hoje só existe o login da demo. Falta:
   - cadastro e login por link mágico;
   - adicionar CPF e telefone, com o CPF preso a uma única conta e tudo guardado como HMAC.

   Esse é o núcleo 1 e a regra 2 do `CLAUDE.md`.
3. **Alerta por e-mail só para risco novo,** via Resend com `RESEND_API_KEY`. O job já devolve `newExposures`; falta mandar o e-mail para essas exposições. Sem a chave, o job só registra no log e segue.
4. **Gemini ao vivo.** Ponha `GEMINI_API_KEY` no `.env` local e no host e teste a classificação de um relato. Sem a chave, o copiloto classifica por palavras-chave, e já funciona assim.
5. **Vídeo** (29/11). Mostre o agente rodando na nossa própria rede, já que o júri não roda o agente, e depois o fluxo da demo: painel, vazamento, plano, LGPD e relato.
6. **README final:** link da demo e prints, sem a linha "esqueleto em construção".
7. **Texto da submissão:** nome, frase curta e descrição.
8. **Versões leves,** só se os itens 1 a 3 estiverem prontos até 26/11: leitura de termos e inventário de contas. Se atrasar, corte nesta ordem: inventário, Procon, vulnerabilidade por firmware, leitura de termos.

Confirmem também entre vocês se o e-mail à Comissão (oi@hackbrasil.com) perguntando sobre o scanner já foi enviado.

**Divisão sugerida (a combinar):** quem fica com API, worker e agente pega os itens 1 a 3; quem fica com web e copiloto pega os itens 4 a 7.

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
