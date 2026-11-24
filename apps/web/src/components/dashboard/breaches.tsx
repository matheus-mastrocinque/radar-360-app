import { CalendarClock, EyeOff, FileText, IdCard, Mail, Phone } from "lucide-react";
import { openBreachPlan } from "@/app/painel/copiloto/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetType, BreachItem } from "@/lib/dashboard";
import { formatCalendarDate, formatDate, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dataClassTone } from "./styles";

export const ASSET_META: Record<AssetType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  EMAIL: { label: "E-mail", icon: Mail },
  CPF: { label: "CPF", icon: IdCard },
  PHONE: { label: "Telefone", icon: Phone },
};

/** Iniciais da empresa para o selo do card (ignora o "(fictícia)"). */
function companyInitials(company: string): string {
  const words = company.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function BreachCard({ breach }: { breach: BreachItem }) {
  const sortedClasses = [...breach.dataClasses].sort((a, b) => b.weight - a.weight);
  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-card p-4 sm:p-5",
        breach.isNew && "border-red-200 bg-gradient-to-br from-red-50/70 via-card to-card",
      )}
    >
      {breach.isNew && <span className="absolute inset-y-0 left-0 w-1 bg-red-500" aria-hidden />}
      <header className="flex items-start gap-3.5">
        <span
          className={cn(
            "hidden size-10 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold sm:flex",
            breach.isNew ? "bg-red-100 text-red-700" : "bg-muted text-foreground/70",
          )}
          aria-hidden
        >
          {companyInitials(breach.company)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-tight">{breach.company}</h3>
            {breach.isNew && (
              <span className="rounded-full bg-red-600 px-2 py-px text-[11px] font-semibold text-white">Novo</span>
            )}
            {breach.isSynthetic && (
              <span className="rounded-full px-2 py-px text-[11px] text-muted-foreground ring-1 ring-border ring-inset">
                Incidente sintético
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{breach.description}</p>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden />
            Detectado em {formatDate(breach.detectedAt)}
          </span>
        </div>
      </header>

      <div className="grid gap-4 rounded-lg bg-muted/50 p-3.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Seus dados encontrados</span>
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
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Categorias expostas no vazamento</span>
          <ul className="flex flex-wrap gap-1.5">
            {sortedClasses.map((item) => (
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

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Ocorreu em {formatMonth(breach.occurredAt)} ·{" "}
          {breach.disclosedAt
            ? `divulgado pela empresa em ${formatCalendarDate(breach.disclosedAt)}`
            : "ainda não divulgado pela empresa"}
        </span>
        <form action={openBreachPlan.bind(null, breach.id)}>
          <SubmitButton variant={breach.isNew ? "default" : "outline"} size="sm" pendingText="Abrindo o plano...">
            <FileText aria-hidden />
            Plano de resposta
          </SubmitButton>
        </form>
      </footer>
    </article>
  );
}

export function BreachesSection({ breaches }: { breaches: BreachItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vazamentos com seus dados</CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Mostramos a fonte, as datas e as categorias expostas. Nunca o dado vazado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {breaches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum vazamento encontrado com os seus dados. Avisaremos se surgir algum.
          </p>
        ) : (
          breaches.map((breach) => <BreachCard key={breach.id} breach={breach} />)
        )}
      </CardContent>
    </Card>
  );
}
