import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock,
  EyeOff,
  FingerprintPattern,
  FlaskConical,
  Gauge,
  KeyRound,
  Network,
  Radar,
  Scale,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ApiStatus } from "@/components/landing/api-status";
import { DemoButton } from "@/components/landing/demo-button";
import { HeroEye } from "@/components/landing/hero-eye";
import { Fragment, PhaseOrbit } from "@/components/landing/phase-orbit";
import { buttonVariants } from "@/components/ui/button";
import { getApiHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const HIBP_URL = "https://haveibeenpwned.com/PwnedWebsites";

const NAV = [
  { href: "#o-que-faz", label: "O que faz" },
  { href: "#tres-fases", label: "Três fases" },
  { href: "#protecao", label: "Proteção" },
  { href: "#na-demo", label: "Real ou fictício" },
];

const NOTICES = {
  demo: {
    tone: "danger",
    title: "Erro",
    text: "Não foi possível abrir a demo agora. Tente de novo em alguns segundos.",
  },
  expirada: {
    tone: "warning",
    title: "Sessão expirada",
    text: "Sua sessão da demo terminou. Entre de novo para continuar.",
  },
} as const;

const PILLARS = [
  {
    icon: ShieldAlert,
    screen: "Minhas contas",
    title: "Vazamentos reais dos serviços que você usa",
    description:
      "Marque os serviços que você usa e veja os vazamentos públicos de cada um, com a empresa, a data e as categorias expostas. Só metadados: o dado vazado nunca aparece.",
    points: [
      "Catálogo público do Have I Been Pwned, só vazamentos verificados",
      "Busque o serviço ou escolha entre as sugestões",
      "Cada vazamento tem o botão \"Plano de resposta\"",
    ],
    source: { label: "Fonte: Have I Been Pwned · CC BY 4.0", href: HIBP_URL },
  },
  {
    icon: Scale,
    screen: "Copiloto",
    title: "Plano de resposta em 15 min, 1 h e 24 h",
    description:
      "Conte o que aconteceu (\"caí num golpe do Pix\"), abra um vazamento ou diga que uma empresa avisou você. O copiloto monta o que fazer em cada prazo, com a notificação LGPD pronta para a empresa.",
    points: [
      "Golpe do Pix, celular roubado, conta invadida, link falso",
      "Notificação ao encarregado da empresa (LGPD, art. 18)",
      "Sem resposta em 15 dias, a petição à ANPD sai pronta",
    ],
    source: { label: "Orientação informativa · não é assessoria jurídica" },
  },
  {
    icon: Wifi,
    screen: "Agente local",
    title: "Um agente que audita e corrige a sua rede",
    description:
      "Um programa leve roda no seu computador. Em casa, com o seu consentimento, mapeia a sua rede; no Wi-Fi público, olha só o seu computador. E corrige com o seu OK a cada passo.",
    points: [
      "Liga o firewall nos perfis que estavam desligados",
      "Fecha portas abertas por UPnP no seu roteador",
      "Mostra o comando exato e desfaz quando você quiser",
    ],
    source: { label: "Python, só biblioteca padrão · nunca tenta senhas" },
  },
];

const PHASES = [
  {
    angle: 0,
    code: "T+15MIN",
    when: "Agora",
    title: "Travar o que dá para travar",
    steps: ["Bloquear o cartão pelo app do banco", "Trocar a senha onde ela se repete", "Pedir a devolução do Pix (MED)"],
  },
  {
    angle: 120,
    code: "T+1H",
    when: "Na primeira hora",
    title: "Avisar quem precisa saber",
    steps: ["Proteger o seu chip", "Enviar a notificação LGPD à empresa", "Registrar o boletim de ocorrência"],
  },
  {
    angle: 240,
    code: "T+24H",
    when: "Nas próximas 24 horas",
    title: "Deixar tudo registrado",
    steps: ["Consultar o Registrato do Banco Central", "Conferir extratos e faturas", "Acompanhar a resposta da empresa"],
  },
];

const SAFEGUARDS = [
  {
    icon: EyeOff,
    title: "Onde e quando, nunca o dado",
    description:
      "Mostramos a fonte, a data e as categorias expostas. O dado vazado nunca aparece, para a ferramenta não servir para expor ninguém.",
  },
  {
    icon: FingerprintPattern,
    title: "Identificadores como HMAC",
    description:
      "E-mail, CPF e telefone viram uma assinatura HMAC-SHA256 com uma chave guardada fora do banco. Dá para comparar, não para ler de volta.",
  },
  {
    icon: KeyRound,
    title: "Não pedimos senha",
    description:
      "Nunca pedimos nem guardamos a senha de nenhum serviço seu. Em \"Minhas contas\" ficam só o nome e o site do serviço.",
  },
  {
    icon: Network,
    title: "Só na sua rede, só com o seu OK",
    description:
      "O agente recusa IP público e rede de operadora, nunca tenta senha nem invade aparelhos. Cada correção pede confirmação e pode ser desfeita.",
  },
  {
    icon: Scale,
    title: "A IA não inventa a lei",
    description:
      "Artigos da LGPD, prazos e links oficiais vêm de tabelas revisadas. A IA só ajuda a classificar o que aconteceu com você.",
  },
  {
    icon: Gauge,
    title: "Score com conta aberta",
    description:
      "O score de exposição, de 0 a 100, segue uma fórmula fixa explicada na tela. Nenhuma IA decide a sua nota.",
  },
];

const DEMO_FICTIONAL = [
  "A persona e os dados pessoais dela",
  "As contas que ela marcou em \"Minhas contas\"",
  "As redes de casa e de Wi-Fi público e as auditorias do agente",
  "Os vazamentos de e-mail, CPF e telefone, de uma base sintética",
];

const DEMO_REAL = [
  "Os vazamentos de \"Minhas contas\": públicos, verificados pelo Have I Been Pwned e só com metadados",
  "Os planos de resposta, os artigos da LGPD e os links oficiais (Registrato, Celular Seguro, ANPD)",
  "O agente local, que roda de verdade no computador de quem o instala",
];

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <span className="eyebrow flex items-center gap-2.5 text-rubi">
        <span className="h-px w-6 bg-rubi/70" aria-hidden />
        {eyebrow}
      </span>
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.1]">
        {title}
      </h2>
      {children && <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{children}</p>}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sessao?: string }>;
}) {
  const params = await searchParams;
  const notice =
    params.erro === "demo" ? NOTICES.demo : params.sessao === "expirada" ? NOTICES.expirada : null;
  const health = await getApiHealth();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <header className="glass sticky top-0 z-40 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Olharium: início"
            className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo height={26} />
          </Link>
          <nav aria-label="Seções da página" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <DemoButton variant="compact" className="ml-auto" />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero: o único bloco com HUD forte */}
        <section className="relative isolate overflow-hidden" aria-labelledby="hero-titulo">
          <div
            className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_70%_at_72%_45%,black,transparent)] max-lg:[mask-image:radial-gradient(ellipse_90%_45%_at_50%_22%,black,transparent)]"
            aria-hidden
          />
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(circle_520px_at_73%_46%,color-mix(in_oklab,var(--crimson)_20%,transparent),transparent)] max-lg:bg-[radial-gradient(circle_300px_at_50%_150px,color-mix(in_oklab,var(--crimson)_20%,transparent),transparent)]"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-background"
            aria-hidden
          />

          <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pt-6 pb-14 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-10 lg:pt-12 lg:pb-14">
            <div className="flex flex-col gap-5 max-lg:order-2 sm:gap-6">
              <span className="eyebrow flex items-center gap-2.5 text-rubi">
                <span className="h-px w-6 bg-rubi/70" aria-hidden />
                Cibersegurança pessoal
              </span>

              <h1 id="hero-titulo" className="display-title text-[1.6rem] text-foreground sm:text-[2.2rem] lg:text-[2.35rem] xl:text-[2.6rem]">
                <span className="block">Seus dados vazaram.</span>
                <span className="block text-rubi text-glow">E agora?</span>
              </h1>

              <p className="text-[1.3rem] leading-tight font-semibold tracking-tight sm:text-[1.75rem]">
                Vigia por você. Responde com você.
              </p>

              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                O Olharium mostra os vazamentos dos serviços que você usa, monta o que fazer em 15 minutos, 1 hora e
                24 horas, com a notificação LGPD pronta, e audita a sua rede com um agente que só corrige com o seu
                OK.
              </p>

              {notice && (
                <div
                  role={notice.tone === "danger" ? "alert" : "status"}
                  className={cn(
                    "flex w-fit max-w-xl items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground ring-1",
                    notice.tone === "danger" ? "bg-danger/10 ring-danger/35" : "bg-warning/10 ring-warning/35",
                  )}
                >
                  {notice.tone === "danger" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  ) : (
                    <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  )}
                  <span>
                    <span className={cn("font-semibold", notice.tone === "danger" ? "text-danger" : "text-warning")}>
                      {notice.title}.
                    </span>{" "}
                    {notice.text}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <DemoButton variant="hero" />
                <a
                  href="#o-que-faz"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "h-12 rounded-xl px-5 text-[15px]",
                  })}
                >
                  Ver como funciona
                  <ArrowDown data-icon="inline-end" aria-hidden />
                </a>
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="size-4 shrink-0 text-success" aria-hidden />
                  Persona fictícia, sem cadastro e sem nada para instalar.
                </p>
                <ApiStatus health={health} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 max-lg:order-1">
              <HeroEye className="max-w-[196px] sm:max-w-[340px] lg:max-w-[500px]" />
              <a
                href="#tres-fases"
                className="group hidden items-center sm:flex gap-2 rounded-md px-2 py-1 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="text-rubi">T+15MIN · T+1H · T+24H</span>
                <span aria-hidden>·</span>
                <span className="underline-offset-4 group-hover:underline">três prazos</span>
                <ArrowDown className="size-3" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        {/* O que faz */}
        <section id="o-que-faz" className="scroll-mt-20 pt-12 pb-20 sm:pt-16 sm:pb-24" aria-labelledby="o-que-faz-titulo">
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6">
            <SectionHeading id="o-que-faz-titulo" eyebrow="O que o Olharium faz" title="Três frentes, um só painel.">
              Do alerta ao que fazer, em linguagem simples. Cada resposta mostra de onde veio a informação.
            </SectionHeading>

            <ol className="grid gap-4 lg:grid-cols-3">
              {PILLARS.map(({ icon: Icon, screen, title, description, points, source }, index) => (
                <li
                  key={title}
                  className="flex flex-col gap-5 rounded-xl bg-card p-6 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_16px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.07]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="eyebrow text-muted-foreground">{screen}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums" aria-hidden>
                      0{index + 1}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg leading-snug font-semibold tracking-tight">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm leading-snug">
                        <Check className="mt-0.5 size-4 shrink-0 text-rubi" aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto border-t border-white/[0.06] pt-4 font-mono text-[11px] tracking-wide text-muted-foreground">
                    {"href" in source && source.href ? (
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm text-telemetry underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {source.label}
                        <ArrowUpRight className="size-3" aria-hidden />
                        <span className="sr-only">(abre em nova aba)</span>
                      </a>
                    ) : (
                      source.label
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Três fases */}
        <section
          id="tres-fases"
          className="scroll-mt-20 border-y border-white/[0.06] bg-ink/60 py-20 sm:py-24"
          aria-labelledby="tres-fases-titulo"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div className="flex flex-col gap-8">
              <SectionHeading id="tres-fases-titulo" eyebrow="T+15MIN · T+1H · T+24H" title="Três fragmentos, três prazos.">
                Os três fragmentos que giram em volta da pupila do Olharium são as três fases da resposta. Eles giram no
                sentido horário, como o tempo, e cada um aponta para o seu prazo no anel de fora.
              </SectionHeading>
              <PhaseOrbit className="mx-auto w-full max-w-[320px] lg:mx-0 lg:max-w-[400px]" />
            </div>

            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-3">
                {PHASES.map((phase) => (
                  <li
                    key={phase.code}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-xl bg-card p-5 ring-1 ring-white/[0.07] sm:p-6"
                  >
                    <span className="flex size-11 items-center justify-center rounded-lg bg-background ring-1 ring-white/[0.08]">
                      <Fragment angle={phase.angle} className="size-9" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="font-mono text-sm font-semibold tracking-wide text-rubi">{phase.code}</span>
                        <span className="eyebrow text-muted-foreground">{phase.when}</span>
                      </p>
                      <h3 className="text-lg leading-snug font-semibold tracking-tight">{phase.title}</h3>
                    </div>
                    <ul className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:col-start-2" aria-label="Exemplos de passos">
                      {phase.steps.map((step) => (
                        <li
                          key={step}
                          className="rounded-md bg-muted px-2 py-1 text-[13px] leading-snug text-foreground ring-1 ring-white/[0.08]"
                        >
                          {step}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>

              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 rounded-xl border border-dashed border-white/15 p-5 sm:p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-background ring-1 ring-white/[0.08]">
                  <Clock className="size-5 text-warning" aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-sm font-semibold tracking-wide text-warning">+15 DIAS</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">A empresa não respondeu?</span> A LGPD dá 15 dias (art.
                    19, II). Depois disso, o Olharium deixa a petição à ANPD pronta para você enviar.
                  </p>
                </div>
              </div>

              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                Os passos mudam conforme o caso: vazamento, golpe do Pix, celular roubado, conta invadida. Orientação
                informativa, não é assessoria jurídica.
              </p>
            </div>
          </div>
        </section>

        {/* Como protegemos você */}
        <section id="protecao" className="scroll-mt-20 py-20 sm:py-24" aria-labelledby="protecao-titulo">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:gap-16">
            <SectionHeading
              id="protecao-titulo"
              eyebrow="Como protegemos você"
              title="Feito para proteger você, não para expor ninguém."
              className="lg:sticky lg:top-28 lg:self-start"
            />
            <ul className="grid gap-px overflow-hidden rounded-xl bg-white/[0.07] ring-1 ring-white/[0.07] sm:grid-cols-2">
              {SAFEGUARDS.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex flex-col gap-3 bg-card p-6">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <h3 className="font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Real ou fictício */}
        <section id="na-demo" className="scroll-mt-20 pb-20 sm:pb-24" aria-labelledby="na-demo-titulo">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6">
            <SectionHeading id="na-demo-titulo" eyebrow="Na demo" title="O que é real e o que é fictício.">
              A demo abre o painel de uma persona inventada, sem cadastro. Você vê o produto inteiro sem expor ninguém.
            </SectionHeading>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-white/[0.07]">
                <span className="flex w-fit items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-warning uppercase ring-1 ring-warning/30">
                  <FlaskConical className="size-3" aria-hidden />
                  Fictício
                </span>
                <ul className="flex flex-col gap-3">
                  {DEMO_FICTIONAL.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-snug">
                      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-white/[0.07]">
                <span className="flex w-fit items-center gap-1.5 rounded-full bg-info/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-info uppercase ring-1 ring-info/30">
                  <BadgeCheck className="size-3" aria-hidden />
                  Real e público
                </span>
                <ul className="flex flex-col gap-3">
                  {DEMO_REAL.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-snug">
                      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Chamada final */}
            <div className="relative isolate flex flex-col gap-6 overflow-hidden rounded-2xl bg-card px-6 py-10 ring-1 ring-white/[0.08] sm:px-10 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="absolute inset-0 -z-10 bg-[radial-gradient(circle_380px_at_100%_0%,color-mix(in_oklab,var(--crimson)_16%,transparent),transparent)]"
                aria-hidden
              />
              <div className="flex max-w-xl flex-col gap-2">
                <span className="eyebrow flex items-center gap-2 text-muted-foreground">
                  <Radar className="size-3.5 text-rubi" aria-hidden />
                  Pronto em um clique
                </span>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Veja o Olharium funcionando.</h2>
                <p className="text-muted-foreground">
                  Painel, vazamentos, plano de resposta com a notificação LGPD e auditoria de rede. A sessão da demo dura
                  2 horas.
                </p>
              </div>
              <DemoButton variant="plain" className="shrink-0" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3">
            <Logo height={24} />
            <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Vigia por você. Responde com você.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground md:items-end md:text-right">
            <p>As orientações são informativas e não são assessoria jurídica.</p>
            <p>
              Vazamentos reais:{" "}
              <a
                href={HIBP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-telemetry underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Have I Been Pwned<span className="sr-only"> (abre em nova aba)</span>
              </a>
              , licença CC BY 4.0.
            </p>
            <p className="font-mono text-[11px] tracking-wider uppercase">Hack Brasil 2026 · Cibersegurança</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
