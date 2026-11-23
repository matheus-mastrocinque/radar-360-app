import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, FileWarning, LifeBuoy, Radar, ScanSearch } from "lucide-react";
import { openBreachPlan } from "./actions";
import { ProgressBar } from "@/components/copilot/plan";
import { ReportForm } from "@/components/copilot/report-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
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

function IncidentRow({ incident }: { incident: IncidentListItem }) {
  return (
    <li>
      <Link
        href={`/painel/copiloto/${incident.id}`}
        className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{incident.title}</span>
            {incident.lgpdStatus && (
              <span
                className={cn(
                  "rounded-full px-2 py-px text-[11px] font-medium ring-1",
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
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Radar className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Não conseguimos carregar o copiloto</h1>
        <p className="text-sm text-muted-foreground">A API não respondeu. Tente de novo em alguns segundos.</p>
        <Link href="/painel/copiloto" className={buttonVariants({ variant: "outline" })}>
          Tentar de novo
        </Link>
      </div>
    );
  }

  const { incidents, breachesWithoutPlan } = result.data;

  return (
    <div className="min-h-screen bg-muted/40">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Link
          href="/painel"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao painel
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <LifeBuoy className="size-6 text-muted-foreground" aria-hidden />
            Copiloto de resposta a incidentes
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Conte o que aconteceu ou escolha um vazamento detectado. Você recebe um plano para os próximos 15 minutos,
            1 hora e 24 horas e, quando há uma empresa envolvida, a notificação LGPD pronta.
          </p>
        </div>

        {erro === "plano" && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            Não conseguimos abrir o plano desse vazamento agora. Tente de novo em instantes.
          </p>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-5">
          <Card className="min-w-0 lg:col-span-3">
            <CardHeader>
              <CardTitle>O que aconteceu?</CardTitle>
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
                  <CardTitle className="flex items-center gap-2">
                    <ScanSearch className="size-4 text-muted-foreground" aria-hidden />
                    Vazamentos sem plano
                  </CardTitle>
                  <CardDescription>Detectados pelo monitoramento com os seus dados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y">
                    {breachesWithoutPlan.map((breach) => (
                      <li key={breach.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
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
                        <form action={openBreachPlan.bind(null, breach.id)}>
                          <SubmitButton size="sm" variant="outline" pendingText="Abrindo...">
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
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="size-4 text-muted-foreground" aria-hidden />
                  Seus incidentes
                </CardTitle>
                <CardDescription>Planos em andamento e o prazo de cada notificação.</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
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
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Radar360 · Orientações informativas, baseadas em fontes oficiais. Não é assessoria jurídica.
      </footer>
    </div>
  );
}
