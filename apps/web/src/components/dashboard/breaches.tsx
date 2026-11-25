import { BellRing, Database, EyeOff, FileText, FlaskConical, ShieldCheck, TriangleAlert } from "lucide-react";
import { openBreachPlan } from "@/app/painel/copiloto/actions";
import { ArrivalForm } from "@/components/copilot/arrival-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BreachItem } from "@/lib/dashboard";
import { formatCalendarDate, formatDate, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ASSET_META, HIGH_WEIGHT, dataClassTone } from "./styles";

/** Iniciais da empresa para o selo do card (ignora o "(fictícia)"). */
function companyInitials(company: string): string {
  const words = company.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function DateItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="eyebrow text-[10px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] text-foreground/90">{value}</dd>
    </div>
  );
}

function BreachCard({ breach }: { breach: BreachItem }) {
  const sortedClasses = [...breach.dataClasses].sort((a, b) => b.weight - a.weight);
  const titleId = `vazamento-${breach.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-xl p-4 ring-1 ring-inset sm:p-5",
        breach.isNew ? "bg-danger/[0.05] ring-danger/35" : "bg-white/[0.015] ring-white/[0.08]",
      )}
    >
      {breach.isNew && <span className="absolute inset-y-0 left-0 w-[3px] bg-danger" aria-hidden />}

      <header className="flex items-start gap-3.5">
        <span
          className={cn(
            "hidden size-10 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-xs font-semibold ring-1 sm:flex",
            breach.isNew ? "text-danger ring-danger/30" : "text-muted-foreground ring-white/[0.08]",
          )}
          aria-hidden
        >
          {companyInitials(breach.company)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="font-semibold tracking-tight">
              {breach.company}
            </h3>
            {breach.isNew && (
              <span className="flex items-center gap-1 rounded-full bg-danger/15 px-2 py-px font-mono text-[10px] font-semibold tracking-wider text-danger uppercase ring-1 ring-danger/35">
                <BellRing className="size-3" aria-hidden />
                Novo
              </span>
            )}
            {breach.isSynthetic && (
              <span className="flex items-center gap-1 rounded-full px-2 py-px font-mono text-[10px] tracking-wider text-muted-foreground uppercase ring-1 ring-white/10 ring-inset">
                <FlaskConical className="size-3" aria-hidden />
                Sintético
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{breach.description}</p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-ink px-3.5 py-2.5 ring-1 ring-white/[0.05]">
        <DateItem label="Ocorreu" value={formatMonth(breach.occurredAt)} />
        <DateItem
          label="Divulgado"
          value={breach.disclosedAt ? formatCalendarDate(breach.disclosedAt) : "Ainda não"}
        />
        <DateItem label="Detectado" value={formatDate(breach.detectedAt)} />
      </dl>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="eyebrow text-[10px] text-muted-foreground">Seus dados encontrados</span>
          <ul className="flex flex-col gap-1.5">
            {breach.assets.map((asset) => {
              const { label, icon: Icon } = ASSET_META[asset.type];
              return (
                <li key={`${asset.type}-${asset.masked}`} className="flex min-w-0 items-center gap-2 text-sm">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="truncate font-mono text-xs">{asset.masked}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="eyebrow text-[10px] text-muted-foreground">Categorias expostas</span>
          <ul className="flex flex-wrap gap-1.5">
            {sortedClasses.map((item) => {
              const high = item.weight >= HIGH_WEIGHT;
              return (
                <li
                  key={item.key}
                  title={item.why}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1",
                    dataClassTone(item.weight),
                  )}
                >
                  {high && <TriangleAlert className="size-3" aria-hidden />}
                  {item.label}
                  {high && <span className="sr-only"> (dado sensível)</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {breach.isNew ? "Comece por aqui: o plano diz o que fazer agora." : "Plano de 15 min, 1 h e 24 h, com a notificação LGPD."}
        </span>
        <ArrivalForm action={openBreachPlan.bind(null, breach.id)} className="w-full sm:w-auto">
          <SubmitButton
            variant={breach.isNew ? "default" : "outline"}
            size="lg"
            pendingText="Abrindo o plano..."
            className="w-full sm:w-auto"
            aria-describedby={titleId}
          >
            <FileText aria-hidden />
            Plano de resposta
          </SubmitButton>
        </ArrivalForm>
      </footer>
    </article>
  );
}

export function BreachesSection({ breaches }: { breaches: BreachItem[] }) {
  return (
    <Card id="vazamentos" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <Database className="size-4" aria-hidden />
          </span>
          Vazamentos com seus dados
          {breaches.length > 0 && (
            <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">({breaches.length})</span>
          )}
        </CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Mostramos a fonte, as datas e as categorias expostas. Nunca o dado vazado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {breaches.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm ring-1 ring-success/30">
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
            Nenhum vazamento encontrado com os seus dados. Avisaremos se surgir algum.
          </p>
        ) : (
          breaches.map((breach) => <BreachCard key={breach.id} breach={breach} />)
        )}
        {breaches.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="size-3 shrink-0 text-danger" aria-hidden />
            Dado sensível: é o que mais pesa no score.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
