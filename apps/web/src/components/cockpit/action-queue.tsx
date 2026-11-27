import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ChevronRight, Database, Hand, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { InspectTrigger } from "./inspector";
import type { ActionStep } from "./model";
import { Panel, TONE_RAIL, TONE_TEXT } from "./panel";

const KIND_ICON = { leak: Database, network: Wifi } as const;

/** Quem corrige um achado de rede. Mesma regra da gaveta (AGENT_FIXABLE_KINDS). */
function FixHint({ fix }: { fix: ActionStep["fix"] }) {
  if (fix === "agent") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <Bot className="size-3.5 shrink-0" aria-hidden />O agente corrige isso com o seu OK
      </span>
    );
  }
  if (fix === "manual") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Hand className="size-3.5 shrink-0" aria-hidden />
        Correção manual
      </span>
    );
  }
  return null;
}

/** A primeira ação, aberta: o que é, de onde vem e o que fazer. Responde "o que eu faço agora?". */
function FirstStep({ step }: { step: ActionStep }) {
  const KindIcon = KIND_ICON[step.kind];
  return (
    <InspectTrigger
      target={step.target}
      // Brilho de marca (não de estado) só neste cartão: é o ponto de partida da tela.
      className="group relative mx-3 mt-3 flex flex-col gap-1.5 rounded-lg bg-ink bg-[radial-gradient(90%_70%_at_0%_0%,color-mix(in_oklab,var(--crimson)_11%,transparent),transparent_70%)] px-4 py-3 text-left ring-1 ring-white/[0.08] transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r", TONE_RAIL[step.tone])} aria-hidden />
      <span className="flex items-center justify-between gap-3">
        <span className="eyebrow text-[10px] text-rubi">Comece por aqui</span>
        <span className="font-mono text-[11px] text-muted-foreground" title="Quanto este item pesa no seu score hoje">
          pesa <span className={cn("font-semibold", TONE_TEXT[step.tone])}>+{step.points}</span> no score
        </span>
      </span>
      <span className="text-[17px] leading-snug font-semibold tracking-tight">
        <span className="sr-only">Ação 1: </span>
        {step.title}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
        <KindIcon className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{step.source}</span>
      </span>
      <span className="line-clamp-3 text-[13.5px] leading-relaxed text-foreground/80">{step.description}</span>
      <FixHint fix={step.fix} />
      <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium ring-1 ring-white/15 transition-colors group-hover:bg-white/[0.12]">
        Ver como resolver
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </InspectTrigger>
  );
}

/** As próximas ações, uma linha cada. O detalhe abre na gaveta. */
function NextStep({ step, position }: { step: ActionStep; position: number }) {
  const KindIcon = KIND_ICON[step.kind];
  return (
    <li>
      <InspectTrigger
        target={step.target}
        className="group flex w-full items-center gap-3 px-4 py-1.5 text-left transition-colors outline-none hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="w-4 font-mono text-[10.5px] font-semibold text-muted-foreground tabular-nums" aria-hidden>
          {String(position).padStart(2, "0")}
        </span>
        <KindIcon className={cn("size-3.5 shrink-0", TONE_TEXT[step.tone])} aria-hidden />
        <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug font-medium">
          <span className="sr-only">Ação {position}: </span>
          {step.title}
          <span className="sr-only">. {step.source}</span>
        </span>
        <span className={cn("shrink-0 font-mono text-xs font-semibold tabular-nums", TONE_TEXT[step.tone])}>
          +{step.points}
          <span className="sr-only"> pontos no score</span>
        </span>
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </InspectTrigger>
    </li>
  );
}

/** Fila de ação: a primeira aberta, as outras em uma linha, em ordem de peso no score. */
export function ActionQueue({ steps, className }: { steps: ActionStep[]; className?: string }) {
  const [first, ...rest] = steps;
  return (
    <Panel
      id="fila-titulo"
      index="02"
      label="Fila de ação"
      className={className}
      aside={
        <span className="font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase tabular-nums">
          {steps.length} {steps.length === 1 ? "ação" : "ações"}
        </span>
      }
    >
      {!first ? (
        <p className="m-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm ring-1 ring-success/30">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          Nenhuma ação urgente. O monitoramento continua ativo.
        </p>
      ) : (
        <>
          <FirstStep step={first} />
          {rest.length > 0 && (
            <div className="flex flex-col pt-2.5 pb-1.5">
              <span className="eyebrow px-4 pb-1 text-[9.5px] text-muted-foreground">Depois</span>
              <ol className="flex flex-col">
                {rest.map((step, index) => (
                  <NextStep key={step.key} step={step} position={index + 2} />
                ))}
              </ol>
            </div>
          )}
        </>
      )}
      <Link
        href="/painel/copiloto"
        className="group mt-auto flex shrink-0 items-center gap-3 border-t border-white/[0.06] bg-crimson/[0.06] px-4 py-2.5 transition-colors outline-none hover:bg-crimson/[0.12] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-medium">Copiloto: plano completo e notificação LGPD</span>
          <span className="font-mono text-[10.5px] tracking-wider text-rubi">T+15MIN · T+1H · T+24H</span>
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </Link>
    </Panel>
  );
}
