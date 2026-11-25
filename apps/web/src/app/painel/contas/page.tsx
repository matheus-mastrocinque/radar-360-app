import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUpRight, Info, LockKeyhole, Plus, Scale } from "lucide-react";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountsSummary } from "@/components/accounts/accounts-summary";
import { ServicePicker } from "@/components/accounts/service-picker";
import { ErrorState } from "@/components/shell/error-state";
import { buttonVariants } from "@/components/ui/button";
import { fetchAccounts, fetchServiceSuggestions } from "@/lib/accounts";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Minhas contas · Olharium" };

const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/deed.pt-br";

const LINK =
  "rounded-sm font-medium text-foreground underline decoration-white/30 underline-offset-2 outline-none hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const token = await getSessionToken();
  if (!token) redirect("/");

  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const [result, suggestions] = await Promise.all([fetchAccounts(token), fetchServiceSuggestions(token, query)]);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");
  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar suas contas" retryHref="/painel/contas" />;
  }

  const { accounts, summary, attribution } = result.data;
  // O mais recente primeiro: quem acabou de adicionar vê o serviço no topo da lista.
  const ordered = [...accounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tracked = new Map(accounts.map((account) => [account.domain, account.name]));
  const found = suggestions.ok ? suggestions.data.services : [];
  const options = found.filter((service) => !tracked.has(service.domain));
  const alreadyTracked = found.filter((service) => tracked.has(service.domain)).map((service) => service.name);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="eyebrow text-rubi">Minhas contas</span>
            <h1 className="text-3xl font-semibold tracking-tight">Os serviços que você usa</h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Marque os serviços em que você tem conta. O Olharium cruza cada um com vazamentos reais e públicos e,
              quando houver, monta o plano de resposta e a notificação LGPD para a empresa.
            </p>
          </div>
          <a
            href="#adicionar"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full px-3 sm:w-auto lg:hidden")}
          >
            <Plus aria-hidden />
            Adicionar serviço
            <ArrowDown className="text-muted-foreground" aria-hidden />
          </a>
        </div>

        <ul className="grid gap-2 text-sm sm:grid-cols-2" aria-label="Como funciona">
          <li className="flex items-start gap-3 rounded-lg bg-ink/70 px-3.5 py-3 ring-1 ring-white/[0.06]">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-rubi" aria-hidden />
            <span className="text-muted-foreground">
              <strong className="font-medium text-foreground">Guardamos só o nome do serviço.</strong> Nunca login nem
              senha.
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-lg bg-ink/70 px-3.5 py-3 ring-1 ring-white/[0.06]">
            <Scale className="mt-0.5 size-4 shrink-0 text-rubi" aria-hidden />
            <span className="text-muted-foreground">
              <strong className="font-medium text-foreground">Mostramos que o serviço teve vazamento.</strong> Só a
              empresa confirma se a sua conta estava nele, e é isso que a notificação LGPD pede.
            </span>
          </li>
        </ul>
      </header>

      <AccountsSummary accounts={accounts} summary={summary} />

      <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-5">
        <section className="flex min-w-0 flex-col gap-3 lg:col-span-3" aria-labelledby="lista-contas">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="lista-contas" className="text-lg font-semibold tracking-tight">
              Sua lista
            </h2>
            {accounts.length > 1 && <span className="text-xs text-muted-foreground">Mais recentes primeiro</span>}
          </div>
          {ordered.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-white/15 p-6 text-sm text-muted-foreground">
              <p>
                <strong className="font-medium text-foreground">Nenhum serviço ainda.</strong> Busque pelo nome ou digite
                o endereço do site para ver os vazamentos conhecidos de cada um.
              </p>
              <a href="#adicionar" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "lg:hidden")}>
                <Plus aria-hidden />
                Adicionar serviço
              </a>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {ordered.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 lg:col-span-2">
          <ServicePicker
            query={query}
            options={options}
            alreadyTracked={alreadyTracked}
            unavailable={!suggestions.ok}
          />
        </div>
      </div>

      <p className="flex items-start gap-2.5 rounded-lg bg-ink/70 px-4 py-3 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/[0.06]">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          Vazamentos reais do catálogo público{" "}
          <a href={attribution.url} target="_blank" rel="noopener noreferrer" className={LINK}>
            {attribution.label}
            <ArrowUpRight className="ml-0.5 inline size-3 align-[-1px]" aria-hidden />
            <span className="sr-only"> (abre em nova aba)</span>
          </a>{" "}
          (licença{" "}
          <a href={CC_BY_URL} target="_blank" rel="noopener noreferrer license" className={LINK}>
            {attribution.license}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          ). Só metadados: empresa, data, número de contas e categorias expostas. O Olharium nunca mostra o dado vazado.
        </span>
      </p>
    </main>
  );
}
