import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { LEVEL_BANDS, LEVEL_STYLE } from "./styles";

/*
 * Medidor do score no desenho da mira da marca: anel de graduação, faixas de nível, um anel fino
 * (a órbita) com os três fragmentos e uma varredura lenta. É o único destaque de HUD do painel.
 * As faixas e o arco usam as cores de estado (success → warning → danger), nunca o carmesim.
 */
const VIEW = 260;
const C = VIEW / 2;
const START_DEG = 135; // 0 fica embaixo, à esquerda; 100, embaixo, à direita (270° de arco)
const SWEEP_DEG = 270;
const R_BAND = 98;
const R_ORBIT = 80;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function polar(radius: number, value: number): { x: number; y: number } {
  const angle = ((START_DEG + (clamp(value) / 100) * SWEEP_DEG) * Math.PI) / 180;
  // Arredonda para 2 casas: o SVG fica menor e o HTML, estável.
  return {
    x: Math.round((C + radius * Math.cos(angle)) * 100) / 100,
    y: Math.round((C + radius * Math.sin(angle)) * 100) / 100,
  };
}

function arc(radius: number, from: number, to: number): string {
  const start = polar(radius, from);
  const end = polar(radius, to);
  const largeArc = ((to - from) / 100) * SWEEP_DEG > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const TICKS = Array.from({ length: 51 }, (_, index) => index * 2);

export function ScoreGauge({ score, className }: { score: Dashboard["score"]; className?: string }) {
  const style = LEVEL_STYLE[score.level];
  const LevelIcon = style.icon;
  const marker = polar(R_BAND, score.value);
  const zero = polar(118, 0);
  const hundred = polar(118, 100);

  return (
    <div
      className={cn(
        "hud-corners relative mx-auto aspect-square w-full max-w-[320px] [--hud-color:color-mix(in_oklab,var(--rubi)_75%,transparent)] [--hud-len:18px]",
        className,
      )}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="absolute inset-0 size-full overflow-visible" aria-hidden focusable="false">
        {/* Asas da mira no eixo horizontal */}
        <g className="stroke-rubi" strokeWidth={1.5}>
          <line x1={0} y1={C} x2={9} y2={C} />
          <line x1={VIEW - 9} y1={C} x2={VIEW} y2={C} />
        </g>
        <polygon points={`11,${C - 3.5} 16,${C} 11,${C + 3.5}`} className="fill-rubi" />
        <polygon points={`${VIEW - 11},${C - 3.5} ${VIEW - 16},${C} ${VIEW - 11},${C + 3.5}`} className="fill-rubi" />

        {/* Anel de graduação: a cada 2 pontos, marcas maiores a cada 10 */}
        {TICKS.map((value) => {
          const major = value % 10 === 0;
          const outer = polar(122, value);
          const inner = polar(major ? 111 : 116, value);
          return (
            <line
              key={value}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              strokeWidth={major ? 1.5 : 1}
              className={major ? "stroke-foreground/40" : "stroke-foreground/15"}
            />
          );
        })}
        <text x={zero.x - 2} y={zero.y + 14} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
          0
        </text>
        <text x={hundred.x + 2} y={hundred.y + 14} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
          100
        </text>

        {/* Faixas de nível (trilho) e o arco do score */}
        {LEVEL_BANDS.map((band) => (
          <path
            key={band.level}
            d={arc(R_BAND, band.from + (band.from === 0 ? 0 : 0.8), band.to - (band.to === 100 ? 0 : 0.8))}
            className={cn("fill-none", LEVEL_STYLE[band.level].stroke)}
            strokeOpacity={band.level === score.level ? 0.3 : 0.13}
            strokeWidth={9}
          />
        ))}
        {score.value > 0 && (
          <path d={arc(R_BAND, 0, score.value)} className={cn("fill-none", style.stroke)} strokeWidth={9} />
        )}

        {/* Órbita com os três fragmentos (as três fases da resposta) */}
        <circle cx={C} cy={C} r={R_ORBIT} className="fill-none stroke-rubi/35" strokeWidth={1} />
        <circle cx={C} cy={C} r={R_ORBIT - 7} className="fill-none stroke-foreground/10" strokeWidth={1} strokeDasharray="1 5" />
        <g className="motion-safe:animate-orbit" style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}>
          {[-90, 30, 150].map((angle) => (
            <g key={angle} transform={`rotate(${angle} ${C} ${C}) translate(${C + R_ORBIT} ${C})`}>
              <polygon points="0,-8 3,0 0,8 -3,0" className="fill-ink stroke-rubi" strokeWidth={1.2} />
            </g>
          ))}
        </g>

        {/* Ponto do score: o ponto branco da varredura da marca */}
        <circle cx={marker.x} cy={marker.y} r={8} className="fill-background" />
        <circle cx={marker.x} cy={marker.y} r={4} className="fill-foreground" />
      </svg>

      {/* Halo da marca e varredura, atrás do medidor (z negativo) */}
      <div
        className="absolute inset-[18%] -z-10 rounded-full bg-crimson/25 blur-3xl"
        aria-hidden
      />
      {/* Varredura do radar: monitoramento contínuo. Para com "reduzir movimento". */}
      <div
        className="absolute inset-[19.5%] -z-[5] overflow-hidden rounded-full bg-[radial-gradient(circle,var(--ink)_0%,color-mix(in_oklab,var(--ink)_70%,transparent)_70%,transparent_100%)]"
        aria-hidden
      >
        <div
          className="absolute inset-0 rounded-full motion-safe:animate-radar-sweep"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg 285deg, color-mix(in oklab, var(--rubi) 18%, transparent) 357deg, color-mix(in oklab, var(--rubi) 55%, transparent) 359.4deg, transparent 360deg)",
          }}
        />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="eyebrow text-[10px] text-muted-foreground">Exposição</span>
        <span className="font-mono text-6xl leading-none font-semibold tracking-tight text-rubi tabular-nums text-glow sm:text-[64px]">
          {score.value}
        </span>
        <span className="mt-1 font-mono text-xs text-muted-foreground">de {score.max}</span>
      </div>

      <span
        className={cn(
          "absolute bottom-[3%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase ring-1 ring-inset",
          style.badge,
        )}
      >
        <LevelIcon className="size-3.5" aria-hidden />
        {style.label}
      </span>
    </div>
  );
}

export function ComponentBar({ label, points, cap }: { label: string; points: number; cap: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
        <span className="tracking-wider text-muted-foreground uppercase">{label}</span>
        <span className="text-foreground tabular-nums">
          {points}
          <span className="text-muted-foreground"> / {cap}</span>
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
        role="meter"
        aria-label={`${label}: ${points} de ${cap} pontos`}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={points}
      >
        <div className="h-full rounded-full bg-foreground/75" style={{ width: `${(points / cap) * 100}%` }} />
      </div>
    </div>
  );
}
