"use client";

import { useActionState } from "react";
import { AlertTriangle, Globe, Plus } from "lucide-react";
import { addTypedAccount, type AddAccountState } from "@/app/painel/contas/actions";
import { SubmitButton } from "@/components/submit-button";

/** Adicionar um serviço que não apareceu nas sugestões, digitando o endereço. */
export function AddServiceForm() {
  const [state, action] = useActionState<AddAccountState | null, FormData>(addTypedAccount, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="domain" className="text-sm font-medium text-foreground">
        Não achou? Digite o endereço do site
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Globe
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="domain"
            name="domain"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            maxLength={253}
            placeholder="minhaloja.com.br"
            defaultValue={state?.domain}
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={state?.error ? "domain-hint domain-error" : "domain-hint"}
            className="h-9 w-full min-w-0 rounded-md border border-input bg-ink pr-3 pl-9 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-danger/70"
          />
        </div>
        <SubmitButton variant="outline" pendingText="Adicionando..." className="h-9 px-3">
          <Plus aria-hidden />
          Adicionar
        </SubmitButton>
      </div>
      <p id="domain-hint" className="text-xs text-muted-foreground">
        Só o endereço, como estantevirtual.com.br. Nunca pedimos login nem senha.
      </p>
      {state?.error && (
        <p
          id="domain-error"
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-foreground ring-1 ring-danger/35"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <span>
            <strong className="font-semibold text-danger">Erro:</strong> {state.error}
          </span>
        </p>
      )}
    </form>
  );
}
