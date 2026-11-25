import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Landmark,
  LifeBuoy,
  Trash2,
} from "lucide-react";
import { removeAccount, setAccountFlag } from "@/app/painel/contas/actions";
import { openBreachPlan } from "@/app/painel/copiloto/actions";
import { ArrivalForm } from "@/components/copilot/arrival-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AccountBreach, AccountItem } from "@/lib/accounts";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const NUMBER = new Intl.NumberFormat("pt-BR");
/** Categorias visíveis por vazamento; o resto vira "+N" com a lista para leitores de tela. */
const MAX_CLASSES = 8;
/** Peso a partir do qual a categoria é sensível (tabela curada da API). */
const SENSITIVE_WEIGHT = 10;

/** Interruptor visual (decorativo): o estado vai em aria-pressed e na palavra ao lado. */
function SwitchGlyph({ on, tone }: { on: boolean; tone: "success" | "neutral" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full ring-1 transition-colors ring-inset motion-reduce:transition-none",
        on
          ? tone === "success"
            ? "bg-success/30 ring-success/60"
            : "bg-foreground/25 ring-foreground/50"
          : "bg-white/[0.04] ring-white/15",
      )}
    >
      <span
        className={cn(
          "size-3 rounded-full transition-transform motion-reduce:transition-none",
          on
            ? cn("translate-x-3.5", tone === "success" ? "bg-success" : "bg-foreground")
            : "translate-x-0.5 bg-muted-foreground/70",
        )}
      />
    </span>
  );
}

/** Botão de alternar (verificação em duas etapas / mexe com dinheiro). */
function FlagToggle({
  account,
  field,
  label,
  tone,
}: {
  account: AccountItem;
  field: "hasTwoFactor" | "isFinancial";
  label: string;
  tone: "success" | "neutral";
}) {
  const on = account[field];
  return (
    <form action={setAccountFlag.bind(null, account.id, field, !on)} className="min-w-0">
      <SubmitButton
        variant="ghost"
        pendingText="Salvando..."
        aria-pressed={on}
        className={cn(
          "h-auto min-h-9 w-full justify-start gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] whitespace-normal ring-1 sm:w-auto",
          on
            ? tone === "success"
              ? "bg-success/10 ring-success/30 hover:bg-success/15 dark:hover:bg-success/15"
              : "bg-muted ring-white/20 hover:bg-muted dark:hover:bg-white/[0.08]"
            : "bg-ink ring-white/10 hover:bg-muted dark:hover:bg-muted",
        )}
      >
        <SwitchGlyph on={on} tone={tone} />
        <span className="min-w-0 flex-1 text-foreground">{label}</span>
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tracking-wider uppercase",
            on ? (tone === "success" ? "text-success" : "text-foreground") : "text-muted-foreground",
          )}
        >
          {on ? "Sim" : "Não"}
        </span>
      </SubmitButton>
    </form>
  );
}

