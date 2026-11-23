import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Bot, CalendarClock, EyeOff, Radar, ScanSearch, UserRound } from "lucide-react";
import { LgpdPanel } from "@/components/copilot/lgpd-panel";
import { ResponsePlan } from "@/components/copilot/plan";
import { dataClassTone } from "@/components/dashboard/styles";
import { buttonVariants } from "@/components/ui/button";
import { fetchIncident, type IncidentView } from "@/lib/incidents";
import { formatCalendarDate, formatDate, formatMonth } from "@/lib/format";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Plano de resposta · Radar360" };

const CLASSIFIED_BY: Record<IncidentView["classifiedBy"], { label: string; icon: typeof Bot }> = {
  SYSTEM: { label: "Detectado pelo monitoramento", icon: ScanSearch },
  USER: { label: "Tipo escolhido por você", icon: UserRound },
  AI: { label: "Tipo identificado pela IA (Gemini)", icon: Bot },
  RULES: { label: "Tipo identificado por palavras-chave", icon: Bot },
};

function BreachFacts({ breach }: { breach: NonNullable<IncidentView["breach"]> }) {
  const sorted = [...breach.dataClasses].sort((a, b) => b.weight - a.weight);
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Ocorreu em {formatMonth(breach.occurredAt)}</span>
        <span>
          {breach.disclosedAt
            ? `Divulgado pela empresa em ${formatCalendarDate(breach.disclosedAt)}`
            : "Ainda não divulgado pela empresa"}
        </span>
        {breach.isSynthetic && (
          <span className="rounded-full px-2 py-px ring-1 ring-border">Incidente sintético</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <EyeOff className="size-3.5" aria-hidden />
          Categorias expostas (nunca o dado vazado)
        </span>
        <ul className="flex flex-wrap gap-1.5">
          {sorted.map((item) => (
            <li
              key={item.key}
              title={item.why}
              className={cn("rounded-md px-2 py-0.5 text-xs font-medium ring-1", dataClassTone(item.weight))}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) redirect("/");

  const { id } = await params;
  const result = await fetchIncident(token, id);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");
  if (!result.ok && result.reason === "not_found") notFound();

  if (!result.ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Radar className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Não conseguimos carregar o plano</h1>
        <p className="text-sm text-muted-foreground">A API não respondeu. Tente de novo em alguns segundos.</p>
        <Link href={`/painel/copiloto/${id}`} className={buttonVariants({ variant: "outline" })}>
          Tentar de novo
        </Link>
      </div>
    );
  }

  const incident = result.data;
  const origin = CLASSIFIED_BY[incident.classifiedBy];
  const OriginIcon = origin.icon;

  return (
    <div className="min-h-screen bg-muted/40">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Link
          href="/painel/copiloto"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Copiloto
        </Link>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">
              {incident.typeLabel}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <OriginIcon className="size-3.5" aria-hidden />
              {origin.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden />
              Aberto em {formatDate(incident.createdAt)}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{incident.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{incident.summary ?? incident.typeDescription}</p>

          {incident.flags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="O que o seu relato indica">
              {incident.flags.map((flag) => (
                <li
                  key={flag.key}
                  className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
                >
                  {flag.label}
                </li>
              ))}
            </ul>
          )}

          {incident.narrative && (
            <details className="max-w-3xl text-sm">
              <summary className="cursor-pointer text-xs font-medium text-foreground/70 select-none hover:text-foreground">
                Seu relato (sem dados pessoais)
              </summary>
              <p className="mt-2 rounded-lg bg-background p-3 whitespace-pre-wrap text-muted-foreground ring-1 ring-border">
                {incident.narrative}
              </p>
            </details>
          )}
        </header>

        {incident.breach && <BreachFacts breach={incident.breach} />}

        <ResponsePlan incident={incident} />

        {incident.lgpd && <LgpdPanel incident={incident} lgpd={incident.lgpd} />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Radar360 · {incident.disclaimer}
      </footer>
    </div>
  );
}
