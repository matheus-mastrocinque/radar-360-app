"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { reportIncident, type ReportState } from "@/app/painel/copiloto/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ReportableType } from "@/lib/incidents";
import { REPORT_OPTIONS } from "@/lib/report-options";
import { cn } from "@/lib/utils";
import { clearArrival, markArrival } from "./arrival";
import { CHOICE_CHIP, FIELD } from "./chip-style";

const MAX_LENGTH = 2000;

export function ReportForm() {
  const [state, formAction] = useActionState<ReportState | null, FormData>(reportIncident, null);
  const [type, setType] = useState<ReportableType | "">("");
  const [length, setLength] = useState(0);
  const [lastState, setLastState] = useState(state);

  // O texto volta no estado da action (o formulário é reiniciado com ele): o contador acompanha.
  if (state !== lastState) {
    setLastState(state);
    setLength(state?.text.length ?? 0);
  }

  // Se a action devolveu erro, não houve navegação: a marca de chegada ao plano não vale mais.
  useEffect(() => {
    if (state?.error) clearArrival();
  }, [state]);

  const needsType = Boolean(state?.needsType);

  return (
    <form action={formAction} onSubmit={() => markArrival("top")} className="flex flex-col gap-5">
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
          className={cn(FIELD, "min-h-32 w-full resize-y rounded-lg px-3.5 py-3 leading-relaxed")}
          aria-describedby="relato-privacidade"
        />
        <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <p id="relato-privacidade" className="flex items-start gap-1.5">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
            Não escreva senhas. CPF, cartão, telefone, e-mail e chave Pix são removidos antes da análise.
          </p>
          <span className="shrink-0 font-mono tabular-nums" aria-hidden>
            {length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      <fieldset
        className={cn(
          "flex flex-col gap-2 rounded-lg transition-colors",
          needsType && "bg-warning/[0.06] p-3 ring-1 ring-warning/35",
        )}
        aria-describedby={state?.error ? "relato-erro" : undefined}
      >
        <legend
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            needsType ? "float-left mb-2.5 w-full text-foreground" : "mb-2.5",
          )}
        >
          {needsType && <ListChecks className="size-4 shrink-0 text-warning" aria-hidden />}
          {needsType ? "Qual destas opções chega mais perto?" : "Se preferir, escolha o tipo"}
          {!needsType && <span className="font-normal text-muted-foreground">(opcional)</span>}
        </legend>
        <div className="clear-both flex flex-wrap gap-2">
          <TypeChip value="" label="Deixe o Olharium identificar" checked={type === ""} onSelect={setType} />
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
        <div
          id="relato-erro"
          role="alert"
          className={cn(
            "flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm text-foreground ring-1",
            needsType ? "bg-warning/10 ring-warning/35" : "bg-danger/10 ring-danger/35",
          )}
        >
          <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", needsType ? "text-warning" : "text-danger")} aria-hidden />
          <p>
            <span className={cn("font-semibold", needsType ? "text-warning" : "text-danger")}>
              {needsType ? "Falta o tipo." : "Erro."}
            </span>{" "}
            {state.error}
            {needsType && " Seu texto continua aqui."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground sm:max-w-sm">
          <Sparkles className="mt-px size-3.5 shrink-0 text-rubi" aria-hidden />
          A IA só identifica o tipo de incidente. Os passos vêm de um roteiro revisado, com links oficiais.
        </p>
        <SubmitButton
          size="lg"
          pendingText="Montando o plano..."
          className="glow-crimson h-10 w-full px-4 sm:w-auto"
        >
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
    <label title={title} className={CHOICE_CHIP}>
      <input
        type="radio"
        name="type"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {checked && <Check className="size-3.5 text-rubi" aria-hidden />}
      {label}
    </label>
  );
}
