import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Database,
  Fingerprint,
  LifeBuoy,
  ListChecks,
  TriangleAlert,
  Wifi,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard, DataClass, Finding, ScanSummary } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLE } from "./styles";

type Tone = "danger" | "warning" | "success" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success",
  muted: "text-muted-foreground",
};

function StatTile({
  href,
  icon: Icon,
  label,
  value,
  hint,
  hintIcon: HintIcon,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  hintIcon?: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  return (
    <a
      href={href}
      className="group flex min-w-0 flex-col gap-2 rounded-xl bg-card p-3.5 ring-1 ring-white/[0.07] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-4"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-[13px] leading-snug text-muted-foreground">{label}</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink text-muted-foreground ring-1 ring-white/[0.06] transition-colors group-hover:text-foreground">
          <Icon className="size-3.5" aria-hidden />
        </span>
      </span>
      <span className="font-mono text-3xl leading-none font-semibold tracking-tight tabular-nums">{value}</span>
      <span className={cn("flex items-start gap-1.5 text-xs leading-snug", TONE_TEXT[tone])}>
        {HintIcon && <HintIcon className="mt-px size-3.5 shrink-0" aria-hidden />}
        {hint}
      </span>
    </a>
  );
}

export function StatTiles({ summary }: { summary: Dashboard["summary"] }) {
  const allVerified = summary.verifiedAssets === summary.assets;
  return (
    <nav aria-label="Resumo do painel" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        href="#vazamentos"
        icon={Database}
        label="Vazamentos"
        value={summary.breaches}
        tone={summary.newBreaches > 0 ? "danger" : "muted"}
        hintIcon={summary.newBreaches > 0 ? TriangleAlert : undefined}
        hint={
          summary.newBreaches > 0
            ? `${summary.newBreaches === 1 ? "1 novo" : `${summary.newBreaches} novos`} em 7 dias`
            : "Nenhum novo em 7 dias"
        }
      />
      <StatTile
        href="#sua-rede"
        icon={Wifi}
        label="Alertas de rede"
        value={summary.importantNetworkAlerts}
        tone={summary.importantNetworkAlerts > 0 ? "warning" : "success"}
        hintIcon={summary.importantNetworkAlerts > 0 ? CircleAlert : CheckCircle2}
        hint={summary.importantNetworkAlerts > 0 ? "Médios ou mais graves" : "Nenhum relevante"}
      />
      <StatTile
        href="#sua-rede"
        icon={Wrench}
        label="Correções do agente"
        value={summary.fixesApplied}
        tone={summary.fixesApplied > 0 ? "success" : "muted"}
        hintIcon={summary.fixesApplied > 0 ? CheckCircle2 : undefined}
        hint={summary.fixesApplied > 0 ? "Todas com o seu OK" : "Nenhuma ainda"}
      />
      <StatTile
        href="#dados-monitorados"
        icon={Fingerprint}
        label="Dados monitorados"
        value={summary.assets}
        tone={allVerified ? "success" : "muted"}
        hintIcon={allVerified ? BadgeCheck : undefined}
        hint={allVerified ? "Todos verificados" : `${summary.verifiedAssets} verificados`}
      />
    </nav>
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

function StepTag({ step }: { step: Step }) {
  if (step.severity) {
    const style = SEVERITY_STYLE[step.severity];
    const Icon = style.icon;
    return (
      <span className={cn("flex items-center gap-1 rounded-full px-2 py-px font-mono text-[10px] tracking-wider uppercase", style.badge)}>
        <Icon className="size-3" aria-hidden />
        Rede · {style.label}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full px-2 py-px font-mono text-[10px] tracking-wider text-muted-foreground uppercase ring-1 ring-white/10 ring-inset">
      <Database className="size-3" aria-hidden />
      Vazamento
    </span>
  );
}

export function FirstSteps({ dashboard }: { dashboard: Dashboard }) {
  const steps = buildFirstSteps(dashboard);
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <ListChecks className="size-4" aria-hidden />
          </span>
          Por onde começar
        </CardTitle>
        <CardDescription>Os passos que mais reduzem o seu risco agora, em ordem de prioridade.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {steps.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm ring-1 ring-success/30">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
            Nenhuma ação urgente. O monitoramento continua ativo.
          </p>
        ) : (
          <ol className="flex flex-col">
            {steps.map((step, index) => (
              <li
                key={step.key}
                className="flex gap-3.5 border-b border-white/[0.06] py-3.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-xs font-semibold text-rubi ring-1 ring-white/[0.06]"
                  aria-hidden
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">
                      <span className="sr-only">Passo {index + 1}: </span>
                      {step.title}
                    </span>
                    <StepTag step={step} />
                  </div>
                  <span className="text-xs break-words text-muted-foreground">{step.source}</span>
                  <p className="text-sm leading-relaxed text-foreground/85">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <Link
          href="/painel/copiloto"
          className="group flex items-center gap-3 rounded-lg bg-ink px-3.5 py-3 ring-1 ring-white/[0.07] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-crimson/15 text-rubi ring-1 ring-crimson/35">
            <LifeBuoy className="size-4" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">Plano completo no copiloto, com a notificação LGPD pronta</span>
            <span className="font-mono text-[11px] tracking-wider text-rubi">T+15MIN · T+1H · T+24H</span>
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </Link>
      </CardContent>
    </Card>
  );
}
