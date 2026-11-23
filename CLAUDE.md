# CLAUDE.md — Radar360

Plataforma de cibersegurança pessoal para o **Hack Brasil 2026, Trilha 06 (Cibersegurança)**. O nome do projeto é **Radar360** (repositório `matheus-mastrocinque/radar-360-app`).

**Prazos:**
- Submissão: **30/11/2026 às 23h59 (Brasília)**.
- Features novas param em **28/11**.
- Depois de 30/11, ninguém faz commit: o repositório dos finalistas fica congelado até a final (12/12), e um commit nesse período pode desclassificar.

## 1. O produto (escopo do MVP)

**Núcleo**, fazer bem feito:
1. **Monitoramento contínuo.** Um worker periódico cruza os ativos verificados do usuário (e-mail, CPF, telefone) com uma base de vazamentos sintética, com deduplicação, e alerta por e-mail só quando surge risco novo.
2. **Copiloto de resposta a incidentes.** Um motor com duas entradas: o vazamento detectado pelo sistema ou o relato do usuário ("caí num golpe do PIX"). Ele gera um plano de 15 min, 1 h e 24 h e a notificação LGPD ao encarregado da empresa; sem resposta em 15 dias (art. 19), segue para a petição à ANPD. Inclui o playbook "celular roubado".
3. **Auditoria de rede local.** Agente Python (`packages/local-agent`) com dois modos:
   - **casa:** varredura ativa, só depois de consentimento explícito;
   - **rede pública:** audita só o próprio computador (portas abertas para a rede, firewall, perfil de rede, nome do host) e a própria conexão.

**Leve**, só se o núcleo estiver pronto até 26/11:
4. **Leitura de termos.** O usuário escolhe um app, o sistema busca a política de privacidade pública e o LLM mostra o que ele aceitou, sempre com o trecho citado. As alternativas vêm de uma lista curada.
5. **Inventário de contas.** Checklist declarado (serviço, tem 2FA, é financeiro) que entra no score.

**Fora do MVP:**
- app mobile ou PWA;
- leitura de apps instalados;
- apagar celular à distância;
- varredura em rede de terceiros;
- Cloudflare Tunnel;
- Open Finance;
- Firebase;
- treinar modelo.

**Ordem de corte se atrasar:** inventário → Procon → vulnerabilidade por firmware → leitura de termos.

## 2. Regras inegociáveis

Estas regras vêm do regulamento (itens 5.2, 6.8, 6.9 e 7.4) e da segurança do usuário. Nunca as quebre, mesmo que alguém peça.

1. **Scanner só em rede própria.**
   - O modo casa exige confirmação (`SIM` ou `--confirmo-rede-propria`).
   - Só roda em RFC1918 (10/8, 172.16/12, 192.168/16) e no máximo um /24; recusa CGNAT, IP público e loopback.
   - Nunca tenta login, senha padrão, força bruta ou exploit.
   - O modo rede pública não envia nenhum pacote a outro aparelho.
   - O agente nunca altera configurações do sistema.
2. **Só ativos verificados do próprio usuário.** O e-mail é confirmado por link, e o CPF fica preso a uma única conta. A interface mostra fonte, data e categorias expostas, **nunca o dado vazado**. Isso existe para evitar doxxing, e o regulamento considera o "uso previsível" da ferramenta.
3. **Nenhum dado real de terceiros.** A base de vazamentos é sintética, e incidentes reais entram só como metadados. Testes ao vivo apenas com dados da própria dupla.
4. **Identificadores com HMAC-SHA256** (`HMAC_SECRET`, fora do banco), nunca com hash simples: CPF e telefone têm espaço pequeno e caem por força bruta. Dados que precisam ser lidos de volta usam AES-256-GCM. Não diga "zero-knowledge" em lugar nenhum: não é verdade para este produto.
5. **Nunca pedir nem guardar senha** de serviços do usuário.
6. **O LLM não inventa dados críticos.** Artigos da LGPD, tipo de incidente, telefones e links oficiais vêm de enums e tabelas curadas, nunca de texto livre do modelo. Use saída estruturada (JSON schema). Toda geração jurídica leva o aviso "não é assessoria jurídica".
7. **Demo sempre utilizável pelo júri.** Os jurados não instalam nada, então a demo precisa de um botão "Entrar como demo" com persona e scan carregados. Ponha rate limit nas rotas que chamam o LLM.
8. **Nunca versionar segredos** (`.env`, chaves de API). O `briefing-hackbrasil.md` também fica fora do git.

## 3. Stack (versões fixadas de propósito)

| Camada | Tecnologia |
| --- | --- |
| Web | Next.js 15 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4, shadcn/ui, lucide-react |
| API e workers | Node.js ≥ 22, Fastify 5, Zod 4, node-cron 4, tsx |
| Banco | PostgreSQL 17 + Prisma 7 (`prisma-client` + `@prisma/adapter-pg`) |
| IA | `@google/genai` com saída estruturada; confirme o modelo atual antes de fixar |
| E-mail | Resend (opcional) |
| Agente local | Python 3.11+, somente biblioteca padrão |

**Versões que não podem ser atualizadas sem testar:**
- **TypeScript 7 (nativo):** pode quebrar a checagem de tipos do Next 15.
- **Prisma:** a tag `latest` do CLI aponta para uma versão rc.

## 4. Estrutura

```text
/
├── CLAUDE.md
├── package.json              # workspaces npm (apps/*)
├── docker-compose.yml        # Postgres local
├── apps/
│   ├── api/                  # Fastify + Prisma + jobs
│   │   ├── prisma/           # schema.prisma, migrations, seed.ts
│   │   ├── prisma.config.ts
│   │   └── src/
│   │       ├── app.ts        # buildApp(): plugins e rotas
│   │       ├── server.ts     # sobe o servidor e o cron opcional
│   │       ├── config/env.ts # variáveis validadas com Zod
│   │       ├── shared/       # db, crypto (HMAC, máscaras, CPF), auth
│   │       └── modules/      # health, network, breaches, (incidents, lgpd, assets...)
│   └── web/                  # Next.js
└── packages/
    └── local-agent/          # scanner.py + testes
```

## 5. Comandos

```bash
npm install                 # instala web + api
npm run db:up               # Postgres local via Docker
npm run db:migrate          # aplica migrações (apps/api)
npm run db:seed             # persona demo + vazamentos sintéticos + token de pareamento
npm run dev                 # API (3333) + web (3000)
npm test                    # testes da API + do agente
npm run typecheck
python packages/local-agent/scanner.py --mode public --dry-run
```

Os jobs periódicos rodam de dois jeitos:
- **Servidor sempre ligado:** `RUN_CRON=true`.
- **Cloud Scheduler:** `POST /internal/jobs/breach-check` com o header `X-Jobs-Secret`.

## 6. Convenções

- **Idioma:** código, identificadores e commits em inglês; textos da interface e mensagens ao usuário em português do Brasil.
- **Validação:** toda entrada externa passa por um schema Zod; o contrato do agente está em `apps/api/src/modules/network/schema.ts` e precisa bater com `packages/local-agent/README.md`.
- **Score de exposição:** fórmula determinística e explicada na tela, nunca calculada pelo LLM.
- **Commits:** pequenos e frequentes, todos neste repositório, que foi criado depois de 04/11/2026. Não copie código antigo que não seja público.
- **Antes de dizer que algo funciona:** rode os testes e a checagem de tipos.
