import Image from "next/image";
import { cn } from "@/lib/utils";

/** Ângulos (graus, sentido horário a partir do topo) dos três prazos no anel da marca. */
const PHASE_ANGLES = [0, 120, 240];

function arcPath(radius: number, startDeg: number, endDeg: number) {
  const toPoint = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(rad)).toFixed(3)} ${(50 + radius * Math.sin(rad)).toFixed(3)}`;
  };
  return `M ${toPoint(startDeg)} A ${radius} ${radius} 0 0 1 ${toPoint(endDeg)}`;
}

/**
 * A marca completa no hero (o único HUD forte da landing): o olho, um brilho carmesim que pulsa e um anel
 * externo com três arcos que gira devagar no sentido horário, como os três fragmentos da marca.
 * Tudo é decorativo; as animações param com "reduzir movimento".
 */
export function HeroEye({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto aspect-square w-full", className)}>
      {/* Brilho carmesim atrás do olho */}
      <div
        className="absolute inset-[10%] rounded-full bg-crimson/30 blur-[72px] motion-safe:animate-hud-pulse"
        aria-hidden
      />

      {/* Cantos de mira */}
      <div className="hud-corners absolute -inset-2 [--hud-color:color-mix(in_oklab,var(--rubi)_55%,transparent)] [--hud-len:18px]" aria-hidden />

      {/* Anel externo que gira: três arcos, um por prazo */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full motion-safe:animate-orbit"
        aria-hidden
        focusable="false"
      >
        <circle cx="50" cy="50" r="48.6" fill="none" className="stroke-rubi/20" strokeWidth="0.2" />
        <circle
          cx="50"
          cy="50"
          r="47.4"
          fill="none"
          className="stroke-rubi/30"
          strokeWidth="0.35"
          strokeDasharray="0.25 1.3"
        />
        {PHASE_ANGLES.map((angle) => (
          <path
            key={angle}
            d={arcPath(48.6, angle - 34, angle - 4)}
            fill="none"
            className="stroke-rubi"
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.75"
          />
        ))}
      </svg>

      <Image
        src="/brand/hero.svg"
        alt="Olho do Olharium: uma íris carmesim no centro de uma mira, com três fragmentos que giram em volta da pupila"
        width={512}
        height={512}
        unoptimized
        priority
        className="absolute inset-[5%] size-[90%] select-none"
        draggable={false}
      />
    </div>
  );
}
