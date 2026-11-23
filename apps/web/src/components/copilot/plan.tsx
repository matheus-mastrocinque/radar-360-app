import { ArrowUpRight, Clock, FileText } from "lucide-react";
import { toggleStep } from "@/app/painel/copiloto/actions";
import type { IncidentView, PlanPhase } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { StepToggle } from "./step-toggle";

const PHASE_ACCENT: Record<PlanPhase["key"], string> = {
  now: "bg-red-600",
  hour: "bg-amber-500",
  day: "bg-sky-600",
};

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Passos concluídos"
      >
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {done} de {total}
      </span>
    </div>
  );
}

export function ResponsePlan({ incident }: { incident: IncidentView }) {
  return (
    <section aria-labelledby="plano" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="plano" className="text-lg font-semibold tracking-tight">
            Plano de resposta
          </h2>
          <p className="text-sm text-muted-foreground">Faça na ordem. Marque cada passo quando terminar.</p>
        </div>
        <ProgressBar
          done={incident.plan.progress.done}
          total={incident.plan.progress.total}
          className="w-full sm:w-64"
        />
      </div>

      <ol className="grid gap-4 lg:grid-cols-3">
        {incident.plan.phases.map((phase) => (
          <li key={phase.key} className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
            <div className={cn("h-1", PHASE_ACCENT[phase.key])} aria-hidden />
            <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2">
              <h3 className="font-semibold">{phase.label}</h3>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" aria-hidden />
                {phase.window}
              </span>
            </div>
            <ul className="flex flex-col divide-y px-4">
              {phase.steps.map((step) => (
                <li key={step.id} className="flex gap-3 py-3">
                  <StepToggle
                    action={toggleStep.bind(null, incident.id, step.id, !step.done)}
                    done={step.done}
                    title={step.title}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                      {step.title}
                    </span>
                    <p className="text-sm text-muted-foreground">{step.detail}</p>
                    {(step.links.length > 0 || (step.lgpd && incident.lgpd)) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                        {step.links.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs font-medium text-sky-700 underline-offset-4 hover:underline"
                          >
                            {link.label}
                            <ArrowUpRight className="size-3" aria-hidden />
                          </a>
                        ))}
                        {step.lgpd && incident.lgpd && (
                          <a
                            href="#lgpd"
                            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 underline-offset-4 hover:underline"
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
        ))}
      </ol>
    </section>
  );
}
