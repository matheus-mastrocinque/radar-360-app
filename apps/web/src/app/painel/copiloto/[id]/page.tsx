import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CalendarClock, ChevronRight, Scale, ShieldCheck } from "lucide-react";
import { BreachFacts, ReportedBreachFacts } from "@/components/copilot/facts";
import { originOf, summaryOf, TYPE_ICON } from "@/components/copilot/incident-meta";
import { LgpdPanel } from "@/components/copilot/lgpd-panel";
import { MedKit } from "@/components/copilot/med-kit";
import { PHASE_META } from "@/components/copilot/phase-style";
import { PlanArrival } from "@/components/copilot/plan-arrival";
import { nextStepOf, ProgressMeter, ResponsePlan, stepAnchor } from "@/components/copilot/plan";
import { LgpdBadge, StateAlert } from "@/components/copilot/status";
import { ErrorState } from "@/components/shell/error-state";
import { fetchIncident, type IncidentView } from "@/lib/incidents";
import { formatDate } from "@/lib/format";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Plano de resposta · Olharium" };

const PANEL_LINK =
  "group flex items-center gap-3 rounded-lg bg-ink px-3 py-2.5 ring-1 ring-white/[0.07] transition-colors outline-none hover:bg-muted hover:ring-white/15 focus-visible:ring-3 focus-visible:ring-ring/60";

/** O único destaque de HUD da tela: o instrumento com o progresso e o próximo passo. */
function PlanInstrument({ incident }: { incident: IncidentView }) {
  const { plan } = incident;
  const next = nextStepOf(plan);
  const complete = plan.progress.total > 0 && plan.progress.done >= plan.progress.total;

  return (
    <div className="hud-corners p-2 [--hud-color:var(--rubi)] [--hud-len:16px]">
      <div className="bg-grid flex flex-col gap-4 rounded-xl bg-card p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_16px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.07] sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <span className="eyebrow text-muted-foreground">Progresso do plano</span>
          <span className="font-mono leading-none tabular-nums" aria-hidden>
            <span className={cn("text-4xl font-semibold", complete ? "text-success" : "text-glow text-rubi")}>
              {plan.progress.done}
            </span>
            <span className="text-lg text-muted-foreground">/{plan.progress.total}</span>
          </span>
        </div>
        <ProgressMeter done={plan.progress.done} total={plan.progress.total} showLabel={false} />
        <ul className="grid grid-cols-3 gap-2" aria-label="Passos feitos por fase">
          {plan.phases.map((phase) => {
            const done = phase.steps.filter((step) => step.done).length;
            return (
              <li key={phase.key} className="flex flex-col gap-0.5 font-mono">
                <span className="text-[10px] tracking-[0.14em] text-muted-foreground">{PHASE_META[phase.key].tag}</span>
                <span className="text-sm text-foreground tabular-nums">
                  {done}/{phase.steps.length}
                </span>
              </li>
            );
          })}
        </ul>

        {next ? (
          <a href={`#${stepAnchor(next.step.id)}`} className={PANEL_LINK}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="eyebrow text-rubi">
                Próximo passo · {PHASE_META[next.phase.key].tag}
              </span>
              <span className="text-sm leading-snug font-medium text-foreground">{next.step.title}</span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </a>
        ) : (
          complete && (
            <StateAlert tone="success" label="Concluído.">
              Todos os passos feitos.
            </StateAlert>
          )
        )}

        {incident.lgpd && (
          <a href="#lgpd" className={PANEL_LINK}>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="eyebrow text-muted-foreground">Notificação LGPD</span>
              <LgpdBadge status={incident.lgpd.timeline.status} />
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
            <span className="sr-only">Ir para a notificação LGPD</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) redirect("/");

  const { id } = await params;
  const result = await fetchIncident(token, id);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");
  if (!result.ok && result.reason === "not_found") notFound();

  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar o plano" retryHref={`/painel/copiloto/${id}`} />;
  }

  const incident = result.data;
  const origin = originOf(incident);
  const OriginIcon = origin.icon;
  const TypeIcon = TYPE_ICON[incident.type];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10">
      <PlanArrival />
      <div className="flex flex-col gap-5">
        <nav aria-label="Trilha" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/painel/copiloto"
            className="rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            Copiloto
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="truncate text-foreground" aria-current="page">
            Plano de resposta
          </span>
        </nav>

        <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-x-8">
          <header className="flex min-w-0 flex-col gap-4 lg:col-span-8 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-white/10">
                <TypeIcon className="size-3.5 text-rubi" aria-hidden />
                {incident.typeLabel}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <OriginIcon className="size-3.5" aria-hidden />
                {origin.label}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden />
                Aberto em{" "}
                <time dateTime={incident.createdAt} className="font-mono">
                  {formatDate(incident.createdAt)}
                </time>
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{incident.title}</h1>
            <p className="max-w-3xl leading-relaxed text-muted-foreground">
              {summaryOf(incident)}
            </p>

            {incident.flags.length > 0 && (
              <div className="flex flex-col gap-2">
                <span id="sinais" className="eyebrow text-muted-foreground">
                  O que o seu relato indica
                </span>
                <ul className="flex flex-wrap gap-1.5" aria-labelledby="sinais">
                  {incident.flags.map((flag) => (
                    <li
                      key={flag.key}
                      className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-white/10"
                    >
                      <span className="size-1.5 shrink-0 rotate-45 bg-rubi" aria-hidden />
                      {flag.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {incident.narrative && (
              <details className="group max-w-3xl text-sm">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs font-medium text-foreground/80 select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
                  Seu relato (sem dados pessoais)
                </summary>
                <div className="mt-2 flex flex-col gap-2 rounded-lg bg-ink p-3.5 ring-1 ring-white/[0.07]">
                  <p className="leading-relaxed whitespace-pre-wrap text-foreground/85">{incident.narrative}</p>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-success" aria-hidden />
                    CPF, cartão, telefone, e-mail e chave Pix foram removidos antes de salvar.
                  </span>
                </div>
              </details>
            )}
          </header>

          {/* No celular, o resumo do plano vem logo depois do título; no desktop, fica ao lado do título e dos fatos. */}
          <aside
            aria-label="Resumo do plano"
            className="min-w-0 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1"
          >
            <PlanInstrument incident={incident} />
          </aside>

          {(incident.breach || incident.reportedBreach) && (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1">
              {incident.breach && <BreachFacts breach={incident.breach} />}
              {incident.reportedBreach && <ReportedBreachFacts breach={incident.reportedBreach} />}
            </div>
          )}
        </div>
      </div>

      <ResponsePlan incident={incident} />

      {incident.type === "PIX_SCAM" && <MedKit />}

      {incident.lgpd &&<LgpdPanel incident={incident} lgpd={incident.lgpd} />}

      <p className="flex items-start gap-2.5 rounded-lg bg-ink px-4 py-3 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/[0.06]">
        <Scale className="mt-px size-3.5 shrink-0 text-rubi" aria-hidden />
        <span>
          <span className="font-mono tracking-wider text-foreground uppercase">Olharium</span> · {incident.disclaimer}
        </span>
      </p>
    </main>
  );
}
