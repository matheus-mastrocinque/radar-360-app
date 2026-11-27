import { ArrowUpRight } from "lucide-react";
import { ComponentBar, ScoreGauge } from "@/components/dashboard/score-card";
import { LEVEL_STYLE } from "@/components/dashboard/styles";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import { Panel } from "./panel";

/*
 * Score de exposição, compacto: medidor, nível em texto e de onde vêm os pontos. As faixas e a conta
 * completa ficam na gaveta ("Fórmula"). O medidor é a versão calma; o HUD da tela é o mapa.
 */
export function ScorePanel({ score, className }: { score: Dashboard["score"]; className?: string }) {
  const style = LEVEL_STYLE[score.level];
  const LevelIcon = style.icon;

  return (
    <Panel
      id="score-titulo"
      index="01"
      label="Score de exposição"
      className={className}
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
      <div className="flex items-center gap-4 px-4 py-3">
        <p className="sr-only">
          Seu score é {score.value} de {score.max}: {style.label.toLowerCase()}. Quanto maior, mais exposto.
        </p>
        <div className="relative isolate w-[116px] shrink-0">
          <ScoreGauge score={score} variant="quiet" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase ring-1 ring-inset",
                style.badge,
              )}
              aria-hidden
            >
              <LevelIcon className="size-3.5" />
              {style.label}
            </span>
            <span className="text-xs text-muted-foreground">De 0 a 100: quanto maior, mais exposto.</span>
          </div>
          <div className="flex flex-col gap-2">
            <ComponentBar label="Vazamentos" points={score.leaks.points} cap={score.leaks.cap} />
            <ComponentBar label="Rede" points={score.network.points} cap={score.network.cap} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
