"use client";

import { useActionState, useEffect } from "react";
import { AlertTriangle, Check, FileText } from "lucide-react";
import { reportCompanyNotice, type CompanyNoticeState } from "@/app/painel/copiloto/actions";
import { SubmitButton } from "@/components/submit-button";
import { LEAKED_DATA_OPTIONS } from "@/lib/report-options";
import { cn } from "@/lib/utils";
import { clearArrival, markArrival } from "./arrival";
import { CHOICE_CHIP, FIELD } from "./chip-style";

/** "Uma empresa me avisou que vazou meus dados": empresa, mês e o que vazou → notificação LGPD pronta. */
export function CompanyNoticeForm() {
  const [state, action] = useActionState<CompanyNoticeState | null, FormData>(reportCompanyNotice, null);
  const checked = new Set(state?.dataClasses ?? []);

  // Se a action devolveu erro, não houve navegação: a marca de chegada ao plano não vale mais.
  useEffect(() => {
    if (state?.error) clearArrival();
  }, [state]);

  return (
    <form action={action} onSubmit={() => markArrival("lgpd")} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="notice-company" className="text-xs font-medium text-muted-foreground">
            Empresa que avisou
          </label>
          <input
            id="notice-company"
            name="company"
            required
            minLength={2}
            maxLength={80}
            defaultValue={state?.company}
            placeholder="Ex.: a loja, o banco ou a operadora"
            className={cn(FIELD, "h-9 w-full")}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="notice-month" className="text-xs font-medium text-muted-foreground">
            Quando ocorreu <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="notice-month"
            name="occurredAt"
            type="month"
            defaultValue={state?.occurredAt}
            className={cn(FIELD, "h-9 w-full min-w-0 font-mono text-[13px]")}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">O que a empresa disse que vazou</legend>
        <div className="flex flex-wrap gap-1.5">
          {LEAKED_DATA_OPTIONS.map((option) => (
            <label key={option.key} className={cn(CHOICE_CHIP, "gap-1 rounded-md px-2.5 py-1 text-xs")}>
              <input
                type="checkbox"
                name="dataClasses"
                value={option.key}
                defaultChecked={checked.has(option.key)}
                className="sr-only"
              />
              <Check className="hidden size-3 text-rubi group-has-checked/chip:block" aria-hidden />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm text-foreground ring-1 ring-danger/35"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p>
            <span className="font-semibold text-danger">Erro.</span> {state.error}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-xs">
          Guardamos só a empresa, o mês e as categorias marcadas. Nunca o dado em si.
        </p>
        <SubmitButton
          variant="outline"
          size="lg"
          pendingText="Preparando a notificação..."
          className="h-10 w-full px-4 sm:w-auto"
        >
          <FileText aria-hidden />
          Gerar plano e notificação LGPD
        </SubmitButton>
      </div>
    </form>
  );
}
