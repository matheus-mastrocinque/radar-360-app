import { ChevronRight, House, Laptop, Undo2 } from "lucide-react";
import { SEVERITY_ORDER, SEVERITY_STYLE } from "@/components/dashboard/styles";
import type { Dashboard, ScanSummary, Severity } from "@/lib/dashboard";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import { panelKey, SEVERITY_TONE } from "./model";
import { Panel, TONE_DOT, TONE_TEXT } from "./panel";

const BAR_TONE: Record<Severity, string> = {
  critical: "bg-danger",
  high: "bg-danger/80",
  medium: "bg-warning",
  low: "bg-foreground/35",
  info: "bg-white/12",
};

/** Barra empilhada com a quantidade de achados por gravidade. */
function SeverityBar({ scan }: { scan: ScanSummary }) {
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + scan.bySeverity[severity], 0);
  if (total === 0) return <span className="h-1.5 rounded-full bg-success/60" aria-hidden />;
  return (
    <span className="flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden>
      {SEVERITY_ORDER.filter((severity) => scan.bySeverity[severity] > 0).map((severity) => (
        <span key={severity} className={BAR_TONE[severity]} style={{ flexGrow: scan.bySeverity[severity] }} />
      ))}
    </span>
  );
}

function NetworkRow({
  scan,
  scope,
  now,
}: {
  scan: ScanSummary | null;
  scope: ScanSummary["scope"];
  now: string;
}) {
  const Icon = scope === "home" ? House : Laptop;
  const label = scope === "home" ? "Rede de casa" : "Wi-Fi público";
  const counts = scan
    ? SEVERITY_ORDER.filter((severity) => severity !== "info" && scan.bySeverity[severity] > 0)
    : [];
  return (
    <InspectTrigger
      target={panelKey.network(scope)}
      className="group flex w-full flex-col gap-1.5 rounded-lg bg-ink px-3 py-2 text-left ring-1 ring-white/[0.06] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-[13px] font-medium">{label}</span>
        {scan && scan.fixes.length > 0 && (
          <span className="rounded-full bg-success/15 px-1.5 py-px font-mono text-[10px] font-semibold text-success ring-1 ring-success/30">
            ✓ {scan.fixes.length}
          </span>
        )}
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </span>
      {scan ? (
        <>
          <SeverityBar scan={scan} />
          <span className="flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] text-muted-foreground">
            <time dateTime={scan.finishedAt} title={formatDateTime(scan.finishedAt)}>
              {formatRelative(scan.finishedAt, now)}
            </time>
            {counts.length === 0 ? (
              <span className="text-success">· sem problemas</span>
            ) : (
              counts.map((severity) => (
                <span key={severity} className={TONE_TEXT[SEVERITY_TONE[severity]]}>
                  · {scan.bySeverity[severity]} {SEVERITY_STYLE[severity].label.toLowerCase()}
                </span>
              ))
            )}
          </span>
        </>
      ) : (
        <span className="font-mono text-[10.5px] text-muted-foreground">Ainda sem auditoria</span>
      )}
    </InspectTrigger>
  );
}


/** Agente local: as duas redes auditadas e as correções aplicadas. O comando fica na gaveta de cada rede. */
export function AgentPanel({ dashboard, className }: { dashboard: Dashboard; className?: string }) {
  const fixes = dashboard.summary.fixesApplied;
  return (
    <Panel
      id="agente-titulo"
      index="04"
      label="Agente local"
      className={className}
      bodyClassName="gap-2.5 p-3"
    >
      <NetworkRow scan={dashboard.network.home} scope="home" now={dashboard.generatedAt} />
      <NetworkRow scan={dashboard.network.public} scope="public" now={dashboard.generatedAt} />

      <InspectTrigger
        target="fixes"
        className="group flex w-full items-center gap-3 rounded-lg bg-success/[0.07] px-3 py-2.5 text-left ring-1 ring-success/25 transition-colors outline-none hover:bg-success/[0.12] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="font-mono text-2xl leading-none font-semibold text-success tabular-nums">{fixes}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-medium">{fixes === 1 ? "correção aplicada" : "correções aplicadas"}</span>
          <span className="flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground">
            <Undo2 className="size-3" aria-hidden />
            cada uma com SIM e desfazer
          </span>
        </span>
        <span className={cn("size-1.5 rounded-full", TONE_DOT.success)} aria-hidden />
      </InspectTrigger>

    </Panel>
  );
}
