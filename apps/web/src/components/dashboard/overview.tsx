import { ArrowRight, Database, ListChecks, ShieldCheck, Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard, DataClass, Finding, ScanSummary } from "@/lib/dashboard";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLE } from "./styles";

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  hintTone = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  hintTone?: "muted" | "alert" | "ok";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </div>
        <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        <div
          className={cn(
            "text-xs",
            hintTone === "alert" && "font-medium text-red-600",
            hintTone === "ok" && "text-emerald-700",
            hintTone === "muted" && "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatTiles({ summary }: { summary: Dashboard["summary"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile
        icon={Database}
        label="Vazamentos com seus dados"
        value={summary.breaches}
        hint={summary.newBreaches > 0 ? `${plural(summary.newBreaches, "novo", "novos")} nos últimos 7 dias` : "Nenhum novo nos últimos 7 dias"}
        hintTone={summary.newBreaches > 0 ? "alert" : "muted"}
      />
      <StatTile
        icon={ShieldCheck}
        label="Dados monitorados"
        value={summary.assets}
        hint={summary.verifiedAssets === summary.assets ? "Todos verificados" : `${summary.verifiedAssets} verificados`}
        hintTone={summary.verifiedAssets === summary.assets ? "ok" : "muted"}
      />
      <StatTile
        icon={Wifi}
        label="Alertas de rede"
        value={summary.importantNetworkAlerts}
        hint="De gravidade média ou maior"
        hintTone={summary.importantNetworkAlerts > 0 ? "alert" : "muted"}
      />
    </div>
  );
}

interface Step {
  key: string;
  priority: number;
  kind: "leak" | "network";
  title: string;
  source: string;
  description: string;
  severity?: Finding["severity"];
}

/** Prioridade dos achados de rede na mesma escala dos pesos das categorias vazadas. */
const FINDING_PRIORITY: Partial<Record<Finding["severity"], number>> = { critical: 13, high: 11, medium: 5 };

function deviceLabel(scan: ScanSummary, ip: string | null): string | null {
  if (!ip) return null;
  const device = scan.devices.find((item) => item.ip === ip);
  const name = device?.model ?? device?.hostname;
  return name ? `${name} (${ip})` : ip;
}

/** Primeiros passos: textos fixos da tabela curada e das recomendações do agente. Nada gerado por IA. */
export function buildFirstSteps(dashboard: Dashboard, limit = 4): Step[] {
  const classes = new Map<string, { info: DataClass; companies: string[] }>();
  for (const breach of dashboard.breaches) {
    for (const info of breach.dataClasses) {
      if (!info.action) continue;
      const entry = classes.get(info.key) ?? { info, companies: [] };
      entry.companies.push(breach.company);
      classes.set(info.key, entry);
    }
  }
  const leakSteps: Step[] = [...classes.values()].map(({ info, companies }) => ({
    key: `leak-${info.key}`,
    priority: info.weight,
    kind: "leak",
    title: info.label,
    source: `Vazou em ${companies.join(" e ")}`,
    description: info.action ?? "",
  }));

  const networkSteps: Step[] = [];
  for (const scan of [dashboard.network.home, dashboard.network.public]) {
    if (!scan) continue;
    const scope = scan.scope === "home" ? "Rede de casa" : "Rede pública";
    for (const finding of scan.findings) {
      const priority = FINDING_PRIORITY[finding.severity];
      if (priority === undefined) continue;
      const device = deviceLabel(scan, finding.deviceIp);
      networkSteps.push({
        key: `net-${finding.id}`,
        priority,
        kind: "network",
        title: finding.title,
        source: device ? `${scope} · ${device}` : scope,
        description: finding.recommendation,
        severity: finding.severity,
      });
    }
  }

  return [...leakSteps, ...networkSteps].sort((a, b) => b.priority - a.priority).slice(0, limit);
}

export function FirstSteps({ dashboard }: { dashboard: Dashboard }) {
  const steps = buildFirstSteps(dashboard);
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" aria-hidden />
          Por onde começar
        </CardTitle>
        <CardDescription>Os passos que mais reduzem o seu risco agora, em ordem de prioridade.</CardDescription>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ação urgente. Continue com o monitoramento ativo.</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {steps.map((step, index) => (
              <li key={step.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{step.title}</span>
                    {step.severity && (
                      <span className={cn("rounded-full px-1.5 py-px text-[11px] font-medium", SEVERITY_STYLE[step.severity].badge)}>
                        {SEVERITY_STYLE[step.severity].label}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{step.source}</span>
                  <p className="text-sm">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <ArrowRight className="size-3.5" aria-hidden />
          Plano completo para 15 min, 1 h e 24 h, com a notificação LGPD pronta: em breve, no copiloto.
        </p>
      </CardContent>
    </Card>
  );
}
