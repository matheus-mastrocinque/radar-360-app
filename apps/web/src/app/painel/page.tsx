import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { ActionQueue } from "@/components/cockpit/action-queue";
import { ActivityFeed } from "@/components/cockpit/activity-feed";
import { AgentPanel } from "@/components/cockpit/agent-panel";
import { buildPanels } from "@/components/cockpit/details";
import { ExposureMapPanel } from "@/components/cockpit/exposure-map";
import { InspectorProvider } from "@/components/cockpit/inspector";
import { KpiStrip } from "@/components/cockpit/kpi-strip";
import { buildActionSteps, buildActivity, buildExposureMap, MAP_TALL, MAP_WIDE } from "@/components/cockpit/model";
import { LiveDot } from "@/components/cockpit/panel";
import { ScorePanel } from "@/components/cockpit/score-panel";
import { LEVEL_STYLE } from "@/components/dashboard/styles";
import { ErrorState } from "@/components/shell/error-state";
import { buttonVariants } from "@/components/ui/button";
import { fetchAccounts } from "@/lib/accounts";
import { fetchDashboardOnce } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Central de comando · Olharium" };

function firstName(name: string | null): string {
  return name?.split(" ")[0] ?? "você";
}

/*
 * Central de comando: tudo numa tela. Score, mapa de exposição, fila de ação, agente e linha do tempo
 * ficam visíveis juntos; o detalhe de qualquer ponto abre numa gaveta lateral, sem sair da página.
 */
export default async function PainelPage() {
  const token = await getSessionToken();
  if (!token) redirect("/");

  // "Minhas contas" é um extra: se a chamada falhar, o painel segue sem esse bloco.
  const [result, accountsResult] = await Promise.all([fetchDashboardOnce(token), fetchAccounts(token)]);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");

  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar o seu painel" retryHref="/painel" />;
  }

  const dashboard = result.data;
  const accounts = accountsResult.ok ? accountsResult.data : null;
  const steps = buildActionSteps(dashboard);
  const level = LEVEL_STYLE[dashboard.score.level];

  return (
    <InspectorProvider panels={buildPanels(dashboard, accounts)}>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span className="eyebrow text-rubi">Central de comando</span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5 text-success">
                <LiveDot />
                Monitoramento ativo
              </span>
              <span aria-hidden>·</span>
              <span>checagem a cada 6 h</span>
              <span aria-hidden className="max-sm:hidden">
                ·
              </span>
              <span className="max-sm:hidden">atualizado em {formatDateTime(dashboard.generatedAt)}</span>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              Olá, {firstName(dashboard.user.name)}.{" "}
              <span className="text-muted-foreground">
                Risco <span className={level.text}>{level.label.replace("Risco ", "")}</span>
                {steps.length > 0 ? `, ${steps.length} ${steps.length === 1 ? "ação" : "ações"} na fila.` : ", nada urgente."}
              </span>
            </h1>
          </div>
          <Link
            href="/painel/copiloto"
            className={cn(buttonVariants({ size: "lg" }), "glow-crimson h-10 w-full shrink-0 px-4 sm:w-auto")}
          >
            <LifeBuoy aria-hidden />
            Relatar um incidente
          </Link>
        </div>

        <KpiStrip dashboard={dashboard} accounts={accounts} />

        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          <ScorePanel score={dashboard.score} className="order-1 lg:order-none lg:col-start-1 lg:row-start-1" />
          <ExposureMapPanel
            wide={buildExposureMap(dashboard, accounts, MAP_WIDE)}
            tall={buildExposureMap(dashboard, accounts, MAP_TALL)}
            className="order-3 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1"
          />
          <ActionQueue
            steps={steps}
            className="order-2 max-h-[560px] lg:order-none lg:col-start-2 lg:row-start-3 xl:col-start-3 xl:row-start-1 xl:h-0 xl:max-h-none xl:min-h-full"
          />
          <AgentPanel dashboard={dashboard} className="order-4 lg:order-none lg:col-start-1 lg:row-start-2" />
          <ActivityFeed
            items={buildActivity(dashboard)}
            now={dashboard.generatedAt}
            className="order-5 max-h-[440px] lg:order-none lg:col-start-1 lg:row-start-3 xl:col-start-3 xl:row-start-2 xl:h-0 xl:max-h-none xl:min-h-full"
          />
        </div>
      </main>
    </InspectorProvider>
  );
}
