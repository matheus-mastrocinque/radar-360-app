import { ArrowUpRight } from "lucide-react";
import { ComponentBar, ScoreGauge } from "@/components/dashboard/score-card";
import { LEVEL_BANDS, LEVEL_STYLE } from "@/components/dashboard/styles";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import { Panel } from "./panel";

/** Score de exposição: medidor, faixas e a soma das duas partes. O detalhe fica na gaveta ("Fórmula"). */
export function ScorePanel({ score, className }: { score: Dashboard["score"]; className?: string }) {
  const style = LEVEL_STYLE[score.level];

  return (
    <Panel
      id="score-titulo"
      index="01"
      label="Score de exposição"
      className={className}
      bodyClassName="gap-3.5 p-4"
      aside={
        <InspectTrigger
          target="score"
          className="flex items-center gap-1 rounded font-mono text-[10.5px] tracking-wider text-telemetry uppercase outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Fórmula
          <ArrowUpRight className="size-3" aria-hidden />
        </InspectTrigger>
      }
    >
      <p className="sr-only">
        Seu score é {score.value} de {score.max}: {style.label.toLowerCase()}. Quanto maior, mais exposto.
      </p>
      <div className="relative isolate">
        <ScoreGauge score={score} className="max-w-[196px] [--hud-len:12px]" />
      </div>

      <ol className="flex gap-1" aria-label="Faixas do score">
        {LEVEL_BANDS.map((band) => {
          const active = band.level === score.level;
          return (
            <li
              key={band.level}
              aria-current={active ? "true" : undefined}
              className={cn("flex flex-1 flex-col gap-1 text-center font-mono text-[9.5px] uppercase", active ? "text-foreground" : "text-muted-foreground/70")}
            >
              <span className={cn("h-1 rounded-full", LEVEL_STYLE[band.level].bar, !active && "opacity-30")} aria-hidden />
              {band.label}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2.5 rounded-lg bg-ink p-3 ring-1 ring-white/[0.06]">
        <ComponentBar label="Vazamentos" points={score.leaks.points} cap={score.leaks.cap} />
        <ComponentBar label="Rede" points={score.network.points} cap={score.network.cap} />
      </div>
    </Panel>
  );
}
