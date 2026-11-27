# Plano de valor: o que o Olharium entrega de verdade

Atualizado em 27/11/2026. Complementa o [pitch-e-limites.md](pitch-e-limites.md), que lista o que o app faz hoje e o que a lei e o regulamento permitem.

## A tese

> **O Olharium não é mais um alerta: ele transforma o susto em ações concluídas.**

"Resolver", dentro das regras, quer dizer três coisas:

1. **Descobrir com dados reais e legais:** só os dados do próprio usuário ou metadados públicos de incidentes.
2. **Agir com documentos prontos e prazos:** notificação LGPD, petição à ANPD, pedido ao banco, lembretes.
3. **Proteger no momento do risco,** no computador da própria pessoa.

E o que nunca muda:
- não varremos rede alheia;
- não usamos base vazada;
- não pedimos senha;
- não alteramos o sistema de ninguém sozinhos.

## As três viradas: de "diz que faz" para "faz"

| Hoje | Depois | Como fica real e legal |
| --- | --- | --- |
| Vazamentos só de uma base fictícia | **Vazamentos reais dos serviços que a pessoa usa** | O catálogo público do Have I Been Pwned é gratuito e não exige chave. Ele tem **1.055 vazamentos reais**, e **pelo menos 13 são de empresas brasileiras** (Netshoes, Catho, Hurb, Estante Virtual, Descomplica, Vakinha, APOIA.se, Speedio...). Cada vazamento traz empresa, data, tipos de dado expostos e número de contas, **sem nenhum dado pessoal**. A licença é CC BY 4.0, então é obrigatório mostrar "Have I Been Pwned" com link. |
| Notificação LGPD só para o vazamento fictício | **Notificação para incidentes reais:** os do catálogo e o caso "a empresa me avisou que vazou" | Os mesmos modelos fixos de hoje, com o prazo de 15 dias contado e lembrete na agenda. |
| Plano de golpe só com orientação | **Kit de resposta com textos prontos:** pedido de devolução pelo MED ao banco, roteiro do boletim de ocorrência online, contestação no cartão | Modelos fixos, sem a IA inventar nada. Nunca prometemos devolução: o MED depende do banco. |

Conferido em 25/11/2026: `GET https://haveibeenpwned.com/api/v3/breaches` respondeu 200, com 1.055 vazamentos; o mais recente foi adicionado em setembro de 2026.

## Fase 1: até 28/11 (o que os avaliadores da fase online veem)

**A ideia-chave:** "Minhas contas" funciona **dentro da sessão demo**. O jurado marca os serviços que usa, por exemplo Netshoes e Catho, e vê na hora os vazamentos **reais** desses serviços, com plano e notificação. Isso não exige cadastro nem dado pessoal. Por isso, o cadastro real deixa de ser pré-requisito da demo.

| Prioridade | Entrega | Valor para o jurado | Esforço |
| --- | --- | --- | --- |
| **P0** | **Minhas contas + vazamentos reais.** A pessoa escolhe serviços numa lista com busca, e cada um pode ter 2FA e ser financeiro. Um job importa o catálogo do HIBP todo dia. A tela mostra os vazamentos de cada serviço (empresa, data, dados expostos), com o atalho "Plano de resposta". Entra no score. | Prova que o motor funciona com dados reais e legais. Também entrega a feature leve "inventário de contas". | 6 a 8 h |
| **P0** | **Notificação LGPD para incidente real:** vazamento do catálogo e relato "a empresa me avisou". | O documento sai de verdade para qualquer pessoa. | 3 a 5 h |
| **P0** | **Rebrand Olharium e promessas corretas na landing**, ajustando as frases apontadas no pitch-e-limites. | O vídeo sai com marca nova e sem exagero. | 2 a 3 h, além do design system |
| **P1** | **Lembrete do prazo de 15 dias** num arquivo `.ics` ("Adicionar à agenda"). | Automação visível, sem servidor. | 1 a 2 h |
| **P1** | **Kit do golpe do Pix:** texto pronto do pedido MED para colar no app do banco e roteiro do BO online. | O plano do Pix passa a entregar documento, não só conselho. | 3 a 4 h |
| **P1** | **Atalho para corrigir no Windows:** o agente mostra o atalho `ms-settings:` da tela certa para cada achado, como firewall ou compartilhamento. | Leva a pessoa até a correção sem alterar nada por ela. | 1 a 2 h |
| **P1** | **Cadastro real com e-mail confirmado** por link mágico (Resend, grátis) e **alerta por e-mail** quando surgir vazamento novo num serviço que a pessoa usa. | Fecha o "monitoramento contínuo" para pessoas reais. | 8 a 12 h |
| **P2** | **Modo vigia de Wi-Fi:** o agente avisa ao conectar numa rede aberta ou WEP. | Proteção no momento do risco. | 8 a 12 h |

