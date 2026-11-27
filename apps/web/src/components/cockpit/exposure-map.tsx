import {
  AtSign,
  Cpu,
  Database,
  Globe,
  House,
  IdCard,
  KeyRound,
  Laptop,
  MousePointerClick,
  Phone,
  Router,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import { MAP_TALL, MAP_WIDE, type ExposureMap, type MapGeometry, type MapIcon, type MapNode, type Tone } from "./model";
import { Panel } from "./panel";

const ICONS: Record<Exclude<MapIcon, "you">, React.ComponentType<{ className?: string }>> = {
  email: AtSign,
  cpf: IdCard,
  phone: Phone,
  home: House,
  wifi: Wifi,
  accounts: KeyRound,
  breach: Database,
  router: Router,
  device: Cpu,
  laptop: Laptop,
  service: Globe,
};

/** Anel e brilho do nó por tom. O carmesim fica só no "você" (marca); estado usa success/warning/danger. */
const NODE_TONE: Record<Tone, string> = {
  danger: "text-danger ring-danger/75 shadow-[0_0_22px_-4px_var(--danger)]",
  warning: "text-warning ring-warning/60 shadow-[0_0_18px_-6px_var(--warning)]",
  neutral: "text-foreground/85 ring-white/25",
  success: "text-success ring-success/55",
  muted: "text-muted-foreground ring-white/12",
};

const EDGE_TONE: Record<Tone, { className: string; opacity: number }> = {
  danger: { className: "stroke-danger", opacity: 0.8 },
  warning: { className: "stroke-warning", opacity: 0.5 },
  neutral: { className: "stroke-foreground", opacity: 0.25 },
  success: { className: "stroke-success", opacity: 0.45 },
  muted: { className: "stroke-foreground", opacity: 0.12 },
};

const SUB_TONE: Record<Tone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  neutral: "text-muted-foreground",
  success: "text-success",
  muted: "text-muted-foreground/80",
};

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

/*
 * Rótulos em três níveis, para o mapa não virar parede de texto: o anel de dentro sempre mostra nome
 * e resumo; na borda, o resumo só aparece quando pede atenção (grave ou atenção), e os pontos apagados
 * (sem achado) só mostram o nome ao passar o mouse ou focar. O nome completo está sempre no aria-label.
 */
function Node({ node, geo, compact }: { node: MapNode; geo: MapGeometry; compact: boolean }) {
  const isYou = node.icon === "you";
  const Icon = node.icon === "you" ? null : ICONS[node.icon];
  const size = isYou ? "size-14" : node.ring === 1 ? "size-10" : node.dim ? "size-7" : "size-8";
  const showSub = node.sub !== null && !compact && (node.ring === 1 || node.tone === "danger" || node.tone === "warning");
  const revealOnHover = node.ring === 2 && node.dim;
  return (
    <InspectTrigger
      target={node.target}
      label={node.srLabel}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
      style={{ left: pct(node.x, geo.width), top: pct(node.y, geo.height) }}
    >
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full bg-ink ring-1 transition-transform duration-200 group-hover:scale-110 group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
          size,
          isYou ? "ring-rubi/60 shadow-[0_0_36px_-6px_var(--crimson)]" : NODE_TONE[node.tone],
        )}
      >
        {node.pulse && (
          <span className="absolute inset-0 rounded-full ring-2 ring-danger motion-safe:animate-blip" aria-hidden />
        )}
        {isYou ? (
          <Image src="/brand/icon.svg" alt="" width={40} height={40} unoptimized className="size-10" />
        ) : (
          Icon && <Icon className={node.ring === 1 ? "size-[18px]" : node.dim ? "size-3.5" : "size-4"} />
        )}
        {node.fixes > 0 && (
          <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-success px-1 font-mono text-[9px] leading-none font-bold text-background ring-2 ring-background">
            ✓{node.fixes}
          </span>
        )}
      </span>
      <span
        className={cn(
          // O halo da cor do fundo deixa o rótulo legível quando uma ligação passa por baixo dele.
          "pointer-events-none absolute top-full left-1/2 mt-1 flex -translate-x-1/2 flex-col items-center leading-tight whitespace-nowrap [text-shadow:0_0_4px_var(--background),0_0_8px_var(--background)]",
          compact && node.ring === 2 && "hidden",
          revealOnHover &&
            "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        <span
          className={cn(
            node.ring === 2
              ? "text-[11px] font-medium text-foreground/90"
              : "font-mono text-[10px] font-semibold tracking-[0.12em] text-foreground uppercase",
            node.dim && "text-muted-foreground",
          )}
        >
          {compact ? (node.compactLabel ?? node.label) : node.label}
        </span>
        {showSub && <span className={cn("font-mono text-[9.5px] tracking-wide", SUB_TONE[node.tone])}>{node.sub}</span>}
      </span>
    </InspectTrigger>
  );
}

