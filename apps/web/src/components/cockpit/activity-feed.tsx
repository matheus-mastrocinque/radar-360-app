import { ArrowRight, Database, Radar, Wrench } from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import type { ActivityItem } from "./model";
import { Panel, TONE_TEXT } from "./panel";

const KIND_ICON = { breach: Database, scan: Radar, fix: Wrench } as const;

/** Quantos eventos a central mostra; o resto fica na gaveta ("Ver os N eventos"). */
const VISIBLE = 4;

function Event({ item, now, inline }: { item: ActivityItem; now: string; inline: boolean }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <InspectTrigger
      target={item.target}
      className={cn(
        "group relative flex w-full gap-3 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        inline && "lg:flex-col lg:gap-2 lg:py-0",
      )}
    >
      <span
        className={cn(
          "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink ring-1 ring-white/10",
          TONE_TEXT[item.tone],
        )}
        aria-hidden
      >
        <Icon className="size-3" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] leading-snug group-hover:underline group-hover:underline-offset-2">{item.title}</span>
        <span className="flex flex-wrap gap-x-1.5 font-mono text-[10.5px] text-muted-foreground">
          <time dateTime={item.at} title={formatDateTime(item.at)} className={TONE_TEXT[item.tone]}>
            {formatRelative(item.at, now)}
          </time>
          <span aria-hidden>·</span>
          <span className="min-w-0 truncate">{item.meta}</span>
        </span>
      </span>
    </InspectTrigger>
  );
}

/** Lista vertical completa, usada na gaveta. */
export function ActivityList({ items, now }: { items: ActivityItem[]; now: string }) {
  return (
    <ol className="relative flex flex-col">
      <span className="absolute top-5 bottom-5 left-[11px] w-px bg-white/[0.07]" aria-hidden />
      {items.map((item) => (
        <li key={item.key}>
          <Event item={item} now={now} inline={false} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Linha do tempo: os eventos mais recentes do monitoramento e do agente. No computador, numa trilha
 * horizontal; no celular, em coluna. A lista inteira abre na gaveta.
 */
export function ActivityFeed({ items, now, className }: { items: ActivityItem[]; now: string; className?: string }) {
  const visible = items.slice(0, VISIBLE);
  const hidden = items.length - visible.length;
  return (
    <Panel
      id="atividade-titulo"
      index="04"
      label="Linha do tempo"
      className={className}
      aside={
        <span className="font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase tabular-nums">
          {items.length} {items.length === 1 ? "evento" : "eventos"}
        </span>
      }
    >
      <div className="flex flex-col gap-1 px-4 py-3 lg:gap-3 lg:py-4 xl:flex-row xl:items-start xl:gap-6">
        <ol className="relative grid min-w-0 flex-1 lg:grid-cols-4 lg:gap-6">
          <span
            className="absolute top-5 bottom-5 left-[11px] w-px bg-white/[0.07] lg:top-3 lg:right-0 lg:bottom-auto lg:left-3 lg:h-px lg:w-auto"
            aria-hidden
          />
          {visible.map((item) => (
            <li key={item.key} className="min-w-0">
              <Event item={item} now={now} inline />
            </li>
          ))}
        </ol>
        {hidden > 0 && (
          <InspectTrigger
            target="activity"
            className="group flex shrink-0 items-center gap-1.5 self-start rounded-md py-1.5 font-mono text-[11px] tracking-wide text-telemetry outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 xl:mt-0.5"
          >
            Ver os {items.length} eventos
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </InspectTrigger>
        )}
      </div>
    </Panel>
  );
}