**Conta:** P0 soma 11 a 16 h, e P1 soma 13 a 20 h. Para duas pessoas em três dias, P0 e P1 cabem se começarem hoje. P2 só entra se sobrar tempo.

**Divisão sugerida:**
- **API e agente:** importação do catálogo, Minhas contas (backend), notificação para incidente real, cadastro e alerta, atalhos `ms-settings:`.
- **Web e marca:** rebrand, landing, telas de Minhas contas, `.ics` e kit do Pix.

## Fase 2: na final, em 12/12, com os créditos dos patrocinadores

O repositório fica congelado de 30/11 até a final, mas na final os times continuam o projeto no local (regulamento, item 8.3). É ali que entram os recursos pagos:

| Recurso | Para quê |
| --- | --- |
| **HIBP, busca por e-mail** (plano Core, a partir de US$ 52,68 por ano) | "Descubra se o **seu** e-mail vazou", com e-mail verificado e atribuição. Antes, confirmar com o HIBP se a reconsulta periódica é permitida. |
| **Firecrawl** (5.000 créditos por participante) | Encontrar o contato do encarregado na política de privacidade de cada empresa, preenchendo o destinatário da notificação; acompanhar notícias de incidentes brasileiros que o HIBP não cobre; leitura de termos. |
| **Resend** (créditos para finalistas) | Alertas reais em escala, com domínio próprio. |
| **Nvoip** (3 meses grátis por participante) | Confirmar o telefone por SMS e mandar alerta por SMS. |
| **Gemini ligado** | Entender relatos mais variados. |
| **Modo vigia e app de bandeja** | Aviso em tempo real no computador. |

## O que não faremos, e a frase para o jurado

| Não faremos | Por quê | Frase |
| --- | --- | --- |
| Varrer redes ou aparelhos alheios | Regulamento 5.2, 6.8 e 6.9; Código Penal, art. 154-A | "Vigiamos só o que é seu, e isso é uma escolha de projeto." |
| Usar, comprar ou mostrar base vazada | LGPD; regulamento 6.9; risco de doxxing | "Mostramos onde e quando, nunca o dado." |
| Pedir senha, nem para checar se vazou | Regra 5 do projeto | "Senha a gente não pede. Indicamos o gerenciador de senhas." |
| Alterar o sistema sozinho | Segurança e confiança do usuário | "O agente corrige com o seu OK, uma ação por vez, e sabe desfazer. Quem decide é você." |
| Prometer devolução de dinheiro | O MED depende do banco | "Mostramos como pedir nos primeiros minutos." |

## Roteiro do pitch e do vídeo (cerca de 2 min)

1. **A dor (15 s):** "Seus dados vazaram, ou você caiu num golpe. E agora?" O Google encerrou o relatório da dark web em 2026 porque ele não dizia o que fazer. Abrir na central de comando: score, mapa de exposição e fila de ação.
2. **Vazamento real (40 s):** entrar como demo, marcar Netshoes e Catho em Minhas contas, ver os vazamentos reais (via HIBP), abrir o plano, gerar a notificação LGPD com o prazo de 15 dias e a petição à ANPD.
3. **Golpe (30 s):** relato livre "caí num golpe do Pix", plano de 15 min, 1 h e 24 h, com o texto do pedido MED pronto.
4. **Rede (20 s):** o agente rodando na nossa rede, corrigindo com o nosso `SIM` (e o `MEU ROTEADOR` antes de mexer no roteador), e a correção aparecendo no painel. Gravar no ambiente local, nunca enviando auditoria real à produção.
5. **Fecho (15 s):** "O motor é real e as fontes são plugáveis. Na final, ligamos a busca por e-mail, o Firecrawl e o SMS."

## Fontes

- [Catálogo de vazamentos do HIBP (API v3)](https://haveibeenpwned.com/API/v3#AllBreaches): gratuito, sem chave.
- [Termos e licença do HIBP](https://haveibeenpwned.com/API/v3#License): CC BY 4.0, com atribuição.
- Restrições e preços da busca por e-mail, regras do regulamento e fontes legais: veja as seções 3 e 5 de [pitch-e-limites.md](pitch-e-limites.md).
