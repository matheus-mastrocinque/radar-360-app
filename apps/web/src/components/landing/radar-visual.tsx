import { FileWarning, Router, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pontos detectados no radar (posição em % do quadrado). */
const BLIPS = [
  { top: "27%", left: "63%", tone: "bg-red-400" },
  { top: "62%", left: "30%", tone: "bg-amber-300" },
  { top: "70%", left: "70%", tone: "bg-signal" },
];

function SignalCard({
  className,
  icon: Icon,
  iconTone,
  kicker,
  title,
  children,
}: {
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTone: string;
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute flex max-w-[64%] items-start gap-2.5 rounded-xl bg-white/[0.07] p-2.5 text-left shadow-[0_10px_40px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/12 backdrop-blur-md sm:max-w-[62%] sm:p-3",
        className,
      )}
    >
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", iconTone)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow text-[10px] text-white/50">{kicker}</span>
        <span className="text-xs leading-snug font-medium text-white sm:text-[13px]">{title}</span>
        {children}
      </span>
    </div>
  );
}

/**
 * Ilustração do hero: um radar com a varredura girando e três sinais da persona demo.
 * Mostra só categorias e achados, nunca um dado vazado. A animação respeita "reduzir movimento".
 */
export function RadarVisual({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[480px]", className)} aria-hidden>
      {/* Disco do radar */}
      <div className="absolute inset-[6%] overflow-hidden rounded-full bg-[radial-gradient(circle,oklch(0.3_0.05_230/0.55),oklch(0.2_0.04_255/0.2)_70%)] ring-1 ring-white/10">
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,oklch(0.86_0.13_188/0.04)_300deg,oklch(0.86_0.13_188/0.38)_360deg)] motion-safe:animate-radar-sweep" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <g fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="0.3">
            <circle cx="50" cy="50" r="12" />
            <circle cx="50" cy="50" r="24" />
            <circle cx="50" cy="50" r="36" />
            <circle cx="50" cy="50" r="48" />
            <line x1="50" y1="0" x2="50" y2="100" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="15" y1="15" x2="85" y2="85" strokeOpacity="0.05" />
            <line x1="85" y1="15" x2="15" y2="85" strokeOpacity="0.05" />
          </g>
          <g fill="white" fillOpacity="0.25">
            {Array.from({ length: 36 }, (_, index) => {
              const angle = (index * 10 * Math.PI) / 180;
              const inner = index % 3 === 0 ? 45 : 46.5;
              return (
                <line
                  key={index}
                  x1={50 + inner * Math.sin(angle)}
                  y1={50 - inner * Math.cos(angle)}
                  x2={50 + 48 * Math.sin(angle)}
                  y2={50 - 48 * Math.cos(angle)}
                  stroke="white"
                  strokeOpacity="0.25"
                  strokeWidth="0.3"
                />
              );
            })}
          </g>
          <circle cx="50" cy="50" r="1.2" fill="oklch(0.86 0.13 188)" />
        </svg>
        {BLIPS.map((blip) => (
          <span key={blip.top} className="absolute" style={{ top: blip.top, left: blip.left }}>
            <span className={cn("absolute -top-1 -left-1 size-2 rounded-full", blip.tone)} />
            <span
              className={cn("absolute -top-1 -left-1 size-2 rounded-full motion-safe:animate-blip", blip.tone)}
            />
          </span>
        ))}
      </div>

      {/* Sinais detectados (persona fictícia) */}
      <SignalCard
        className="top-[4%] right-0"
        icon={ShieldAlert}
        iconTone="bg-red-400/15 text-red-300"
        kicker="Vazamento novo"
        title="Clínica Vida+ (fictícia)"
      >
        <span className="mt-1 flex flex-wrap gap-1">
          {["CPF", "Convênio médico"].map((label) => (
            <span key={label} className="rounded-md bg-white/10 px-1.5 py-px text-[10px] text-white/80">
              {label}
            </span>
          ))}
        </span>
      </SignalCard>
      <SignalCard
        className="top-[46%] left-0"
        icon={Router}
        iconTone="bg-amber-300/15 text-amber-200"
        kicker="Rede de casa"
        title="Telnet aberto no roteador"
      />
      <SignalCard
        className="right-[2%] bottom-[3%]"
        icon={FileWarning}
        iconTone="bg-signal/15 text-signal"
        kicker="LGPD · 15 dias"
        title="Sem resposta: petição à ANPD pronta"
      />
    </div>
  );
}
