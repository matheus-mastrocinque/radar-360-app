# Olharium

**Vigia por você. Responde com você.**

O Olharium é uma plataforma de cibersegurança pessoal, criada para o Hack Brasil 2026 (Trilha 06, Cibersegurança). Ela tem três frentes:

- **Vazamentos que afetam você:** a pessoa marca os serviços que usa ("Minhas contas") e vê os vazamentos **reais e públicos** de cada um, do catálogo verificado do Have I Been Pwned (só metadados). E-mail, CPF e telefone monitorados são cruzados por HMAC com a base de vazamentos.
- **Plano de ação com LGPD:** de um vazamento, de um relato ("caí num golpe do Pix") ou de um aviso da empresa, gera o que fazer em 15 minutos, 1 hora e 24 horas, a notificação LGPD pronta para a empresa e, sem resposta em 15 dias, a petição à ANPD.
- **Auditoria e correção da rede:** um agente leve no computador da pessoa mostra o que está exposto (em casa e em Wi-Fi público) e **corrige com o OK dela a cada passo**: liga o firewall, muda o perfil de rede, desliga compartilhamentos, bloqueia portas e fecha portas abertas no roteador via UPnP, sempre com "desfazer".

> **Demo pública:** [radar360-web.vercel.app](https://radar360-web.vercel.app). Clique em "Entrar como demo": a persona, as contas e as redes são fictícias; os vazamentos de "Minhas contas" são reais e públicos. O que está pronto e o que falta: [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md).

## Arquitetura

```text
 Navegador ──► apps/web (Next.js 15) ──► apps/api (Fastify) ──► PostgreSQL (Prisma)
                                            ▲      │
 Computador do usuário                      │      └─ job periódico: cruza ativos x vazamentos
 packages/local-agent (Python) ── HTTPS + token de pareamento
```

## Segurança e privacidade, por projeto

- **Identificadores protegidos:** CPF, telefone e e-mail monitorados são guardados como **HMAC-SHA256** com chave secreta fora do banco, além de uma versão mascarada para exibição. Um hash simples não protegeria: CPF e telefone caem por força bruta.
- **Só dados do próprio usuário:** o sistema só monitora dados verificados do dono da conta e nunca mostra o conteúdo vazado, apenas a fonte, a data e as categorias expostas.
- **Dados fictícios na demo:** a persona e as empresas da base de demonstração são inventadas. Os vazamentos reais vêm só como metadados públicos (empresa, data, categorias), nunca com dado pessoal.
- **Agente local:**
  - em casa, só varre a rede depois de o usuário confirmar que ela é dele (e apenas redes privadas, no máximo um /24);
  - em rede pública, não envia nenhum pacote a outros aparelhos;
  - nunca tenta login, senha padrão ou exploração de falhas;
  - só corrige o próprio computador e o próprio roteador, mostrando antes o que vai mudar, pedindo confirmação a cada ação e guardando como desfazer.
- **IA com dados curados:** a IA não inventa telefones, links nem artigos de lei; esses dados vêm de listas curadas.

## Como rodar localmente

Pré-requisitos: Node.js 22 ou superior, Docker e Python 3.11 ou superior.

```bash
npm install
cp apps/api/.env.example apps/api/.env       # preencha HMAC_SECRET e JOBS_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run db:up         # Postgres local
npm run db:migrate    # cria as tabelas
npm run db:generate -w @radar/api   # gera o cliente do Prisma (não vai para o git)
npm run db:seed       # persona demo, vazamentos sintéticos e token do agente
npm run dev           # API em http://localhost:3333 e web em http://localhost:3000
```

Para gerar os segredos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Agente local

```bash
# Wi-Fi público: audita só o próprio computador, sem tocar em outros aparelhos
python packages/local-agent/scanner.py --mode public --dry-run

# Rede de casa: pede confirmação de que a rede é sua antes de qualquer varredura
python packages/local-agent/scanner.py --mode home --api http://localhost:3333 --token <token do seed>
```

### Testes

```bash
npm test              # testes da API e do agente
npm run typecheck
```

## Jobs periódicos

- **Servidor sempre ligado:** `RUN_CRON=true` faz a API rodar o cruzamento de vazamentos sozinha.
- **Produção (Vercel, sem processo sempre ligado):** o workflow [`breach-check.yml`](.github/workflows/breach-check.yml) do GitHub Actions chama `POST /internal/jobs/breach-check` com o header `X-Jobs-Secret` a cada 6 horas.

## Produção (custo zero)

| Parte | Onde | Endereço |
| --- | --- | --- |
| Web (Next.js) | Vercel, plano Hobby | [radar360-web.vercel.app](https://radar360-web.vercel.app) |
| API (Fastify) | Vercel Functions, `src/server.ts` como entrypoint | [radar360-api-hazel.vercel.app](https://radar360-api-hazel.vercel.app/health) |
| Banco | Neon Free (Postgres), São Paulo | via integração da Vercel |
| Job de vazamentos | GitHub Actions, a cada 6 horas | [`breach-check.yml`](.github/workflows/breach-check.yml) |

Detalhes de configuração e de como publicar de novo estão em [`docs/STATUS.md`](docs/STATUS.md).

## Licença

[MIT](LICENSE)
