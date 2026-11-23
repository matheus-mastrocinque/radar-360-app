import { Home, Laptop, Router, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Finding, ScanSummary, Severity } from "@/lib/dashboard";
import { formatDateTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLE } from "./styles";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function SeverityCounts({ bySeverity }: { bySeverity: Record<Severity, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SEVERITY_ORDER.filter((severity) => bySeverity[severity] > 0).map((severity) => (
        <span
          key={severity}
          className={cn("rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_STYLE[severity].badge)}
        >
          {bySeverity[severity]} {SEVERITY_STYLE[severity].label.toLowerCase()}
        </span>
      ))}
    </div>
  );
}

function FindingRow({ finding, device }: { finding: Finding; device: string | null }) {
  const style = SEVERITY_STYLE[finding.severity];
  const where = [device, finding.port !== null ? `porta ${finding.port}` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", style.dot)} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{finding.title}</span>
          <span className={cn("rounded-full px-1.5 py-px text-[11px] font-medium", style.badge)}>{style.label}</span>
        </div>
        {where && <span className="font-mono text-xs text-muted-foreground">{where}</span>}
        {finding.severity !== "info" && <p className="text-sm text-muted-foreground">{finding.recommendation}</p>}
        <details className="group text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/70 hover:text-foreground">
            Por que isso importa
          </summary>
          <p className="mt-1">{finding.detail}</p>
        </details>
      </div>
    </li>
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
  agentMode: "home" | "public";
  icon: React.ComponentType<{ className?: string }>;
  scopeNote: string;
  emptyText: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{scopeNote}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!scan ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>{emptyText}</p>
            <code className="flex items-center gap-2 rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
              <Terminal className="size-3.5" aria-hidden />
              python scanner.py --mode {agentMode}
            </code>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Última auditoria em {formatDateTime(scan.finishedAt)}
                {scan.scope === "home" && ` · ${plural(scan.devices.length, "aparelho")}`}
                {scan.network.wifiSecurity && ` · Wi-Fi ${scan.network.wifiSecurity}`}
              </span>
              <SeverityCounts bySeverity={scan.bySeverity} />
            </div>

            {scan.scope === "home" && scan.devices.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {scan.devices.map((device) => (
                  <li
                    key={device.ip}
                    className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    {device.ip === scan.network.gateway && (
                      <Router className="size-3.5 text-muted-foreground" aria-hidden />
                    )}
                    <span>{device.model ?? device.hostname ?? "Aparelho sem nome"}</span>
                    <span className="font-mono text-muted-foreground">{device.ip}</span>
                  </li>
                ))}
              </ul>
            )}

            <ul className="flex flex-col divide-y">
              {scan.findings.map((finding) => (
                <FindingRow key={finding.id} finding={finding} device={deviceName(scan, finding.deviceIp)} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function NetworkSection({ network }: { network: { home: ScanSummary | null; public: ScanSummary | null } }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="rede">
      <div className="flex flex-col gap-1">
        <h2 id="rede" className="text-lg font-semibold tracking-tight">
          Sua rede
        </h2>
        <p className="text-sm text-muted-foreground">
          Resultados do agente local. Ele só varre a sua própria rede, com o seu consentimento, e nunca tenta senhas
          nem invade aparelhos.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ScanCard
          scan={network.home}
          title="Rede de casa"
          agentMode="home"
          icon={Home}
          scopeNote="Aparelhos da sua rede Wi-Fi e o que cada um deixa aberto."
          emptyText="Nenhuma auditoria da rede de casa ainda. Rode o agente no seu computador:"
        />
        <ScanCard
          scan={network.public}
          title="Rede pública · este computador"
          agentMode="public"
          icon={Laptop}
          scopeNote="Em Wi-Fi público, o agente audita só o seu computador e não envia nada a outros aparelhos."
          emptyText="Nenhuma auditoria em rede pública ainda. Conectado a um Wi-Fi público, rode:"
        />
      </div>
    </section>
  );
}
