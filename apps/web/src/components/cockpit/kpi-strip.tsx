import type { AccountList } from "@/lib/accounts";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import type { Tone } from "./model";
import { TONE_DOT, TONE_TEXT } from "./panel";

interface Kpi {
  target: string;
  label: string;
  value: number;
  hint: string;
  tone: Tone;
}

/*
 * Resumo do painel: os números de cada setor do mapa (identidade, contas, rede e agente), no rodapé
 * do próprio mapa. Cada um abre a lista completa na gaveta. Os dados vigiados abrem pelo "Você".
 */
export function KpiStrip({
  dashboard,
  accounts,
  className,
}: {
  dashboard: Dashboard;
  accounts: AccountList | null;
  className?: string;
}) {
  const { summary } = dashboard;
  const withBreaches = accounts?.summary.withBreaches ?? 0;
  const kpis: Kpi[] = [
    {
      target: "breaches",
      label: "Vazamentos",
      value: summary.breaches,
      hint: summary.newBreaches > 0 ? `${summary.newBreaches} novo em 7 dias` : "nenhum novo em 7 dias",
      tone: summary.newBreaches > 0 ? "danger" : "muted",
    },
    {
      target: "accounts",
      label: "Contas",
      value: accounts?.summary.accounts ?? 0,
      hint: withBreaches > 0 ? `${withBreaches} com vazamento público` : "nenhuma com vazamento",
      tone: withBreaches > 0 ? "warning" : "muted",
    },
    {
      target: "findings",
      label: "Alertas de rede",
      value: summary.importantNetworkAlerts,
      hint: summary.importantNetworkAlerts > 0 ? "médios ou mais graves" : "nenhum relevante",
      tone: summary.importantNetworkAlerts > 0 ? "warning" : "success",
    },
    {
      target: "fixes",
      label: "Correções do agente",
      value: summary.fixesApplied,
      hint: summary.fixesApplied > 0 ? "todas com o seu OK" : "nenhuma ainda",
      tone: summary.fixesApplied > 0 ? "success" : "muted",
    },
  ];

  return (
    <nav
      aria-label="Resumo do painel"
      className={cn(
        "grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.06] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {kpis.map((kpi) => (
        <InspectTrigger
          key={kpi.target}
          target={kpi.target}
          label={`${kpi.label}: ${kpi.value}, ${kpi.hint}`}
          className="group flex min-w-0 flex-col gap-1 bg-card px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-4"
        >
          <span className="flex items-start gap-2">
            <span className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", TONE_DOT[kpi.tone])} aria-hidden />
            <span className="eyebrow text-[9.5px] leading-tight tracking-[0.1em] text-muted-foreground group-hover:text-foreground">
              {kpi.label}
            </span>
          </span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="font-mono text-lg leading-none font-semibold tracking-tight tabular-nums">{kpi.value}</span>
            <span className={cn("truncate text-[11px] leading-tight", TONE_TEXT[kpi.tone])}>{kpi.hint}</span>
          </span>
        </InspectTrigger>
      ))}
    </nav>
  );
}
