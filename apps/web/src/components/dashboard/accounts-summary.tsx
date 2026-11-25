import Link from "next/link";
import { ArrowRight, ArrowUpRight, KeyRound, ShieldAlert, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountList } from "@/lib/accounts";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 6;

/**
 * Resumo de "Minhas contas" (só leitura). Vazamento de um serviço não confirma que a conta da
 * pessoa estava nele, por isso o texto diz "o serviço teve vazamento".
 */
export function AccountsSummary({ data }: { data: AccountList }) {
  const withRealBreach = data.accounts.filter((account) => account.breaches.some((breach) => !breach.isSynthetic));
  const shown = data.accounts.slice(0, MAX_CHIPS);
  const hidden = data.accounts.length - shown.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <KeyRound className="size-4" aria-hidden />
          </span>
          Minhas contas
        </CardTitle>
        <CardDescription>Os serviços que você usa e os vazamentos públicos de cada um.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não marcou nenhum serviço.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2">
              <div className="flex flex-col justify-between gap-1.5 rounded-lg bg-ink px-3 py-2.5 ring-1 ring-white/[0.06]">
                <dt className="text-xs text-muted-foreground">Serviços acompanhados</dt>
                <dd className="font-mono text-2xl leading-none font-semibold tabular-nums">{data.accounts.length}</dd>
              </div>
              <div className="flex flex-col justify-between gap-1.5 rounded-lg bg-ink px-3 py-2.5 ring-1 ring-white/[0.06]">
                <dt className="text-xs text-muted-foreground">Com vazamento real</dt>
                <dd className="flex items-center gap-1.5 font-mono text-2xl leading-none font-semibold tabular-nums">
                  {withRealBreach.length}
                  {withRealBreach.length > 0 && <ShieldAlert className="size-4 text-warning" aria-hidden />}
                </dd>
              </div>
            </dl>

            <ul className="flex flex-wrap gap-1.5" aria-label="Serviços acompanhados">
              {shown.map((account) => {
                const breached = withRealBreach.includes(account);
                return (
                  <li
                    key={account.id}
                    className={cn(
                      "flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-inset",
                      breached ? "bg-warning/10 text-foreground ring-warning/30" : "text-muted-foreground ring-white/10",
                    )}
                  >
                    {breached && <ShieldAlert className="size-3 shrink-0 text-warning" aria-hidden />}
                    <span className="truncate">{account.name}</span>
                    {breached && <span className="sr-only"> (teve vazamento)</span>}
                  </li>
                );
              })}
              {hidden > 0 && <li className="px-1 py-0.5 text-xs text-muted-foreground">+{hidden}</li>}
            </ul>

            {data.summary.financialWithoutTwoFactor > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed ring-1 ring-warning/35">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-medium">Atenção:</span>{" "}
                  {data.summary.financialWithoutTwoFactor === 1
                    ? "1 conta que mexe com dinheiro está sem verificação em duas etapas."
                    : `${data.summary.financialWithoutTwoFactor} contas que mexem com dinheiro estão sem verificação em duas etapas.`}
                </span>
              </p>
            )}

            {withRealBreach.length > 0 && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                O serviço ter vazado não quer dizer que a sua conta estava no vazamento. Fonte:{" "}
                <a
                  href={data.attribution.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 rounded text-foreground/85 underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {data.attribution.label}
                  <ArrowUpRight className="size-3" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>{" "}
                ({data.attribution.license}).
              </p>
            )}
          </>
        )}

        <Link
          href="/painel/contas"
          className="group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-colors outline-none ring-inset hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex-1">{data.accounts.length === 0 ? "Marcar os serviços que você usa" : "Abrir Minhas contas"}</span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </Link>
      </CardContent>
    </Card>
  );
}
