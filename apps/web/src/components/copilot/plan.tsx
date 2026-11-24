import { ArrowUpRight, Clock, FileText } from "lucide-react";
import { toggleStep } from "@/app/painel/copiloto/actions";
import type { IncidentView } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { PHASE_STYLE } from "./phase-style";
import { StepToggle } from "./step-toggle";

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/5 ring-inset"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Passos concluídos"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {done} de {total}
      </span>
    </div>
  );
}

export function ResponsePlan({ incident }: { incident: IncidentView }) {
  return (
    <section aria-labelledby="plano" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-brand">Passo a passo</span>
          <h2 id="plano" className="text-xl font-semibold tracking-tight">
            Plano de resposta
          </h2>
          <p className="text-sm text-muted-foreground">Faça na ordem. Marque cada passo quando terminar.</p>
        </div>
        <ProgressBar
          done={incident.plan.progress.done}
          total={incident.plan.progress.total}
          className="w-full rounded-lg bg-card px-3 py-2 shadow-xs ring-1 ring-border sm:w-72"
        />
      </div>

      <ol className="grid gap-4 lg:grid-cols-3">
        {incident.plan.phases.map((phase, index) => {
          const style = PHASE_STYLE[phase.key];
          const done = phase.steps.filter((step) => step.done).length;
          return (
            <li
              key={phase.key}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_0_oklch(0.2_0.03_262/0.04),0_2px_12px_-4px_oklch(0.2_0.03_262/0.06)] ring-1 ring-foreground/[0.07]"
            >
              <div className={cn("h-1", style.rail)} aria-hidden />
              <div className="flex items-start justify-between gap-3 border-b px-4 pt-4 pb-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-ink font-mono text-signal">
                    <span className="text-[9px] leading-none text-ink-muted">fase</span>
                    <span className="text-sm leading-none font-semibold">{index + 1}</span>
                  </span>
                  <div className="flex flex-col">
                    <h3 className="font-semibold tracking-tight">{phase.label}</h3>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {phase.window}
                    </span>
                  </div>
                </div>
                <span
                  className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset", style.badge)}
                >
                  {done}/{phase.steps.length}
                </span>
              </div>
              <ul className="flex flex-col divide-y px-4 sm:px-5">
                {phase.steps.map((step) => (
                  <li key={step.id} className="flex gap-3 py-3.5">
                    <StepToggle
                      action={toggleStep.bind(null, incident.id, step.id, !step.done)}
                      done={step.done}
                      title={step.title}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          step.done && "text-muted-foreground line-through decoration-muted-foreground/50",
                        )}
                      >
                        {step.title}
                      </span>
                      <p className={cn("text-sm leading-relaxed text-muted-foreground", step.done && "opacity-75")}>
                        {step.detail}
                      </p>
                      {(step.links.length > 0 || (step.lgpd && incident.lgpd)) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {step.links.map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-colors outline-none hover:bg-accent/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {link.label}
                              <ArrowUpRight className="size-3" aria-hidden />
                            </a>
                          ))}
                          {step.lgpd && incident.lgpd && (
                            <a
                              href="#lgpd"
                              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-colors outline-none hover:bg-accent/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <FileText className="size-3" aria-hidden />
                              Ver a notificação LGPD
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
