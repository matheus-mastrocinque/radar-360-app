import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  EyeOff,
  Network,
  Scale,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import { enterDemo } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { RadarVisual } from "@/components/landing/radar-visual";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { getApiHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PILLARS = [
  {
    icon: ShieldAlert,
    title: "Monitoramento contínuo",
    description:
      "Verificamos seu e-mail, CPF e telefone em vazamentos e avisamos só quando surge um risco novo. Guardamos apenas uma assinatura criptográfica dos seus dados, nunca o dado em si.",
    tags: ["E-mail", "CPF", "Telefone"],
  },
  {
    icon: Scale,
    title: "Plano de ação com LGPD",
    description:
      "Conte o que aconteceu ou abra um alerta: você recebe o que fazer em 15 minutos, 1 hora e 24 horas, e a notificação pronta para a empresa responsável.",
    tags: ["15 min", "1 h", "24 h", "LGPD"],
  },
  {
    icon: Wifi,
    title: "Auditoria da sua rede",
    description:
      "Um agente leve no seu computador mostra os aparelhos vulneráveis da sua casa e, em Wi-Fi público, o que o seu próprio computador está expondo.",
    tags: ["Rede de casa", "Wi-Fi público"],
  },
];

const PRINCIPLES = [
  {
    icon: EyeOff,
    title: "Nunca mostramos o dado vazado",
    description: "Só a fonte, a data e as categorias expostas. Assim a ferramenta não serve para expor ninguém.",
  },
  {
    icon: BadgeCheck,
    title: "Só dados verificados como seus",
    description: "Monitoramos apenas o e-mail, o CPF e o telefone confirmados como seus, guardados como HMAC.",
  },
  {
    icon: Network,
    title: "Scanner só na sua rede",
    description: "A varredura da casa pede o seu consentimento e nunca tenta senhas nem invade aparelhos.",
  },
  {
    icon: Scale,
    title: "A IA não inventa a lei",
    description: "Artigos da LGPD e links oficiais vêm de tabelas revisadas. A IA só identifica o tipo de incidente.",
  },
];

const FACTS = [
  { value: "15 min a 24 h", label: "Plano de resposta em três tempos" },
  { value: "15 dias", label: "Prazo da empresa antes da petição à ANPD" },
  { value: "0 a 100", label: "Score com fórmula pública, sem IA" },
  { value: "HMAC-SHA256", label: "Seus dados guardados só como assinatura" },
];

const NOTICES: Record<string, string> = {
  demo: "Não foi possível abrir a demo agora. Tente de novo em alguns segundos.",
  expirada: "Sua sessão expirou. Entre de novo para continuar.",
};

function DemoButton({ className }: { className?: string }) {
  return (
    <form action={enterDemo}>
      <SubmitButton
        size="lg"
        pendingText="Abrindo a demo..."
        className={cn(
          "h-12 rounded-xl bg-signal px-6 text-[15px] font-semibold text-ink hover:bg-signal/85",
          "shadow-[0_0_0_1px_oklch(1_0_0/0.15),0_12px_40px_-10px_oklch(0.86_0.13_188/0.65)]",
          "focus-visible:ring-signal/50",
          className,
        )}
      >
        Entrar como demo
        <ArrowRight data-icon="inline-end" aria-hidden />
      </SubmitButton>
    </form>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sessao?: string }>;
}) {
  const params = await searchParams;
  const notice = NOTICES[params.erro ?? ""] ?? NOTICES[params.sessao ?? ""];
  const health = await getApiHealth();
  const apiOk = health.online && health.database === "ok";

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Logo tone="dark" />
          <div className="flex items-center gap-4">
            <Link
              href="#como-funciona"
              className="hidden text-sm text-white/70 transition-colors hover:text-white sm:inline"
            >
              Como funciona
            </Link>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                apiOk
                  ? "bg-emerald-400/10 text-emerald-200 ring-emerald-300/25"
                  : "bg-red-400/10 text-red-200 ring-red-300/30",
              )}
            >
              <span className="relative flex size-1.5">
                {apiOk && (
                  <span className="absolute inline-flex size-full rounded-full bg-emerald-300 opacity-75 motion-safe:animate-ping" />
                )}
                <span
                  className={cn("relative inline-flex size-1.5 rounded-full", apiOk ? "bg-emerald-300" : "bg-red-300")}
                />
              </span>
              {apiOk ? "API online" : health.online ? "API sem banco" : "API offline"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink pt-[76px] text-ink-foreground" aria-labelledby="hero-titulo">
        <div
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_80%_70%_at_70%_30%,black,transparent)]"
          aria-hidden
        />
        <div
          className="absolute -top-48 -right-40 -z-10 size-[640px] rounded-full bg-signal/10 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-64 -left-40 -z-10 size-[520px] rounded-full bg-brand/20 blur-3xl"
          aria-hidden
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          <div className="grid items-center gap-12 pt-10 pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-6 lg:pt-14 lg:pb-20">
            <div className="flex flex-col gap-7">
              <span className="flex w-fit items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/75 ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-signal" aria-hidden />
                Protótipo · Hack Brasil 2026
              </span>
              <h1 id="hero-titulo" className="text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-white sm:text-6xl lg:text-[3.65rem]">
                Seus dados vazaram.{" "}
                <span className="block font-display text-[1.1em] font-normal tracking-[-0.01em] text-signal italic">
                  Saiba o que fazer agora.
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-ink-muted">
                O Radar360 monitora vazamentos dos seus dados, monta um plano de ação com base na LGPD e mostra o que a
                sua rede e o seu computador deixam exposto.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <DemoButton className="w-full sm:w-auto" />
                <Link
                  href="#como-funciona"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className:
                      "h-12 rounded-xl border-white/15 bg-white/5 px-5 text-[15px] text-white hover:bg-white/10 hover:text-white",
                  })}
                >
                  Como funciona
                </Link>
              </div>
              {notice && (
                <p
                  role="status"
                  className="flex w-fit items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-300/30"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {notice}
                </p>
              )}
              <p className="flex items-start gap-2 text-sm text-white/60">
                <Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                Sem cadastro: a demo abre o painel de uma persona fictícia, com vazamentos e redes simulados.
              </p>
            </div>

            <RadarVisual className="max-w-[340px] sm:max-w-[440px] lg:max-w-[480px]" />
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-2xl bg-white/10 sm:grid-cols-4">
            {FACTS.map((fact) => (
              <div key={fact.value} className="flex flex-col gap-1 bg-ink/95 px-4 py-5 sm:px-5">
                <dt className="font-mono text-sm font-medium text-white sm:text-[15px]">{fact.value}</dt>
                <dd className="text-xs leading-snug text-white/55">{fact.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-4 py-20 sm:py-24" aria-labelledby="como-funciona-titulo">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="eyebrow text-brand">Como funciona</span>
            <h2 id="como-funciona-titulo" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Três frentes, <span className="font-display text-[1.12em] font-normal italic">um só painel.</span>
            </h2>
            <p className="text-muted-foreground">
              Do alerta ao que fazer, em linguagem simples. Cada resposta mostra de onde veio a informação.
            </p>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, description, tags }, index) => (
              <li
                key={title}
                className="group relative flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-[0_1px_2px_0_oklch(0.2_0.03_262/0.04),0_2px_12px_-4px_oklch(0.2_0.03_262/0.06)] ring-1 ring-foreground/[0.07]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-ink text-signal">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
                <ul className="mt-auto flex flex-wrap gap-1.5 border-t pt-4" aria-label="Inclui">
                  {tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Princípios */}
      <section className="border-y bg-card py-20 sm:py-24" aria-labelledby="principios-titulo">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-3">
            <span className="eyebrow text-brand">Seguro por padrão</span>
            <h2 id="principios-titulo" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Feito para proteger você,{" "}
              <span className="font-display text-[1.12em] font-normal italic">não para expor ninguém.</span>
            </h2>
          </div>
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {PRINCIPLES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground ring-1 ring-brand/10">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative isolate flex flex-col items-start gap-6 overflow-hidden rounded-3xl bg-ink px-6 py-12 text-white sm:px-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_100%_0%,black,transparent_70%)]"
              aria-hidden
            />
            <div className="flex max-w-xl flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Veja o Radar360 funcionando.</h2>
              <p className="text-ink-muted">
                Entre como a persona demo: vazamentos, auditoria de rede e o copiloto com a notificação LGPD, tudo
                fictício e pronto para explorar.
              </p>
            </div>
            <DemoButton className="w-full sm:w-auto" />
          </div>
        </div>
      </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Os dados da demo são 100% fictícios. O Radar360 não oferece assessoria jurídica.</p>
        </div>
      </footer>
    </div>
  );
}
