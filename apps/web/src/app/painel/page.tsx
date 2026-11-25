import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, LifeBuoy } from "lucide-react";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { AssetsCard } from "@/components/dashboard/assets";
import { BreachesSection } from "@/components/dashboard/breaches";
import { NetworkSection } from "@/components/dashboard/network";
import { FirstSteps, StatTiles } from "@/components/dashboard/overview";
import { ScoreBreakdown } from "@/components/dashboard/score-breakdown";
import { ScoreCard } from "@/components/dashboard/score-card";
import { ErrorState } from "@/components/shell/error-state";
import { buttonVariants } from "@/components/ui/button";
import { fetchAccounts } from "@/lib/accounts";
import { fetchDashboardOnce } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Painel · Olharium" };

function firstName(name: string | null): string {
  return name?.split(" ")[0] ?? "você";
}

export default async function PainelPage() {
  const token = await getSessionToken();
  if (!token) redirect("/");

  // "Minhas contas" é um extra: se a chamada falhar, o painel segue sem esse bloco.
  const [result, accounts] = await Promise.all([fetchDashboardOnce(token), fetchAccounts(token)]);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");

  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar o seu painel" retryHref="/painel" />;
  }

  const dashboard = result.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-rubi">Painel de exposição</span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Olá, {firstName(dashboard.user.name)}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>O resumo do que está exposto e do que fazer primeiro.</span>
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <Clock className="size-3.5" aria-hidden />
              Atualizado em {formatDateTime(dashboard.generatedAt)}
            </span>
          </p>
        </div>
        <Link
          href="/painel/copiloto"
          className={cn(buttonVariants({ size: "lg" }), "glow-crimson h-10 w-full px-4 sm:w-auto")}
        >
          <LifeBuoy aria-hidden />
          Relatar um incidente
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ScoreCard score={dashboard.score} />
        <div className="flex min-w-0 flex-col gap-4">
          <StatTiles summary={dashboard.summary} />
          <FirstSteps dashboard={dashboard} />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <BreachesSection breaches={dashboard.breaches} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <AssetsCard assets={dashboard.assets} isDemo={dashboard.user.isDemo} />
          {accounts.ok && <AccountsSummary data={accounts.data} />}
        </div>
      </div>

      <NetworkSection network={dashboard.network} />

      <ScoreBreakdown score={dashboard.score} />
    </main>
  );
}
