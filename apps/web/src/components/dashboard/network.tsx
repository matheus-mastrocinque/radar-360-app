import { Fragment } from "react";
import { CheckCircle2, ChevronRight, House, Laptop, MonitorSmartphone, Router, Terminal, Undo2, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Finding, ScanSummary, Severity } from "@/lib/dashboard";
import { formatDateTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SEVERITY_ORDER, SEVERITY_STYLE } from "./styles";

type AgentMode = "home" | "public";

function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const style = SEVERITY_STYLE[severity];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "flex w-fit items-center gap-1 rounded-full px-2 py-px font-mono text-[10px] tracking-wider whitespace-nowrap uppercase",
        style.badge,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {style.label}
    </span>
  );
}

function SeverityCounts({ bySeverity }: { bySeverity: Record<Severity, number> }) {
  const present = SEVERITY_ORDER.filter((severity) => bySeverity[severity] > 0);
  if (present.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <CheckCircle2 className="size-3.5" aria-hidden />
        Nenhum problema encontrado
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Achados por gravidade">
      {present.map((severity) => {
        const style = SEVERITY_STYLE[severity];
        const Icon = style.icon;
        return (
          <li
            key={severity}
            className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs", style.badge)}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="font-mono font-semibold tabular-nums">{bySeverity[severity]}</span>
            {style.label.toLowerCase()}
          </li>
        );
      })}
    </ul>
  );
}

