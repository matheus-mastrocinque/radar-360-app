"use client";

import { useId, useState } from "react";
import { Banknote, Lock, Smartphone, TriangleAlert } from "lucide-react";
import { buildMedRequest, EMPTY_MED_FIELDS, MED_REQUEST_DAYS, type MedFields } from "@/lib/med";
import { CopyButton } from "./copy-button";

const FIELDS: Array<{ key: keyof MedFields; label: string; placeholder: string; hint?: string }> = [
  { key: "amount", label: "Valor", placeholder: "Ex.: 350,00" },
  { key: "when", label: "Data e hora do Pix", placeholder: "Ex.: 27/11 às 14h20" },
  { key: "receiver", label: "Quem recebeu", placeholder: "Nome ou chave Pix", hint: "Está no comprovante." },
  {
    key: "transactionId",
    label: "Identificador da transação",
    placeholder: "Começa com E",
    hint: "Código longo no comprovante do Pix.",
  },
  { key: "policeReport", label: "Boletim de ocorrência", placeholder: "Número, se já tiver" },
];

const INPUT =
  "h-9 w-full rounded-md border border-input bg-ink px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

/**
 * Kit do pedido de devolução (MED) para o golpe do Pix: onde pedir e o texto pronto.
 * Os campos ficam só no navegador; nada é enviado nem salvo.
 */
export function MedKit() {
  const [fields, setFields] = useState<MedFields>(EMPTY_MED_FIELDS);
  const baseId = useId();
  const text = buildMedRequest(fields);
  const set = (key: keyof MedFields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  return (
    <section
      id="med"
      aria-labelledby="med-titulo"
      className="scroll-mt-20 overflow-hidden rounded-xl bg-card shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_16px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.07]"
    >
      <header className="flex gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-6 sm:py-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
          <Banknote className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-rubi">Kit do golpe do Pix · MED</span>
          <h2 id="med-titulo" className="text-lg font-semibold tracking-tight">
            Pedido de devolução ao seu banco
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            O MED é o mecanismo do Banco Central para devolver Pix feito em golpe. Você pede ao <strong>seu</strong>{" "}
            banco, em até {MED_REQUEST_DAYS} dias da transferência. Quanto antes, maior a chance de ainda haver
            dinheiro na conta de quem recebeu.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
        <ol className="grid gap-3 sm:grid-cols-3">
          <li className="flex flex-col gap-1.5 rounded-lg bg-ink p-3.5 ring-1 ring-white/[0.06]">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="size-4 text-rubi" aria-hidden />
              1. No app do banco
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Abra o comprovante do Pix e procure a opção de contestar ou pedir devolução por golpe.
            </span>
          </li>
          <li className="flex flex-col gap-1.5 rounded-lg bg-ink p-3.5 ring-1 ring-white/[0.06]">
            <span className="text-sm font-medium">2. Sem a opção no app</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Use o chat do app ou o telefone no verso do cartão e cole o texto abaixo. Peça o protocolo.
            </span>
          </li>
          <li className="flex flex-col gap-1.5 rounded-lg bg-ink p-3.5 ring-1 ring-white/[0.06]">
            <span className="text-sm font-medium">3. Sem resposta</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Com o protocolo, reclame na ouvidoria do banco e depois no Banco Central (veja o plano acima).
            </span>
          </li>
        </ol>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <form className="flex flex-col gap-3" onSubmit={(event) => event.preventDefault()} aria-describedby={`${baseId}-privacidade`}>
            {FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{field.label}</span>
                <input
                  type="text"
                  value={fields[field.key]}
                  onChange={set(field.key)}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  className={INPUT}
                />
                {field.hint && <span className="text-xs text-muted-foreground">{field.hint}</span>}
              </label>
            ))}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">O que aconteceu</span>
              <textarea
                value={fields.summary}
                onChange={set("summary")}
                rows={3}
                placeholder="Ex.: um falso funcionário do banco me ligou e pediu um Pix para proteger a conta."
                className="w-full rounded-md border border-input bg-ink px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              />
            </label>
            <p id={`${baseId}-privacidade`} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
              O que você digitar aqui fica só no seu navegador: não é enviado ao Olharium nem salvo.
            </p>
          </form>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={`${baseId}-texto`} className="eyebrow text-muted-foreground">
                Texto para o banco
              </span>
              <CopyButton text={text} />
            </div>
            <pre
              aria-labelledby={`${baseId}-texto`}
              tabIndex={0}
              className="max-h-96 overflow-auto rounded-lg bg-background p-4 font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-foreground/90 ring-1 ring-white/[0.08] outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:p-5"
            >
              {text}
            </pre>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-xs leading-relaxed ring-1 ring-warning/30">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-medium">A devolução não é garantida:</span> depende de ainda haver saldo na conta de
            quem recebeu. Desconfie de quem cobrar uma &quot;taxa&quot; para devolver o dinheiro: nenhuma devolução de
            verdade exige um novo Pix.
          </span>
        </p>
      </div>
    </section>
  );
}
