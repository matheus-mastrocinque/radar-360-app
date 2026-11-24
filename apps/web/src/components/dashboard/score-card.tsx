import { ArrowDown, Gauge } from "lucide-react";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { LEVEL_BANDS, LEVEL_STYLE } from "./styles";

/** Medidor semicircular: 0 à esquerda, 100 à direita. */
const CX = 100;
const CY = 100;
const R = 82;

function point(value: number): { x: number; y: number } {
  const angle = Math.PI - (Math.min(Math.max(value, 0), 100) / 100) * Math.PI;
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

function arc(from: number, to: number): string {
  const start = point(from);
  const end = point(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function ScoreGauge({ score }: { score: Dashboard["score"] }) {
  const style = LEVEL_STYLE[score.level];
  const marker = point(score.value);
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox="0 0 200 112" className="w-full overflow-visible" aria-hidden focusable="false">
        {LEVEL_BANDS.map((band) => (
          <path
            key={band.level}
            d={arc(band.from + (band.from === 0 ? 0 : 0.9), band.to - (band.to === 100 ? 0 : 0.9))}
            className={cn("fill-none", LEVEL_STYLE[band.level].stroke)}
            strokeOpacity={band.level === score.level ? 0.35 : 0.14}
            strokeWidth={12}
          />
        ))}
        {score.value > 0 && (
          <path
            d={arc(0, score.value)}
            className={cn("fill-none", style.stroke)}
            strokeWidth={12}
            strokeLinecap="round"
          />
        )}
        <circle cx={marker.x} cy={marker.y} r={9} className="fill-ink" />
        <circle cx={marker.x} cy={marker.y} r={5} className="fill-white" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="flex items-baseline gap-1">
          <span className={cn("text-6xl leading-none font-semibold tracking-tight tabular-nums", style.onDark)}>
            {score.value}
          </span>
          <span className="text-sm text-ink-muted">/ {score.max}</span>
        </span>
      </div>
    </div>
  );
}

function ComponentBar({ label, points, cap }: { label: string; points: number; cap: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-white tabular-nums">
          {points} <span className="font-normal text-ink-muted">de {cap}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white/80" style={{ width: `${(points / cap) * 100}%` }} />
      </div>
    </div>
  );
}

export function ScoreCard({ score }: { score: Dashboard["score"] }) {
  const style = LEVEL_STYLE[score.level];
  const topFactors = [...score.factors].sort((a, b) => b.points - a.points).slice(0, 4);
  return (
    <section
      aria-labelledby="score-titulo"
      className="relative isolate flex h-full flex-col gap-5 overflow-hidden rounded-xl bg-ink p-5 text-ink-foreground shadow-[0_12px_40px_-16px_oklch(0.185_0.035_262/0.6)]"
    >
      <div
        className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_50%_20%,black,transparent_75%)]"
        aria-hidden
      />
      <div className="absolute -top-24 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-signal/10 blur-3xl" aria-hidden />

      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="score-titulo" className="flex items-center gap-2 text-base font-medium text-white">
            <Gauge className="size-4 text-signal" aria-hidden />
            Score de exposição
          </h2>
          <p className="text-sm text-ink-muted">Quanto maior, mais exposto você está.</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", style.badgeOnDark)}>
          {score.levelLabel}
        </span>
      </header>

      <ScoreGauge score={score} />

      <ul className="grid grid-cols-4 gap-1 text-center" aria-label="Faixas do score">
        {LEVEL_BANDS.map((band) => {
          const active = band.level === score.level;
          return (
            <li
              key={band.level}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px]",
                active ? "bg-white/10 text-white" : "text-ink-muted",
              )}
            >
              <span className={cn("h-1 w-5 rounded-full", LEVEL_STYLE[band.level].bar, !active && "opacity-50")} />
              <span className="font-medium">{band.label}</span>
              <span className="font-mono text-[10px] opacity-70">
                {band.from}–{band.to === 100 ? 100 : band.to - 1}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
        <ComponentBar label="Vazamentos" points={score.leaks.points} cap={score.leaks.cap} />
        <ComponentBar label="Rede" points={score.network.points} cap={score.network.cap} />
      </div>

      {topFactors.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <span className="text-xs font-medium text-ink-muted">O que mais pesa no seu score</span>
          <ul className="flex flex-col gap-1.5">
            {topFactors.map((factor) => (
              <li key={`${factor.group}-${factor.label}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-white/90">{factor.label}</span>
                <span className="font-mono text-xs text-ink-muted tabular-nums">+{factor.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href="#como-calculamos"
        className="mt-auto flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-signal underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-signal/40"
      >
        Como calculamos este número
        <ArrowDown className="size-3.5" aria-hidden />
      </a>
    </section>
  );
}
