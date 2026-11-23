import { Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { LEVEL_BANDS, LEVEL_STYLE } from "./styles";

function ComponentBar({ label, points, cap }: { label: string; points: number; cap: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {points} <span className="text-muted-foreground">de {cap}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(points / cap) * 100}%` }} />
      </div>
    </div>
  );
}

export function ScoreCard({ score }: { score: Dashboard["score"] }) {
  const style = LEVEL_STYLE[score.level];
  const topFactors = [...score.factors].sort((a, b) => b.points - a.points).slice(0, 4);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" aria-hidden />
          Score de exposição
        </CardTitle>
        <CardDescription>Quanto maior, mais exposto você está.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex items-end gap-3">
          <span className={cn("text-6xl font-semibold leading-none tracking-tight tabular-nums", style.text)}>
            {score.value}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">/ {score.max}</span>
          <span className={cn("mb-1 ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", style.badge)}>
            {score.levelLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1.5" aria-hidden>
          <div className="relative flex h-2.5 gap-0.5">
            {LEVEL_BANDS.map((band) => (
              <div
                key={band.level}
                className={cn(
                  "h-full first:rounded-l-full last:rounded-r-full",
                  LEVEL_STYLE[band.level].bar,
                  band.level === score.level ? "opacity-100" : "opacity-25",
                )}
                style={{ width: `${band.to - band.from}%` }}
              />
            ))}
            <div
              className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-background"
              style={{ left: `${score.value}%` }}
            />
          </div>
          <div className="flex text-[11px] text-muted-foreground">
            {LEVEL_BANDS.map((band) => (
              <span key={band.level} style={{ width: `${band.to - band.from}%` }}>
                {band.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <ComponentBar label="Vazamentos" points={score.leaks.points} cap={score.leaks.cap} />
          <ComponentBar label="Rede" points={score.network.points} cap={score.network.cap} />
        </div>

        {topFactors.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-xs font-medium text-muted-foreground">O que mais pesa no seu score</span>
            <ul className="flex flex-col gap-1.5">
              {topFactors.map((factor) => (
                <li key={`${factor.group}-${factor.label}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{factor.label}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">+{factor.points}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <a href="#como-calculamos" className="mt-auto text-xs font-medium underline-offset-4 hover:underline">
          Como calculamos este número →
        </a>
      </CardContent>
    </Card>
  );
}
