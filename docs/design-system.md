# Design system do Olharium · HUD Neon

Identidade escolhida em 25/11/2026: o conceito 03 da 2ª rodada (`branding/concepts-v2/conceito-03/`).
Slogan: **"Vigia por você. Responde com você."**

O olho do Olharium é o painel de um sistema de defesa. A estética é cyber, mas contida: um instrumento de precisão, não "hacker de filme". **O HUD cheio fica na marca e no hero; no produto, a dose é baixa.**

## 1. Tokens (em `apps/web/src/app/globals.css`)

Tema **escuro por padrão**: o `<html>` tem a classe `dark`, e os tokens já são escuros.

| Token Tailwind | Valor | Uso |
| --- | --- | --- |
| `bg-background` | `#07060A` Obsidiana | Fundo da página |
| `bg-card` | `#15111A` Grafite | Cartões |
| `bg-muted` | `#1D1823` | Superfície elevada dentro do cartão, hover |
| `bg-ink` | `#0E0B12` | Bloco mais escuro (chips de ícone, código, área de destaque) |
| `border-border` | `#2A2430` | Bordas; em cartões prefira `ring-1 ring-white/[0.07]` |
| `text-foreground` | `#F4F1F3` Névoa | Texto principal |
| `text-muted-foreground` | `#A69DAA` Cinza Sinal | Texto secundário (7,1:1 no grafite) |
| `bg-primary` / `text-primary-foreground` | `#E3123C` Carmesim / branco | **Botão principal** e símbolo |
| `text-rubi` (= `text-brand`, `text-signal`) | `#FF3B5C` Neon Rubi | **Todo texto vermelho de marca** sobre o escuro (eyebrows, números de destaque) |
| `text-crimson`, `bg-crimson`, `bg-crimson-deep` | `#E3123C`, `#7A0820` | Gradientes, glow, detalhes gráficos (não para texto pequeno) |
| `text-telemetry` | `#4FD9E6` Ciano Telemetria | Acento **raro**: foco de teclado (`ring`), dado "ao vivo", link informativo |
| `text-success` / `bg-success/10` | `#2FD38A` | Estado: ok, resolvido, corrigido |
| `text-warning` / `bg-warning/10` | `#F5B83D` | Estado: atenção, prazo correndo |
| `text-danger` / `bg-danger/10` | `#FF6B2C` Laranja Falha | Estado: erro, risco alto, prazo vencido |
| `text-info` | `#4FD9E6` | Estado: informativo |

### Regra de ouro: carmesim é marca, nunca estado
- Erro, risco alto e incidente grave usam **sempre** `danger` (laranja), com **ícone + palavra** ("Erro", "Risco alto", "Prazo vencido").
- A escala de risco é `success` → `warning` → `danger`. Nunca passa pelo carmesim.
- A marca brilha (glow, gradiente); o estado é **chapado**, sem brilho.

### Receitas de estado (copie e cole)
```text
Alerta de perigo:  rounded-lg bg-danger/10 px-3 py-2 text-sm text-foreground ring-1 ring-danger/35  + ícone AlertTriangle text-danger
Atenção:           bg-warning/10 ring-warning/35 + ícone text-warning
Sucesso:           bg-success/10 ring-success/30 + ícone CheckCircle2 text-success
Badge de estado:   rounded-full px-2 py-px font-mono text-[11px] uppercase tracking-wider bg-danger/15 text-danger ring-1 ring-danger/30
```
**Nunca** use as cores fixas do Tailwind (`bg-red-50`, `text-amber-900`, `ring-emerald-200`...): elas são do tema claro e somem no escuro.

## 2. Tipografia

| Família | Classe | Uso |
| --- | --- | --- |
| IBM Plex Sans | `font-sans` (padrão) | Todo o texto e a interface. Títulos: `font-semibold tracking-tight` |
| IBM Plex Mono | `font-mono`, `eyebrow` | Telemetria, prazos (`T+15MIN · T+1H · T+24H`), códigos, rótulos, números de score |
| Michroma | `font-display`, `display-title` | **Só** títulos curtos de marca em caixa alta (hero, nome de seção grande). Nunca em parágrafo |

