"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { reportIncident, type ReportState } from "@/app/painel/copiloto/actions";
import { SubmitButton } from "@/components/submit-button";
import { REPORT_OPTIONS, type ReportableType } from "@/lib/incidents";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;

export function ReportForm() {
  const [state, formAction] = useActionState<ReportState | null, FormData>(reportIncident, null);
  const [type, setType] = useState<ReportableType | "">("");
  const [length, setLength] = useState(state?.text.length ?? 0);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="relato" className="text-sm font-medium">
          Conte o que aconteceu, do seu jeito
        </label>
        <textarea
          id="relato"
          name="text"
          required
          minLength={15}
          maxLength={MAX_LENGTH}
          rows={5}
          defaultValue={state?.text}
          onChange={(event) => setLength(event.target.value.length)}
          placeholder="Ex.: Um falso funcionário do banco me ligou, pediu para instalar um app e eu fiz um Pix."
          className="min-h-32 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          aria-describedby="relato-privacidade"
        />
        <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <p id="relato-privacidade" className="flex items-start gap-1.5">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-600" aria-hidden />
            Não escreva senhas. CPF, cartão, telefone e e-mail são removidos antes da análise.
          </p>
          <span className="shrink-0 font-mono tabular-nums">
            {length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn("mb-2.5 text-sm font-medium", state?.needsType && "text-red-700")}>
          {state?.needsType ? "Qual destas opções chega mais perto?" : "Se preferir, escolha o tipo (opcional)"}
        </legend>
        <div className="flex flex-wrap gap-2">
          <TypeChip value="" label="Deixe o Radar360 identificar" checked={type === ""} onSelect={setType} />
          {REPORT_OPTIONS.map((option) => (
            <TypeChip
              key={option.type}
              value={option.type}
              label={option.label}
              title={option.example}
              checked={type === option.type}
              onSelect={setType}
            />
          ))}
        </div>
      </fieldset>

      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground sm:max-w-sm">
          <Sparkles className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
          A IA só identifica o tipo de incidente. O plano vem de um roteiro revisado, com links oficiais.
        </p>
        <SubmitButton size="lg" pendingText="Montando o plano..." className="h-10 w-full px-4 sm:w-auto">
          Gerar plano de resposta
          <ArrowRight data-icon="inline-end" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}

function TypeChip({
  value,
  label,
  title,
  checked,
  onSelect,
}: {
  value: ReportableType | "";
  label: string;
  title?: string;
  checked: boolean;
  onSelect: (value: ReportableType | "") => void;
}) {
  return (
    <label
      title={title}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors select-none has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked
          ? "bg-ink text-ink-foreground ring-ink"
          : "bg-background text-foreground shadow-xs ring-border hover:bg-muted hover:ring-foreground/20",
      )}
    >
      <input
        type="radio"
        name="type"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {checked && <Check className="size-3.5 text-signal" aria-hidden />}
      {label}
    </label>
  );
}