function BreachRow({ breach }: { breach: AccountBreach }) {
  const classes = [...breach.dataClasses].sort((a, b) => b.weight - a.weight);
  const visible = classes.slice(0, MAX_CLASSES);
  const hidden = classes.slice(MAX_CLASSES);
  return (
    <li className="relative overflow-hidden rounded-lg bg-ink p-3 pl-4 ring-1 ring-white/[0.06] sm:p-4 sm:pl-5">
      <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-danger/80" />

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-px font-mono text-[11px] tracking-wider text-danger uppercase ring-1 ring-danger/30">
          <AlertTriangle className="size-3" aria-hidden />
          Vazamento
        </span>
        <span className="text-sm font-medium">em {formatMonth(breach.occurredAt)}</span>
        {breach.pwnCount !== null && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {NUMBER.format(breach.pwnCount)} contas afetadas
          </span>
        )}
        {breach.isSynthetic && (
          <span className="rounded-full bg-muted px-2 py-px font-mono text-[11px] tracking-wider text-muted-foreground uppercase ring-1 ring-white/10">
            Sintético
          </span>
        )}
      </div>

      <p className="mt-3 mb-1.5 text-xs text-muted-foreground">O que vazou (categorias, nunca o dado):</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Categorias de dados expostas">
        {visible.map((item) => {
          const sensitive = item.weight >= SENSITIVE_WEIGHT;
          return (
            <li
              key={item.key}
              title={item.why}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium ring-1",
                sensitive ? "text-danger ring-danger/40" : "text-foreground ring-white/10",
              )}
            >
              {sensitive && <AlertTriangle className="size-3" aria-hidden />}
              {item.label}
              {sensitive && <span className="sr-only"> (dado sensível)</span>}
            </li>
          );
        })}
        {hidden.length > 0 && (
          <li
            title={hidden.map((item) => item.label).join(", ")}
            className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-white/10"
          >
            <span aria-hidden>+{hidden.length}</span>
            <span className="sr-only">e também: {hidden.map((item) => item.label).join(", ")}</span>
          </li>
        )}
      </ul>

      <div className="mt-3.5 flex flex-col gap-2.5 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
        {breach.sourceUrl ? (
          <a
            href={breach.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 rounded-sm text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Fonte: {breach.company} no Have I Been Pwned
            <ArrowUpRight className="ml-0.5 inline size-3 align-[-2px]" aria-hidden />
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Fonte: base sintética do Olharium</span>
        )}

        {breach.incidentId ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-px font-mono text-[11px] tracking-wider text-info uppercase ring-1 ring-info/30">
              <ClipboardList className="size-3" aria-hidden />
              Plano aberto
            </span>
            <Link
              href={`/painel/copiloto/${breach.incidentId}`}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 px-3")}
            >
              Ver plano
              <ArrowRight aria-hidden />
            </Link>
          </div>
        ) : (
          <ArrivalForm action={openBreachPlan.bind(null, breach.id)} className="shrink-0">
            <SubmitButton size="sm" variant="outline" pendingText="Abrindo o plano..." className="h-8 w-full px-3 sm:w-auto">
              <LifeBuoy className="text-rubi" aria-hidden />
              Plano de resposta
              <ArrowRight aria-hidden />
            </SubmitButton>
          </ArrivalForm>
        )}
      </div>
    </li>
  );
}

/** Cartão de um serviço: estado declarado (2FA, financeiro) e vazamentos reais do domínio. */
export function AccountCard({ account }: { account: AccountItem }) {
  const needsTwoFactor = account.isFinancial && !account.hasTwoFactor;
  const headingId = `conta-${account.id}`;
  return (
    <li>
      <Card className="gap-4">
        <div className="flex items-start gap-3 px-(--card-spacing)">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-base font-semibold text-foreground uppercase ring-1 ring-white/[0.08]"
          >
            {account.name.trim().charAt(0) || "?"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id={headingId} className="text-base leading-tight font-semibold tracking-tight break-words">
                {account.name}
              </h3>
              {account.isFinancial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-px font-mono text-[10.5px] font-medium tracking-wider text-foreground uppercase ring-1 ring-white/10">
                  <Landmark className="size-3" aria-hidden />
                  Financeiro
                </span>
              )}
            </div>
            <span className="truncate font-mono text-xs text-muted-foreground">{account.domain}</span>
          </div>
          <form action={removeAccount.bind(null, account.id)} className="shrink-0">
            <SubmitButton
              size="sm"
              variant="ghost"
              pendingText="Removendo..."
              aria-label={`Remover ${account.name} da lista`}
              className="text-muted-foreground hover:text-danger dark:hover:text-danger"
            >
              <Trash2 aria-hidden />
              Remover
            </SubmitButton>
          </form>
        </div>

        <div className="flex flex-col gap-2 px-(--card-spacing) sm:flex-row sm:flex-wrap">
          <FlagToggle account={account} field="hasTwoFactor" label="Verificação em duas etapas" tone="success" />
          <FlagToggle account={account} field="isFinancial" label="Mexe com dinheiro" tone="neutral" />
        </div>

        {needsTwoFactor && (
          <div className="px-(--card-spacing)">
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground ring-1 ring-warning/35">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-semibold text-warning">Atenção:</strong> serviço financeiro sem verificação em
                duas etapas. Ative nas configurações de segurança do app: é a proteção que mais reduz invasões de conta.
              </span>
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5 px-(--card-spacing)">
          {account.breaches.length > 0 ? (
            <>
              <h4 className="eyebrow text-muted-foreground">
                Vazamentos conhecidos <span className="text-danger">· {account.breaches.length}</span>
              </h4>
              <ul className="flex flex-col gap-2.5" aria-label={`Vazamentos conhecidos de ${account.name}`}>
                {account.breaches.map((breach) => (
                  <BreachRow key={breach.id} breach={breach} />
                ))}
              </ul>
            </>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-foreground ring-1 ring-success/30">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                <strong className="font-semibold text-success">Nenhum vazamento conhecido</strong>{" "}
                <span className="text-muted-foreground">deste serviço no catálogo público.</span>
              </span>
            </p>
          )}
        </div>
      </Card>
    </li>
  );
}
