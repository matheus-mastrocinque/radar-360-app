import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { AssetsCard } from "@/components/dashboard/assets";
import { BreachesSection } from "@/components/dashboard/breaches";
import { NetworkSection } from "@/components/dashboard/network";
import { FirstSteps, StatTiles } from "@/components/dashboard/overview";
import { ScoreBreakdown } from "@/components/dashboard/score-breakdown";
import { ScoreCard } from "@/components/dashboard/score-card";
import { ErrorState } from "@/components/shell/error-state";
import { buttonVariants } from "@/components/ui/button";
import { fetchDashboardOnce } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Painel · Radar360" };

function firstName(name: string | null): string {
  return name?.split(" ")[0] ?? "você";
}

export default async function PainelPage() {
  const token = await getSessionToken();
  if (!token) redirect("/");

  const result = await fetchDashboardOnce(token);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");

  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar o seu painel" retryHref="/painel" />;
  }

  const dashboard = result.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-brand">Painel de exposição</span>
          <h1 className="text-3xl font-semibold tracking-tight">Olá, {firstName(dashboard.user.name)}</h1>
          <p className="text-sm text-muted-foreground">
            Este é o resumo da sua exposição. Atualizado em {formatDateTime(dashboard.generatedAt)}.
          </p>
        </div>
        <Link href="/painel/copiloto" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
          <LifeBuoy aria-hidden />
          Relatar um incidente
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ScoreCard score={dashboard.score} />
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <StatTiles summary={dashboard.summary} />
          <FirstSteps dashboard={dashboard} />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <BreachesSection breaches={dashboard.breaches} />
        </div>
        <AssetsCard assets={dashboard.assets} />
      </div>

      <NetworkSection network={dashboard.network} />

      <ScoreBreakdown score={dashboard.score} />
    </main>
  );
}