function FindingRow({ finding, device }: { finding: Finding; device: string | null }) {
  const style = SEVERITY_STYLE[finding.severity];
  const where = [device, finding.port !== null ? `porta ${finding.port}` : null].filter(Boolean).join(" · ");
  return (
    <li className={cn("flex flex-col gap-1.5 border-l-2 py-0.5 pl-3.5", style.rail)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium">{finding.title}</span>
        <SeverityBadge severity={finding.severity} />
      </div>
      {where && <span className="font-mono text-xs break-words text-muted-foreground">{where}</span>}
      {finding.severity !== "info" && (
        <p className="text-sm leading-relaxed text-foreground/80">{finding.recommendation}</p>
      )}
      <details className="group text-xs text-muted-foreground">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded font-medium text-foreground/70 select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
          Por que isso importa
        </summary>
        <p className="mt-1.5 pl-[18px] leading-relaxed">{finding.detail}</p>
      </details>
    </li>
  );
}

/** Correções que o agente aplicou, cada uma com a confirmação do usuário. É a prova de que o produto corrige. */
function FixList({ fixes }: { fixes: ScanSummary["fixes"] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-success/10 p-3.5 ring-1 ring-success/30 ring-inset">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-success/15 text-success ring-1 ring-success/30">
            <Wrench className="size-3.5" aria-hidden />
          </span>
          Corrigido pelo agente, com o seu OK
        </span>
        <span className="shrink-0 rounded-full bg-success/15 px-2 py-px font-mono text-[11px] font-semibold text-success tabular-nums ring-1 ring-success/30">
          {plural(fixes.length, "correção", "correções")}
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {fixes.map((fix) => {
          const Icon = fix.target === "router" ? Router : Laptop;
          return (
            <li key={`${fix.kind}-${fix.appliedAt}`} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="leading-snug">{fix.title}</span>
                <span className="flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-muted-foreground">
                  <Icon className="size-3" aria-hidden />
                  {fix.target === "router" ? "No roteador" : "Neste computador"}
                  <span aria-hidden>·</span>
                  {formatDateTime(fix.appliedAt)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <span className="flex items-center gap-1.5 border-t border-success/20 pt-2.5 text-xs text-muted-foreground">
        <Undo2 className="size-3.5 shrink-0" aria-hidden />
        O agente guarda como desfazer cada correção.
      </span>
    </div>
  );
}

function AgentCommand({ mode, label }: { mode: AgentMode; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="flex items-start gap-2 rounded-md bg-ink px-3 py-2 font-mono text-xs leading-relaxed text-foreground ring-1 ring-white/[0.06]">
        <Terminal className="mt-[3px] size-3.5 shrink-0 text-rubi" aria-hidden />
        {/* Quebra só entre os argumentos, nunca no meio de "--corrigir". */}
        <span className="min-w-0">
          {["python", "scanner.py", "--mode", mode, "--corrigir"].map((part, index) => (
            <Fragment key={part}>
              {index > 0 && " "}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))}
        </span>
      </code>
    </div>
  );
}

function deviceName(scan: ScanSummary, ip: string | null): string | null {
  if (!ip) return null;
  const device = scan.devices.find((item) => item.ip === ip);
  const name = device?.model ?? device?.hostname;
  return name ? `${name} ${ip}` : ip;
}

function ScanCard({
  scan,
  title,
  icon: Icon,
  scopeNote,
  emptyText,
  agentMode,
}: {
  scan: ScanSummary | null;
  title: string;
  agentMode: AgentMode;
  icon: React.ComponentType<{ className?: string }>;
  scopeNote: string;
  emptyText: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{scopeNote}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {!scan ? (
          <div className="flex flex-col gap-3 rounded-lg p-4 text-sm text-muted-foreground ring-1 ring-white/15 ring-inset [border-style:dashed]">
            <p>{emptyText}</p>
            <AgentCommand
              mode={agentMode}
              label={
                agentMode === "home"
                  ? "Conectado à rede de casa, rode no seu computador:"
                  : "Conectado a um Wi-Fi público, rode no seu computador:"
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 rounded-lg bg-ink px-3.5 py-3 ring-1 ring-white/[0.06]">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                <span className="tracking-wider uppercase">Última auditoria</span>
                <span className="text-foreground">{formatDateTime(scan.finishedAt)}</span>
                {scan.scope === "home" && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{plural(scan.devices.length, "aparelho")}</span>
                  </>
                )}
                {scan.network.wifiSecurity && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Wi-Fi {scan.network.wifiSecurity}</span>
                  </>
                )}
              </span>
              <SeverityCounts bySeverity={scan.bySeverity} />
            </div>

            {scan.fixes.length > 0 && <FixList fixes={scan.fixes} />}

            {scan.scope === "home" && scan.devices.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="eyebrow text-[10px] text-muted-foreground">Aparelhos encontrados</span>
                <ul className="flex flex-wrap gap-1.5" aria-label="Aparelhos encontrados">
                  {scan.devices.map((device) => {
                    const DeviceIcon = device.ip === scan.network.gateway ? Router : MonitorSmartphone;
                    return (
                      <li
                        key={device.ip}
                        className="flex max-w-full items-center gap-1.5 rounded-md bg-ink px-2 py-1 text-xs ring-1 ring-white/[0.07]"
                      >
                        <DeviceIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{device.model ?? device.hostname ?? "Aparelho sem nome"}</span>
                        <span className="font-mono text-muted-foreground">{device.ip}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {scan.findings.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="eyebrow text-[10px] text-muted-foreground">O que o agente encontrou</span>
                <ul className="flex flex-col gap-4">
                  {scan.findings.map((finding) => (
                    <FindingRow key={finding.id} finding={finding} device={deviceName(scan, finding.deviceIp)} />
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto border-t border-white/[0.06] pt-4">
              <AgentCommand mode={agentMode} label="Para auditar de novo, rode no seu computador:" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function NetworkSection({ network }: { network: { home: ScanSummary | null; public: ScanSummary | null } }) {
  return (
    <section id="sua-rede" className="flex scroll-mt-20 flex-col gap-4 pt-4" aria-labelledby="rede-titulo">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow text-rubi">Agente local</span>
        <h2 id="rede-titulo" className="text-xl font-semibold tracking-tight">
          Sua rede
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          O agente só varre a sua própria rede, com o seu consentimento. Ele corrige o que dá para corrigir no seu
          computador e no seu roteador, pedindo confirmação a cada ação e guardando como desfazer. Nunca tenta senhas
          nem invade aparelhos.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ScanCard
          scan={network.home}
          title="Rede de casa"
          agentMode="home"
          icon={House}
          scopeNote="Aparelhos da sua rede Wi-Fi e o que cada um deixa aberto."
          emptyText="Nenhuma auditoria da rede de casa ainda."
        />
        <ScanCard
          scan={network.public}
          title="Rede pública · este computador"
          agentMode="public"
          icon={Laptop}
          scopeNote="Em Wi-Fi público, o agente audita só o seu computador e não envia nada a outros aparelhos."
          emptyText="Nenhuma auditoria em rede pública ainda."
        />
      </div>
    </section>
  );
}
