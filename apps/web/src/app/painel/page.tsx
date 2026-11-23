import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FlaskConical, LogOut, Radar } from "lucide-react";
import { logout } from "@/app/actions";
import { AssetsCard } from "@/components/dashboard/assets";
import { BreachesSection } from "@/components/dashboard/breaches";
import { NetworkSection } from "@/components/dashboard/network";
import { FirstSteps, StatTiles } from "@/components/dashboard/overview";
import { ScoreBreakdown } from "@/components/dashboard/score-breakdown";
import { ScoreCard } from "@/components/dashboard/score-card";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { fetchDashboard } from "@/lib/dashboard";
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

  const result = await fetchDashboard(token);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");

  if (!result.ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Radar className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Não conseguimos carregar o seu painel</h1>
        <p className="text-sm text-muted-foreground">A API não respondeu. Tente de novo em alguns segundos.</p>
        <Link href="/painel" className={buttonVariants({ variant: "outline" })}>
          Tentar de novo
        </Link>
      </div>
    );
  }

  const dashboard = result.data;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Radar className="size-5" aria-hidden />
            Radar360
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{dashboard.user.name}</span>
            <form action={logout}>
              <SubmitButton variant="outline" size="sm" pendingText="Saindo...">
                <LogOut aria-hidden />
                Sair
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>

      {dashboard.user.isDemo && (
        <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm sm:px-6">
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">Você está na demo.</span> A persona, os vazamentos e as redes são
              fictícios: nada aqui é dado real.
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName(dashboard.user.name)}</h1>
          <p className="text-sm text-muted-foreground">
            Este é o resumo da sua exposição. Atualizado em {formatDateTime(dashboard.generatedAt)}.
          </p>
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

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Radar360 · Hack Brasil 2026. As orientações são informativas e não são assessoria jurídica.
      </footer>
    </div>
  );
}
