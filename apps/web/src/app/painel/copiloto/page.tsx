import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight, FileWarning, Info, ScanSearch, ScanText, UserRound } from "lucide-react";
import { openBreachPlan } from "./actions";
import { ProgressBar } from "@/components/copilot/plan";
import { PHASE_DOT } from "@/components/copilot/phase-style";
import { ReportForm } from "@/components/copilot/report-form";
import { ErrorState } from "@/components/shell/error-state";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchIncidents, type IncidentListItem, type LgpdStatus } from "@/lib/incidents";
import { formatDate } from "@/lib/format";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Copiloto · Radar360" };

const LGPD_BADGE: Record<LgpdStatus, { label: string; className: string }> = {
  not_sent: { label: "LGPD: a enviar", className: "bg-muted text-muted-foreground ring-border" },
  waiting: { label: "LGPD: aguardando", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  overdue: { label: "LGPD: prazo vencido", className: "bg-red-50 text-red-700 ring-red-200" },
  answered: { label: "LGPD: respondida", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

/** Resumo visual do que o plano entrega (os mesmos três tempos das fases). */
const PLAN_PREVIEW = [
  { key: "now" as const, label: "Agora", window: "15 min" },
  { key: "hour" as const, label: "Primeira hora", window: "1 h" },
  { key: "day" as const, label: "Próximas 24 h", window: "24 h" },
];

function IncidentRow({ incident }: { incident: IncidentListItem }) {
  const Icon = incident.source === "DETECTED" ? ScanSearch : UserRound;
  return (
    <li>
      <Link
        href={`/painel/copiloto/${incident.id}`}
        className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center self-start rounded-lg bg-muted text-foreground/70">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{incident.title}</span>
            {incident.lgpdStatus && (
              <span
                className={cn(
                  "rounded-full px-2 py-px text-[11px] font-medium ring-1 ring-inset",
                  LGPD_BADGE[incident.lgpdStatus].className,
                )}
              >
                {LGPD_BADGE[incident.lgpdStatus].label}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {incident.source === "DETECTED" ? "Detectado pelo monitoramento" : "Relatado por você"} ·{" "}
            {formatDate(incident.createdAt)}
          </span>
          <ProgressBar done={incident.progress.done} total={incident.progress.total} />
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}

export default async function CopilotPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const token = await getSessionToken();
  if (!token) redirect("/");

  const [result, { erro }] = await Promise.all([fetchIncidents(token), searchParams]);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");

  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar o copiloto" retryHref="/painel/copiloto" />;
  }

  const { incidents, breachesWithoutPlan } = result.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <span className="eyebrow text-brand">Resposta a incidentes</span>
          <h1 className="text-3xl font-semibold tracking-tight">Copiloto de resposta a incidentes</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Conte o que aconteceu ou escolha um vazamento detectado. Você recebe um plano para os próximos 15 minutos,
            1 hora e 24 horas e, quando há uma empresa envolvida, a notificação LGPD pronta.
          </p>
        </div>
        <ol className="flex flex-wrap gap-2" aria-label="O que o plano traz">
          {PLAN_PREVIEW.map((phase) => (
            <li
              key={phase.key}
              className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs shadow-xs ring-1 ring-border"
            >
              <span className={cn("size-1.5 rounded-full", PHASE_DOT[phase.key])} aria-hidden />
              <span className="font-mono font-medium">{phase.window}</span>
              <span className="text-muted-foreground">{phase.label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs text-ink-foreground">
            <ScanText className="size-3.5 text-signal" aria-hidden />
            Notificação LGPD
          </li>
        </ol>
      </div>

      {erro === "plano" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Não conseguimos abrir o plano desse vazamento agora. Tente de novo em instantes.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">O que aconteceu?</CardTitle>
            <CardDescription>
              Golpe do Pix, celular roubado, WhatsApp clonado, link falso ou conta aberta em seu nome.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportForm />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {breachesWithoutPlan.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-signal">
                    <ScanSearch className="size-4" aria-hidden />
                  </span>
                  Vazamentos sem plano
                </CardTitle>
                <CardDescription>Detectados pelo monitoramento com os seus dados.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {breachesWithoutPlan.map((breach) => (
                    <li
                      key={breach.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset",
                        breach.isNew ? "bg-red-50/60 ring-red-200" : "ring-border",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {breach.company}
                          {breach.isNew && (
                            <span className="rounded-full bg-red-600 px-2 py-px text-[11px] font-semibold text-white">
                              Novo
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Detectado em {formatDate(breach.detectedAt)}
                        </span>
                      </div>
                      <form action={openBreachPlan.bind(null, breach.id)} className="shrink-0">
                        <SubmitButton size="sm" variant={breach.isNew ? "default" : "outline"} pendingText="Abrindo...">
                          Gerar plano
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-signal">
                  <FileWarning className="size-4" aria-hidden />
                </span>
                Seus incidentes
              </CardTitle>
              <CardDescription>Planos em andamento e o prazo de cada notificação.</CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum incidente ainda. Quando você relatar algo ou abrir o plano de um vazamento, ele aparece aqui.
                </p>
              ) : (
                <ul className="-mx-3 flex flex-col">
                  {incidents.map((incident) => (
                    <IncidentRow key={incident.id} incident={incident} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Radar360 · Orientações informativas, baseadas em fontes oficiais. Não é assessoria jurídica.
      </p>
    </main>
  );
}