function MapCanvas({
  map,
  geo,
  compact = false,
  className,
}: {
  map: ExposureMap;
  geo: MapGeometry;
  compact?: boolean;
  className?: string;
}) {
  const { width, height, cx, cy, inner, outer } = geo;
  return (
    <div className={cn("relative mx-auto w-full", className)} style={{ aspectRatio: `${width} / ${height}` }}>
      {/* Varredura do radar, achatada na elipse do anel de fora. */}
      <div
        className="pointer-events-none absolute aspect-square"
        style={{
          left: pct(cx, width),
          top: pct(cy, height),
          width: pct(outer.rx * 2, width),
          transform: `translate(-50%, -50%) scaleY(${outer.ry / outer.rx})`,
        }}
        aria-hidden
      >
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute inset-0 motion-safe:animate-radar-sweep"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg 300deg, color-mix(in oklab, var(--rubi) 10%, transparent) 352deg, color-mix(in oklab, var(--rubi) 32%, transparent) 359.5deg, transparent 360deg)",
            }}
          />
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full overflow-visible" aria-hidden focusable="false">
        <g className="fill-none stroke-foreground">
          <ellipse cx={cx} cy={cy} rx={outer.rx + 34} ry={outer.ry + 22} strokeOpacity={0.05} />
          <ellipse cx={cx} cy={cy} rx={outer.rx} ry={outer.ry} strokeOpacity={0.12} strokeDasharray="2 6" />
          <ellipse cx={cx} cy={cy} rx={inner.rx} ry={inner.ry} strokeOpacity={0.14} strokeDasharray="2 5" />
          <ellipse cx={cx} cy={cy} rx={inner.rx * 0.42} ry={inner.ry * 0.42} strokeOpacity={0.08} />
          <line x1={cx - outer.rx - 34} y1={cy} x2={cx + outer.rx + 34} y2={cy} strokeOpacity={0.05} />
          <line x1={cx} y1={cy - outer.ry - 22} x2={cx} y2={cy + outer.ry + 22} strokeOpacity={0.05} />
        </g>
        {map.edges.map((edge) => {
          const tone = EDGE_TONE[edge.tone];
          return (
            <line
              key={edge.id}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              className={cn(tone.className, edge.flow && "motion-safe:animate-dash-flow")}
              strokeOpacity={tone.opacity}
              strokeWidth={edge.flow ? 1.4 : 1}
              strokeDasharray={edge.flow ? "4 4" : undefined}
            />
          );
        })}
      </svg>

      {map.nodes.map((node) => (
        <Node key={node.id} node={node} geo={geo} compact={compact} />
      ))}
    </div>
  );
}

/** Mapa de exposição: você no centro, seus dados e redes ao redor, e o que ameaça cada um na borda. */
export function ExposureMapPanel({
  wide,
  tall,
  footer,
  className,
}: {
  wide: ExposureMap;
  tall: ExposureMap;
  /** Resumo dos setores, no rodapé do mapa. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel
      id="mapa-titulo"
      index="03"
      label="Mapa de exposição"
      className={className}
      aside={
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
          <MousePointerClick className="size-3.5 text-telemetry" aria-hidden />
          Toque num ponto<span className="max-sm:hidden"> para ver</span>
        </span>
      }
    >
      {/*
       * Do lg em diante, o corpo vira um contêiner de tamanho: a altura vem da coluna da esquerda e o
       * mapa ocupa o maior tamanho que cabe nela, mantendo a proporção do MAP_WIDE (640 / 500 = 1,28).
       */}
      <div className="relative flex flex-1 flex-col justify-center px-2 py-3 sm:px-4 lg:min-h-[420px] lg:[container-type:size]">
        <div
          className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_50%_50%,black_20%,transparent_70%)]"
          aria-hidden
        />
        <MapCanvas
          map={wide}
          geo={MAP_WIDE}
          className="max-w-[860px] max-sm:hidden lg:w-[min(100%,calc(100cqh*1.28))]"
        />
        <MapCanvas map={tall} geo={MAP_TALL} compact className="max-w-[420px] sm:hidden" />

        <ul
          className="relative mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground sm:absolute sm:top-3 sm:left-4 sm:mt-0 sm:flex-col sm:items-start sm:gap-1"
          aria-label="Legenda do mapa"
        >
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger" aria-hidden /> Novo ou grave
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" aria-hidden /> Atenção
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-3 items-center rounded-full bg-success px-1 text-[8px] font-bold text-background" aria-hidden>
              ✓
            </span>{" "}
            Corrigido pelo agente
          </li>
        </ul>
      </div>
      {footer}
    </Panel>
  );
}
