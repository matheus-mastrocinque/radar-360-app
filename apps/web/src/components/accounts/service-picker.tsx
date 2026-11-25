import Form from "next/form";
import Link from "next/link";
import { AlertTriangle, Landmark, Plus, Search, X } from "lucide-react";
import { addSuggestedAccount } from "@/app/painel/contas/actions";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceSuggestion } from "@/lib/accounts";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddServiceForm } from "./add-service-form";

const FIELD =
  "h-9 w-full min-w-0 rounded-md border border-input bg-ink text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function SuggestionRow({ service }: { service: ServiceSuggestion }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70 motion-reduce:transition-none">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
          <span className="min-w-0 break-words">{service.name}</span>
          {service.isFinancial && (
            <span className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">
              <Landmark className="size-3" aria-hidden />
              Financeiro
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="truncate font-mono text-muted-foreground">{service.domain}</span>
          {service.knownBreaches > 0 ? (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="size-3" aria-hidden />
              {plural(service.knownBreaches, "vazamento conhecido", "vazamentos conhecidos")}
            </span>
          ) : (
            <span className="text-muted-foreground">sem vazamento conhecido</span>
          )}
        </span>
      </div>
      <form action={addSuggestedAccount.bind(null, service.domain)} className="shrink-0">
        <SubmitButton size="sm" variant="outline" pendingText="Adicionando..." aria-label={`Adicionar ${service.name}`} className="h-8 px-3">
          <Plus aria-hidden />
          Adicionar
        </SubmitButton>
      </form>
    </li>
  );
}

/** Painel "Adicionar serviço": busca (GET ?q=), sugestões e endereço digitado. */
export function ServicePicker({
  query,
  options,
  alreadyTracked,
  unavailable,
}: {
  query: string;
  options: ServiceSuggestion[];
  /** Resultados da busca que já estão na lista da pessoa. */
  alreadyTracked: string[];
  /** A API de sugestões falhou. */
  unavailable: boolean;
}) {
  return (
    <Card id="adicionar" className="min-w-0 scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <Plus className="size-4" aria-hidden />
          </span>
          Adicionar serviço
        </CardTitle>
        <CardDescription>Bancos, lojas, redes sociais, apps de entrega e o gov.br. Basta o nome.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Form role="search" action="/painel/contas" scroll={false} className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            Buscar serviço
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              maxLength={80}
              autoComplete="off"
              placeholder="Ex.: Netshoes, Nubank"
              className={cn(FIELD, "pr-3 pl-9")}
            />
          </div>
          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
            Buscar
          </button>
        </Form>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="eyebrow min-w-0 truncate text-muted-foreground">
              {query ? `Resultados para “${query}”` : "Sugestões"}
            </h3>
            {query && (
              <Link
                href="/painel/contas"
                scroll={false}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3.5" aria-hidden />
                Limpar busca
              </Link>
            )}
          </div>

          {options.length > 0 ? (
            <ul className="-mx-2 flex flex-col" aria-label={query ? `Resultados para ${query}` : "Sugestões"}>
              {options.map((service) => (
                <SuggestionRow key={service.domain} service={service} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-ink px-3 py-3 text-sm text-muted-foreground ring-1 ring-white/[0.06]">
              {unavailable
                ? "Não conseguimos carregar as sugestões agora. Digite o endereço do site abaixo."
                : query
                  ? alreadyTracked.length > 0
                    ? `Já está na sua lista: ${alreadyTracked.join(", ")}.`
                    : `Nada encontrado para “${query}”. Digite o endereço do site abaixo.`
                  : "Você já adicionou todas as sugestões. Busque outro serviço pelo nome."}
            </p>
          )}

          {query && alreadyTracked.length > 0 && options.length > 0 && (
            <p className="text-xs text-muted-foreground">Já na sua lista: {alreadyTracked.join(", ")}.</p>
          )}
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <AddServiceForm />
        </div>
      </CardContent>
    </Card>
  );
}