- O **wordmark oficial é o SVG** (`/brand/logo-dark.svg`, em curvas). Não escreva "Olharium" em Michroma para fazer de logo: use o componente `<Logo />`.
- Eyebrow de seção: `<span className="eyebrow text-rubi">Minhas contas</span>`.
- Números grandes (score, contagens): `font-mono tabular-nums`.

## 3. Marca (componentes em `components/brand/logo.tsx`)

| Arquivo | Quando |
| --- | --- |
| `<Logo />` → `/brand/logo-dark.svg` | Cabeçalho e rodapé (fundo escuro). `tone="light"` para fundo claro |
| `<LogoMark size={n} />` | Só o símbolo: `size < 32` usa o favicon; `≥ 32`, o ícone de app |
| `/brand/hero.svg` | Marca completa com brilho, para o hero da landing (use `<Image unoptimized>`) |
| `app/icon.svg` | Favicon da aba |

## 4. Superfícies e componentes

- **Cartão:** `<Card>` (grafite, `ring-white/[0.07]`, sombra profunda). Cabeçalho com chip de ícone: `flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]`.
- **Botão principal:** `<Button>` (carmesim). Para destaque máximo, `glow-crimson`. Um por tela, de preferência.
- **Botão secundário:** `variant="outline"`; terciário: `variant="ghost"`.
- **Campos:** `h-9 rounded-md border border-input bg-ink px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40`.
- **Chips de seleção** (radio/checkbox `sr-only`): estado marcado `bg-crimson/15 text-foreground ring-crimson/50`; desmarcado `bg-ink ring-white/10 hover:bg-muted`.
- **Módulo da central de comando:** `<Panel>` (`components/cockpit/panel.tsx`), não `<Card>`. Barra de título técnica com índice e rótulo em mono (`01 | SCORE DE EXPOSIÇÃO`) e um indicador curto à direita; corpo denso, sem parágrafo de descrição. A explicação vai para a gaveta.
- **Divulgação progressiva no painel:** na primeira dobra, só o veredito, o score, a 1ª ação inteira e o mapa. Um número aparece uma vez só (sem repetir "Risco alto" ou as correções em vários blocos), e cada tela tem um único destaque de HUD animado.
- **Gaveta de detalhes:** `InspectorProvider` + `InspectTrigger` (`components/cockpit/inspector.tsx`). Tudo que é clicável no painel abre um painel por chave; o detalhe nunca exige trocar de página.
- **Categorias de dado vazado:** chips neutros `bg-muted text-foreground ring-1 ring-white/10`; peso alto (≥ 10) com `ring-danger/40 text-danger`.

## 5. HUD em dose baixa

| Utilitário | O que faz | Onde |
| --- | --- | --- |
| `hud-corners` | Cantos de mira em volta do bloco (cor via `[--hud-color:...]`) | Score, hero, um destaque por tela |
| `bg-grid` | Malha de instrumento | Fundos de destaque |
| `glow-crimson` | Brilho carmesim | Botão principal, símbolo, score |
| `text-glow` | Brilho no texto Neon Rubi | Número do score, títulos do hero |
| `glass` | Vidro escuro com blur | Cabeçalho, painéis sobre o hero |
| `animate-orbit`, `animate-hud-pulse`, `animate-radar-sweep` | Rotação lenta, pulso, varredura | Só no hero, no score e no mapa de exposição; respeitam "reduzir movimento" |
| `animate-dash-flow` | Tracejado andando numa ligação do mapa | Só em ameaça ativa (vazamento novo, achado alto ou crítico) |
| `animate-drawer-in` | Entrada da gaveta de detalhes | Gaveta |

Regra: no máximo **um** elemento com HUD forte por tela. O resto é interface limpa.

## 6. Acessibilidade

- Contraste mínimo AA. Texto vermelho pequeno: `text-rubi`, nunca `text-crimson`.
- Foco de teclado sempre visível (`focus-visible:ring-3 focus-visible:ring-ring/50`, ciano).
- Estado nunca só por cor: ícone + palavra.
- Animações param com `prefers-reduced-motion`.
- 375 px de largura sem nada passando da borda.

## 7. Voz

- Português do Brasil, frases curtas, "você".
- Honesto: o Olharium **vigia** sozinho e **responde com você** (plano, documentos, correções com o seu OK). Nunca "100% seguro", nunca "zero-knowledge", nunca "corrigimos tudo".
- Toda tela jurídica leva "não é assessoria jurídica".
