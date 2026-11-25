import { AlertTriangle, CheckCircle2, KeyRound, Layers, Minus, type LucideIcon } from "lucide-react";
import type { AccountList } from "@/lib/accounts";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function Readout({
  value,
  label,
  tone,
  status,
  statusIcon: StatusIcon,
}: {
  value: number;
  label: string;
  tone: Tone;
  status: string;
  statusIcon: LucideIcon;
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2 sm:px-5 sm:py-5">
      <span
        className={cn("w-12 shrink-0 font-mono text-3xl leading-none font-semibold tabular-nums sm:w-auto sm:text-4xl", TONE_TEXT[tone])}
        aria-hidden
      >
        {pad(value)}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          <span className="sr-only">{value} </span>
          {label}
        </span>
        <span className={cn("flex items-center gap-1.5 text-xs", tone === "neutral" ? "text-muted-foreground" : TONE_TEXT[tone])}>
          <StatusIcon className="size-3.5 shrink-0" aria-hidden />
          {status}
        </span>
      </span>
    </li>
  );
}

/** Leitura da lista: o único bloco com HUD forte da tela. */
export function AccountsSummary({ accounts, summary }: Pick<AccountList, "accounts" | "summary">) {
  const financial = accounts.filter((account) => account.isFinancial).length;

  return (
    <section aria-labelledby="resumo-contas" className="hud-corners p-1.5 [--hud-color:color-mix(in_oklab,var(--rubi)_75%,transparent)]">
      <div className="relative overflow-hidden rounded-lg bg-card ring-1 ring-white/[0.07]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid opacity-70 [mask-image:linear-gradient(to_right,black,transparent_85%)]"
        />
        <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
          <h2 id="resumo-contas" className="eyebrow text-rubi">
            Resumo da sua lista
          </h2>
          <span className="eyebrow hidden text-muted-foreground sm:inline">Catálogo HIBP · só metadados</span>
        </div>
        <ul className="relative grid divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Readout
            value={summary.accounts}
            label={summary.accounts === 1 ? "serviço na lista" : "serviços na lista"}
            tone="neutral"
            status={summary.accounts === 0 ? "Adicione o primeiro serviço" : "Cruzados com vazamentos públicos"}
            statusIcon={Layers}
          />
          <Readout
            value={summary.withBreaches}
            label="com vazamento conhecido"
            tone={summary.withBreaches > 0 ? "danger" : summary.accounts > 0 ? "success" : "neutral"}
            status={
              summary.withBreaches > 0
                ? `Risco: ${plural(summary.breaches, "vazamento real", "vazamentos reais")}`
                : summary.accounts > 0
                  ? "Nenhum no catálogo público"
                  : "Nada para cruzar ainda"
            }
            statusIcon={summary.withBreaches > 0 ? AlertTriangle : summary.accounts > 0 ? CheckCircle2 : Minus}
          />
          <Readout
            value={summary.financialWithoutTwoFactor}
            label={summary.financialWithoutTwoFactor === 1 ? "financeiro sem duas etapas" : "financeiros sem duas etapas"}
            tone={summary.financialWithoutTwoFactor > 0 ? "warning" : financial > 0 ? "success" : "neutral"}
            status={
              summary.financialWithoutTwoFactor > 0
                ? "Atenção: ative a verificação"
                : financial > 0
                  ? "Todos com verificação marcada"
                  : "Nenhum financeiro marcado"
            }
            statusIcon={summary.financialWithoutTwoFactor > 0 ? KeyRound : financial > 0 ? CheckCircle2 : Minus}
          />
        </ul>
      </div>
    </section>
  );
}
