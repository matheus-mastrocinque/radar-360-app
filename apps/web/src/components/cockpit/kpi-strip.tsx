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

/** Faixa de telemetria: os cinco números do painel, cada um abre o seu detalhe. */
export function KpiStrip({ dashboard, accounts }: { dashboard: Dashboard; accounts: AccountList | null }) {
  const { summary } = dashboard;
  const allVerified = summary.verifiedAssets === summary.assets;
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
    {
      target: "accounts",
      label: "Contas acompanhadas",
      value: accounts?.summary.accounts ?? 0,
      hint: withBreaches > 0 ? `${withBreaches} com vazamento público` : "nenhuma com vazamento",
      tone: withBreaches > 0 ? "warning" : "muted",
    },
    {
      target: "assets",
      label: "Dados vigiados",
      value: summary.assets,
      hint: allVerified ? "todos verificados" : `${summary.verifiedAssets} verificados`,
      tone: allVerified ? "success" : "muted",
    },
  ];

  return (
    <nav
      aria-label="Resumo do painel"
      className="-mx-4 flex snap-x gap-px overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-hidden sm:rounded-xl sm:bg-white/[0.06] sm:px-0 sm:ring-1 sm:ring-white/[0.07]"
    >
      {kpis.map((kpi) => (
        <InspectTrigger
          key={kpi.target}
          target={kpi.target}
          className="group flex min-w-[150px] shrink-0 snap-start flex-col gap-1 rounded-xl bg-card/80 px-4 py-3 text-left ring-1 ring-white/[0.07] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset max-sm:mr-2 sm:min-w-0 sm:rounded-none sm:ring-0"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="eyebrow truncate text-[9.5px] text-muted-foreground">{kpi.label}</span>
            <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[kpi.tone])} aria-hidden />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums">{kpi.value}</span>
            <span className={cn("truncate text-[11px] leading-tight", TONE_TEXT[kpi.tone])}>{kpi.hint}</span>
          </span>
        </InspectTrigger>
      ))}
    </nav>
  );
}
