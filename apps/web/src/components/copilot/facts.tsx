import { AlertTriangle, ArrowUpRight, BadgeCheck, EyeOff, FlaskConical, Megaphone } from "lucide-react";
import type { DataClass } from "@/lib/dashboard";
import type { IncidentView } from "@/lib/incidents";
import { formatCalendarDate, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StateBadge } from "./status";

const NUMBER = new Intl.NumberFormat("pt-BR");

/** Categorias expostas (nunca o dado). Peso alto na tabela curada (≥ 10) ganha ícone e cor de perigo. */
export function DataClassChips({ items }: { items: DataClass[] }) {
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sorted.map((item) => {
        const high = item.weight >= 10;
        return (
          <li
            key={item.key}
            title={item.why}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1",
              high ? "bg-danger/10 text-danger ring-danger/40" : "bg-muted text-foreground ring-white/10",
            )}
          >
            {high && <AlertTriangle className="size-3" aria-hidden />}
            {item.label}
            {high && <span className="sr-only"> (dado sensível)</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-card px-4 py-3 sm:px-5", className)}>
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

function FactsFrame({
  badges,
  facts,
  classesLabel,
  dataClasses,
  footer,
}: {
  badges: React.ReactNode;
  facts: React.ReactNode;
  classesLabel: string;
  dataClasses: DataClass[];
  footer?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="fatos"
      className="overflow-hidden rounded-xl bg-card shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_16px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.07]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <h2 id="fatos" className="eyebrow text-foreground">
          Fatos do vazamento
        </h2>
        <div className="flex flex-wrap gap-1.5">{badges}</div>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-3">{facts}</dl>
      <div className="flex flex-col gap-2.5 border-t border-white/[0.06] px-4 py-4 sm:px-5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="size-3.5 shrink-0" aria-hidden />
          {classesLabel}
        </span>
        <DataClassChips items={dataClasses} />
      </div>
      {footer && (
        <div className="border-t border-white/[0.06] bg-ink/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Vazamento detectado (base sintética) ou do catálogo público do Have I Been Pwned. */
export function BreachFacts({ breach }: { breach: NonNullable<IncidentView["breach"]> }) {
  const fromCatalog = breach.source === "HIBP";
  return (
    <FactsFrame
      badges={
        <>
          {fromCatalog && (
            <StateBadge tone="info" icon={BadgeCheck}>
              Vazamento real
            </StateBadge>
          )}
          {breach.isSynthetic && (
            <StateBadge tone="neutral" icon={FlaskConical}>
              Incidente sintético
            </StateBadge>
          )}
        </>
      }
      facts={
        <>
          <Fact label="Empresa" className="col-span-2 sm:col-span-1">
            {breach.company}
            {breach.domain && (
              <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">{breach.domain}</span>
            )}
          </Fact>
          <Fact label="Ocorreu em">{formatMonth(breach.occurredAt)}</Fact>
          {fromCatalog ? (
            <Fact label="Contas afetadas">
              <span className="font-mono tabular-nums">
                {breach.pwnCount !== null ? NUMBER.format(breach.pwnCount) : "Não informado"}
              </span>
            </Fact>
          ) : (
            <Fact label="Divulgação pela empresa">
              {breach.disclosedAt ? formatCalendarDate(breach.disclosedAt) : "Ainda não divulgado pela empresa"}
            </Fact>
          )}
        </>
      }
      classesLabel="Categorias expostas: mostramos o tipo de dado, nunca o dado vazado"
      dataClasses={breach.dataClasses}
      footer={
        fromCatalog && breach.attribution ? (
          <>
            Fonte:{" "}
            <a
              href={breach.sourceUrl ?? breach.attribution.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded-sm font-medium text-telemetry underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              {breach.company} no {breach.attribution.label}
              <ArrowUpRight className="size-3" aria-hidden />
              <span className="sr-only">(abre em nova aba)</span>
            </a>{" "}
            (licença {breach.attribution.license}). O vazamento é do serviço; a notificação LGPD pede à empresa que
            confirme se a sua conta estava entre as afetadas.
          </>
        ) : null
      }
    />
  );
}

/** "Uma empresa me avisou": o que a própria empresa contou ao usuário. */
export function ReportedBreachFacts({ breach }: { breach: NonNullable<IncidentView["reportedBreach"]> }) {
  return (
    <FactsFrame
      badges={
        <StateBadge tone="neutral" icon={Megaphone}>
          A empresa avisou
        </StateBadge>
      }
      facts={
        <>
          <Fact label="Empresa" className="col-span-2 sm:col-span-1">
            {breach.company}
          </Fact>
          <Fact label="Ocorreu em">{breach.occurredAt ? formatMonth(breach.occurredAt) : "Data não informada"}</Fact>
          <Fact label="Origem">Aviso da empresa a você</Fact>
        </>
      }
      classesLabel="O que a empresa disse que vazou (categorias, nunca o dado)"
      dataClasses={breach.dataClasses}
    />
  );
}
