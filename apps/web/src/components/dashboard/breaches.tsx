import { CalendarClock, EyeOff, FileText, IdCard, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function BreachCard({ breach }: { breach: BreachItem }) {
  const sortedClasses = [...breach.dataClasses].sort((a, b) => b.weight - a.weight);
  return (
    <article className={cn("flex flex-col gap-4 rounded-lg border p-4", breach.isNew && "border-red-200 bg-red-50/30")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{breach.company}</h3>
            {breach.isNew && (
              <span className="rounded-full bg-red-600 px-2 py-px text-[11px] font-semibold text-white">Novo</span>
            )}
            {breach.isSynthetic && (
              <span className="rounded-full px-2 py-px text-[11px] text-muted-foreground ring-1 ring-border">
                Incidente sintético
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{breach.description}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          Detectado em {formatDate(breach.detectedAt)}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Seus dados encontrados</span>
          <ul className="flex flex-col gap-1.5">
            {breach.assets.map((asset) => {
              const { label, icon: Icon } = ASSET_META[asset.type];
              return (
                <li key={`${asset.type}-${asset.masked}`} className="flex items-center gap-2 text-sm">
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs">{asset.masked}</span>
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

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          Ocorreu em {formatMonth(breach.occurredAt)} ·{" "}
          {breach.disclosedAt
            ? `divulgado pela empresa em ${formatCalendarDate(breach.disclosedAt)}`
            : "ainda não divulgado pela empresa"}
        </span>
        <Button variant="outline" size="sm" disabled title="Plano de resposta e notificação LGPD: em breve">
          <FileText aria-hidden />
          Gerar plano de resposta (em breve)
        </Button>
      </footer>
    </article>
  );
}

export function BreachesSection({ breaches }: { breaches: BreachItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vazamentos com seus dados</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <EyeOff className="size-3.5 shrink-0" aria-hidden />
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
