import { cn } from "@/lib/utils";

const CENTER = 140;
const ORBIT = 72;

/** Os três fragmentos da marca e o prazo para o qual cada um aponta (graus no sentido horário a partir do topo). */
export const PHASES_ON_RING = [
  { angle: 0, label: "T+15MIN", anchor: "middle", dx: 0, dy: -11 },
  { angle: 120, label: "T+1H", anchor: "start", dx: 9, dy: 4 },
  { angle: 240, label: "T+24H", anchor: "end", dx: -9, dy: 4 },
] as const;

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arc(radius: number, startDeg: number, endDeg: number) {
  const a = polar(radius, startDeg);
  const b = polar(radius, endDeg);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/**
 * Fragmento facetado, tangente à órbita e com a ponta longa no sentido horário (para onde o tempo anda).
 * Exportado para os marcadores da lista de fases.
 */
export function Fragment({ className, angle = 0 }: { className?: string; angle?: number }) {
  return (
    <svg viewBox="-26 -26 52 52" className={cn("size-8", className)} aria-hidden focusable="false">
      <g transform={`rotate(${angle}) translate(-5 0)`}>
        <path d="M-16 0L2 -8.5L26 0L2 8.5Z" className="fill-ink stroke-rubi" strokeWidth="1.8" strokeLinejoin="miter" />
        <path d="M2 -8.5L2 8.5" className="stroke-rubi/40" strokeWidth="1" />
        <path d="M2 -8.5L26 0" className="stroke-foreground" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Diagrama estático (HUD em dose baixa) da história da marca: três fragmentos na órbita da pupila, cada um
 * com um rastro de luz atrás e apontando para o seu prazo no anel de fora.
 */
export function PhaseOrbit({ className }: { className?: string }) {
  const ticks = Array.from({ length: 60 }, (_, index) => index * 6);

  return (
    <svg
      viewBox="-30 -8 340 296"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Três fragmentos giram em volta da pupila: o do topo aponta para T+15MIN, o de baixo à direita para T+1H e o de baixo à esquerda para T+24H."
    >
      {/* Anel de telemetria com graduação */}
      <circle cx={CENTER} cy={CENTER} r="110" fill="none" className="stroke-white/10" strokeWidth="1" />
      {ticks.map((deg) => {
        const major = deg % 30 === 0;
        const a = polar(major ? 99 : 103, deg);
        const b = polar(108, deg);
        return (
          <line
            key={deg}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={major ? "stroke-white/30" : "stroke-white/12"}
            strokeWidth={major ? 1.2 : 0.8}
          />
        );
      })}

      <defs>
        <radialGradient id="phase-orbit-iris" cx="50%" cy="50%" r="50%">
          <stop offset="0.3" style={{ stopColor: "var(--crimson-deep)", stopOpacity: 0.15 }} />
          <stop offset="0.85" style={{ stopColor: "var(--crimson)", stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: "var(--crimson-deep)", stopOpacity: 0.2 }} />
        </radialGradient>
      </defs>

      {/* Íris e pupila */}
      <circle cx={CENTER} cy={CENTER} r="50" fill="url(#phase-orbit-iris)" className="stroke-crimson/50" strokeWidth="1" />
      <circle cx={CENTER} cy={CENTER} r="18" className="fill-background stroke-rubi/70" strokeWidth="1.2" />
      <circle cx={CENTER} cy={CENTER} r="2.2" className="fill-rubi" />

      {/* Órbita */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={ORBIT}
        fill="none"
        className="stroke-rubi/35"
        strokeWidth="1"
        strokeDasharray="2 4"
      />

      {PHASES_ON_RING.map(({ angle, label, anchor, dx, dy }) => {
        const at = polar(ORBIT, angle);
        const pip = polar(116, angle);
        return (
          <g key={label}>
            {/* Rastro de luz: largura constante, atrás do fragmento */}
            <path d={arc(ORBIT, angle - 44, angle - 12)} fill="none" className="stroke-rubi/50" strokeWidth="3.5" />
            <path d={arc(ORBIT - 6, angle - 30, angle - 14)} fill="none" className="stroke-rubi/25" strokeWidth="1" />
            {/* Linha de mira até o prazo */}
            <line
              x1={polar(ORBIT + 12, angle).x}
              y1={polar(ORBIT + 12, angle).y}
              x2={polar(97, angle).x}
              y2={polar(97, angle).y}
              className="stroke-rubi/45"
              strokeWidth="0.8"
              strokeDasharray="1.5 2.5"
            />
            <g transform={`translate(${at.x.toFixed(2)} ${at.y.toFixed(2)}) rotate(${angle})`}>
              <path d="M-16 0L2 -8.5L26 0L2 8.5Z" className="fill-ink stroke-rubi" strokeWidth="1.4" strokeLinejoin="miter" />
              <path d="M2 -8.5L2 8.5" className="stroke-rubi/35" strokeWidth="0.8" />
              <path d="M2 -8.5L26 0" className="stroke-foreground" strokeWidth="1.8" strokeLinecap="round" />
            </g>
            <path
              d={`M${pip.x} ${pip.y - 4}L${pip.x + 4} ${pip.y}L${pip.x} ${pip.y + 4}L${pip.x - 4} ${pip.y}Z`}
              className="fill-rubi"
            />
            <text
              x={pip.x + dx}
              y={pip.y + dy}
              textAnchor={anchor}
              className="fill-foreground font-mono text-[11px] font-medium tracking-[0.06em]"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
