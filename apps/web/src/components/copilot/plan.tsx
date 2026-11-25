import { ArrowUpRight, CheckCircle2, FileText } from "lucide-react";
import { toggleStep } from "@/app/painel/copiloto/actions";
import type { IncidentView, PlanPhase, PlanStep } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { PHASE_META } from "./phase-style";
import { StepToggle } from "./step-toggle";
import { StateAlert } from "./status";

type Plan = IncidentView["plan"];

/** Primeiro passo ainda não feito, na ordem das fases. */
export function nextStepOf(plan: Plan): { phase: PlanPhase; step: PlanStep } | null {
  for (const phase of plan.phases) {
    const step = phase.steps.find((item) => !item.done);
    if (step) return { phase, step };
  }
  return null;
}

export function stepAnchor(stepId: string): string {
  return `passo-${stepId}`;
}

/**
 * Medidor de passos: um segmento por passo. O avanço usa a luz da marca (Neon Rubi); só o plano
 * concluído vira estado de sucesso, com ícone e palavra.
 */
export function ProgressMeter({
  done,
  total,
  className,
  showLabel = true,
}: {
  done: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}) {
  const complete = total > 0 && done >= total;
  const segments = Math.max(total, 1);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} de ${total} passos feitos`}
        aria-label="Passos concluídos"
        className="flex h-1.5 min-w-0 flex-1 gap-[3px]"
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-full min-w-0 flex-1 rounded-[2px] transition-colors",
              index < done
                ? complete
                  ? "bg-success"
                  : "bg-rubi shadow-[0_0_8px_-1px_color-mix(in_oklab,var(--rubi)_70%,transparent)]"
                : "bg-white/[0.09]",
            )}
          />
        ))}
      </div>
      {showLabel && (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums",
            complete ? "text-success" : "text-muted-foreground",
          )}
        >
          {complete && <CheckCircle2 className="size-3" aria-hidden />}
          {complete ? "Concluído" : `${done}/${total}`}
        </span>
      )}
    </div>
  );
}

const LINK_CHIP =
  "inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-medium ring-1 ring-white/10 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60";

function StepItem({
  incident,
  step,
  isNext,
}: {
  incident: IncidentView;
  step: PlanStep;
  isNext: boolean;
}) {
  return (
    <li id={stepAnchor(step.id)} className="flex scroll-mt-24 gap-3 py-4 first:pt-1 last:pb-1">
      <StepToggle action={toggleStep.bind(null, incident.id, step.id, !step.done)} done={step.done} title={step.title} />
      <div className="flex min-w-0 flex-col gap-1">
        {isNext && <span className="eyebrow text-rubi">Próximo passo</span>}
        <span
          className={cn(
            "text-sm leading-snug font-medium",
            step.done && "text-muted-foreground line-through decoration-muted-foreground/60",
          )}
        >
          {step.title}
          {step.done && <span className="sr-only"> (feito)</span>}
        </span>
        <p className={cn("text-[13px] leading-relaxed text-muted-foreground", step.done && "opacity-70")}>
          {step.detail}
        </p>
        {(step.links.length > 0 || (step.lgpd && incident.lgpd)) && (
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {step.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(LINK_CHIP, "text-telemetry hover:ring-telemetry/40")}
              >
                {link.label}
                <ArrowUpRight className="size-3" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            ))}
            {step.lgpd && incident.lgpd && (
              <a href="#lgpd" className={cn(LINK_CHIP, "text-foreground hover:ring-white/25")}>
                <FileText className="size-3 text-rubi" aria-hidden />
                Ver a notificação LGPD
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PhaseColumn({
  incident,
  phase,
  nextStepId,
}: {
  incident: IncidentView;
  phase: PlanPhase;
  nextStepId: string | null;
}) {
  const meta = PHASE_META[phase.key];
  const done = phase.steps.filter((step) => step.done).length;
  const total = phase.steps.length;
  const complete = total > 0 && done === total;
  const active = phase.steps.some((step) => step.id === nextStepId);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <li className="flex min-w-0 flex-col gap-3" aria-current={active ? "step" : undefined}>
      {/* Trilho da linha do tempo: no desktop, os três trilhos ficam lado a lado e formam uma linha só. */}
      <div className="flex items-center gap-2.5 px-1">
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rotate-45 rounded-[2px] ring-1",
            complete && "bg-rubi ring-rubi shadow-[0_0_10px_0_color-mix(in_oklab,var(--rubi)_70%,transparent)]",
            !complete && active && "bg-rubi/25 ring-rubi",
            !complete && !active && "bg-ink ring-white/25",
          )}
        />
        <span
          className={cn(
            "font-mono text-xs font-semibold tracking-[0.14em]",
            active ? "text-rubi" : complete ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {meta.tag}
        </span>
        <span aria-hidden className="relative h-0.5 min-w-6 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-crimson-deep via-crimson to-rubi"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {done}/{total}
          <span className="sr-only"> passos feitos nesta fase</span>
        </span>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col rounded-xl bg-card shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_16px_40px_-24px_rgb(0_0_0/0.9)] ring-1 transition-shadow",
          active ? "ring-rubi/30" : "ring-white/[0.07]",
        )}
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] px-4 pt-4 pb-3 sm:px-5">
          <h3 className="font-semibold tracking-tight">{phase.label}</h3>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{phase.window}</span>
        </div>
        <ul className="flex flex-col divide-y divide-white/[0.06] px-4 py-3 sm:px-5">
          {phase.steps.map((step) => (
            <StepItem key={step.id} incident={incident} step={step} isNext={step.id === nextStepId} />
          ))}
        </ul>
      </div>
    </li>
  );
}

export function ResponsePlan({ incident }: { incident: IncidentView }) {
  const { plan } = incident;
  const next = nextStepOf(plan);
  const complete = plan.progress.total > 0 && plan.progress.done >= plan.progress.total;

  return (
    <section aria-labelledby="plano" className="flex scroll-mt-20 flex-col gap-5" id="plano-de-resposta">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-rubi">Plano de resposta</span>
          <h2 id="plano" className="text-xl font-semibold tracking-tight sm:text-2xl">
            Três prazos. Faça na ordem.
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            O que fazer em até 15 minutos, na primeira hora e nas próximas 24 horas. Marque cada passo quando terminar:
            o progresso fica salvo neste incidente.
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          <span className="text-base font-semibold text-foreground">{plan.progress.done}</span> de{" "}
          {plan.progress.total} passos feitos
        </span>
      </div>

      {complete && (
        <StateAlert tone="success" label="Plano concluído." role="status">
          Você fez todos os passos. Guarde os protocolos e comprovantes que juntou no caminho.
        </StateAlert>
      )}

      <ol className="grid gap-6 lg:grid-cols-3 lg:gap-4" aria-label="Fases do plano">
        {plan.phases.map((phase) => (
          <PhaseColumn key={phase.key} incident={incident} phase={phase} nextStepId={next?.step.id ?? null} />
        ))}
      </ol>
    </section>
  );
}
