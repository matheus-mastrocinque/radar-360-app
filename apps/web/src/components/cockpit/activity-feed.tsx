import { Database, KeyRound, Radar, Wrench } from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import type { ActivityItem } from "./model";
import { Panel, TONE_TEXT } from "./panel";

const KIND_ICON = { breach: Database, scan: Radar, fix: Wrench, accounts: KeyRound } as const;

/** Linha do tempo: o que o monitoramento e o agente fizeram, do mais recente ao mais antigo. */
export function ActivityFeed({ items, now, className }: { items: ActivityItem[]; now: string; className?: string }) {
  return (
    <Panel
      id="atividade-titulo"
      index="05"
      label="Linha do tempo"
      className={className}
      aside={
        <span className="font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase tabular-nums">
          {items.length} eventos
        </span>
      }
    >
      <ol className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        <span className="absolute top-5 bottom-5 left-[27px] w-px bg-white/[0.07]" aria-hidden />
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <li key={item.key}>
              <InspectTrigger
                target={item.target}
                className="group relative flex w-full gap-3 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                  <span className="text-[13px] leading-snug group-hover:underline group-hover:underline-offset-2">
                    {item.title}
                  </span>
                  <span className="flex flex-wrap gap-x-1.5 font-mono text-[10.5px] text-muted-foreground">
                    <time dateTime={item.at} title={formatDateTime(item.at)} className={TONE_TEXT[item.tone]}>
                      {formatRelative(item.at, now)}
                    </time>
                    <span aria-hidden>·</span>
                    <span className="truncate">{item.meta}</span>
                  </span>
                </span>
              </InspectTrigger>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
