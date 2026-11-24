import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bot, CalendarClock, ChevronRight, EyeOff, Info, ScanSearch, UserRound } from "lucide-react";
import { LgpdPanel } from "@/components/copilot/lgpd-panel";
import { ResponsePlan } from "@/components/copilot/plan";
import { dataClassTone } from "@/components/dashboard/styles";
import { ErrorState } from "@/components/shell/error-state";
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
    <div className="grid gap-px overflow-hidden rounded-xl bg-border shadow-xs ring-1 ring-border sm:grid-cols-[auto_auto_minmax(0,1fr)]">
      <div className="flex flex-col gap-1 bg-card px-4 py-3">
        <span className="text-xs text-muted-foreground">Ocorreu em</span>
        <span className="text-sm font-medium">{formatMonth(breach.occurredAt)}</span>
      </div>
      <div className="flex flex-col gap-1 bg-card px-4 py-3">
        <span className="text-xs text-muted-foreground">Divulgação pela empresa</span>
        <span className="text-sm font-medium">
          {breach.disclosedAt ? formatCalendarDate(breach.disclosedAt) : "Ainda não divulgado pela empresa"}
        </span>
      </div>
      <div className="flex flex-col gap-2 bg-card px-4 py-3">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <EyeOff className="size-3.5" aria-hidden />
          Categorias expostas (nunca o dado vazado)
          {breach.isSynthetic && (
            <span className="rounded-full px-2 py-px ring-1 ring-border ring-inset">Incidente sintético</span>
          )}
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
    return <ErrorState title="Não conseguimos carregar o plano" retryHref={`/painel/copiloto/${id}`} />;
  }

  const incident = result.data;
  const origin = CLASSIFIED_BY[incident.classifiedBy];
  const OriginIcon = origin.icon;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-5">
        <nav aria-label="Trilha" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/painel/copiloto" className="rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            Copiloto
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="truncate text-foreground" aria-current="page">
            Plano de resposta
          </span>
        </nav>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-ink-foreground">
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
          <h1 className="text-3xl font-semibold tracking-tight">{incident.title}</h1>
          <p className="max-w-3xl leading-relaxed text-muted-foreground">
            {incident.summary ?? incident.typeDescription}
          </p>

          {incident.flags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="O que o seu relato indica">
              {incident.flags.map((flag) => (
                <li
                  key={flag.key}
                  className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset"
                >
                  {flag.label}
                </li>
              ))}
            </ul>
          )}

          {incident.narrative && (
            <details className="group max-w-3xl text-sm">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-foreground/70 select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
                Seu relato (sem dados pessoais)
              </summary>
              <p className="mt-2 rounded-lg bg-card p-3 whitespace-pre-wrap text-muted-foreground ring-1 ring-border">
                {incident.narrative}
              </p>
            </details>
          )}
        </header>

        {incident.breach && <BreachFacts breach={incident.breach} />}
      </div>

      <ResponsePlan incident={incident} />

      {incident.lgpd && <LgpdPanel incident={incident} lgpd={incident.lgpd} />}

      <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Radar360 · {incident.disclaimer}
      </p>
    </main>
  );
}
