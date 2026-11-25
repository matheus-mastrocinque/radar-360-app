import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Database, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import type { ActionStep } from "./model";
import { Panel, TONE_RAIL, TONE_TEXT } from "./panel";

/** Fila de ação: o que fazer agora, em ordem de peso no score. Cada item abre o detalhe na gaveta. */
export function ActionQueue({ steps, className }: { steps: ActionStep[]; className?: string }) {
  return (
    <Panel
      id="fila-titulo"
      index="03"
      label="Fila de ação"
      className={className}
      aside={
        <span className="font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase tabular-nums">
          {steps.length} {steps.length === 1 ? "ação" : "ações"}
        </span>
      }
    >
      {steps.length === 0 ? (
        <p className="m-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm ring-1 ring-success/30">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          Nenhuma ação urgente. O monitoramento continua ativo.
        </p>
      ) : (
        <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {steps.map((step, index) => {
            const KindIcon = step.kind === "leak" ? Database : Wifi;
            return (
              <li key={step.key} className="border-b border-white/[0.05] last:border-b-0">
                <InspectTrigger
                  target={step.target}
                  className="group relative flex w-full gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className={cn("absolute inset-y-3 left-0 w-[2px] rounded-r", TONE_RAIL[step.tone])} aria-hidden />
                  <span className="mt-px font-mono text-[11px] font-semibold text-muted-foreground tabular-nums" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm leading-snug font-medium">
                        <span className="sr-only">Ação {index + 1}: </span>
                        {step.title}
                      </span>
                      <span
                        className={cn("shrink-0 font-mono text-xs font-semibold tabular-nums", TONE_TEXT[step.tone])}
                        title="Quanto este item pesa no seu score hoje"
                      >
                        +{step.points}
                        <span className="sr-only"> pontos no score</span>
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                      <KindIcon className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{step.source}</span>
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-relaxed text-foreground/75">{step.description}</span>
                  </span>
                  <ChevronRight
                    className="mt-0.5 size-4 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                </InspectTrigger>
              </li>
            );
          })}
        </ol>
      )}
      <Link
        href="/painel/copiloto"
        className="group flex shrink-0 items-center gap-3 border-t border-white/[0.06] bg-crimson/[0.06] px-4 py-3 transition-colors outline-none hover:bg-crimson/[0.12] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">Copiloto: plano completo e notificação LGPD</span>
          <span className="font-mono text-[10.5px] tracking-wider text-rubi">T+15MIN · T+1H · T+24H</span>
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </Link>
    </Panel>
  );
}
