import {
  AlertTriangle,
  AlignLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileCheck,
  Hourglass,
  Info,
  Landmark,
  Mail,
  Scale,
  Send,
  Undo2,
} from "lucide-react";
import { recordLgpd } from "@/app/painel/copiloto/actions";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import type { IncidentView, LgpdStatus } from "@/lib/incidents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { LgpdBadge, StateAlert, StateBadge } from "./status";

type Lgpd = NonNullable<IncidentView["lgpd"]>;

/** Prazo do art. 19, II (dias corridos). O mesmo valor da API (catalog.ts). */
const RESPONSE_DAYS = 15;

const STAGES: Array<{ key: string; label: string }> = [
  { key: "send", label: "Enviar ao encarregado" },
  { key: "wait", label: "Aguardar até 15 dias" },
  { key: "close", label: "Resposta ou petição à ANPD" },
];

/** Quantas etapas já foram cumpridas em cada status. */
const STAGE_INDEX: Record<LgpdStatus, number> = { not_sent: 0, waiting: 1, overdue: 2, answered: 3 };

function Stages({ status }: { status: LgpdStatus }) {
  const current = STAGE_INDEX[status];
  return (
    <ol className="grid grid-cols-3" aria-label="Etapas da notificação LGPD">
      {STAGES.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        const alert = active && status === "overdue";
        return (
          <li key={stage.key} className="flex min-w-0 flex-col gap-2" aria-current={active ? "step" : undefined}>
            <div className="flex items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-1",
                  done && "bg-success/15 text-success ring-success/40",
                  alert && "bg-danger/15 text-danger ring-danger/50",
                  active && !alert && "bg-rubi/10 text-rubi ring-rubi/60",
                  !done && !active && "bg-ink text-muted-foreground ring-white/15",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : alert ? (
                  <AlertTriangle className="size-3.5" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              {index < STAGES.length - 1 && (
                <span
                  className={cn("mx-2 h-px flex-1", done ? "bg-success/50" : "bg-white/10")}
                  aria-hidden
                />
              )}
            </div>
            <span className="flex flex-col gap-0.5 pr-2">
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                Etapa {index + 1}
              </span>
              <span
                className={cn(
                  "text-xs leading-snug",
                  done || active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {stage.label}
                {done && <span className="sr-only"> (concluída)</span>}
              </span>
              {alert && (
                <span className="text-[11px] font-semibold text-danger">Prazo vencido</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Régua dos 15 dias: um traço por dia, preenchido conforme o prazo corre. */
function DeadlineMeter({ lgpd }: { lgpd: Lgpd }) {
  const { timeline } = lgpd;
  let filled = 0;
  let fill = "bg-warning";
  let caption = `${RESPONSE_DAYS} dias corridos, contados do envio`;

  if (timeline.status === "waiting") {
    const left = timeline.daysLeft ?? RESPONSE_DAYS;
    filled = Math.min(RESPONSE_DAYS, Math.max(0, RESPONSE_DAYS - left));
    caption = `${filled} de ${RESPONSE_DAYS} dias`;
  } else if (timeline.status === "overdue") {
    filled = RESPONSE_DAYS;
    fill = "bg-danger";
    caption = `${RESPONSE_DAYS} de ${RESPONSE_DAYS} dias · vencido`;
  } else if (timeline.status === "answered") {
    filled = RESPONSE_DAYS;
    fill = "bg-success/70";
    caption = timeline.answeredAt ? `Respondida em ${formatDate(timeline.answeredAt)}` : "Respondida";
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-ink px-3.5 py-3 ring-1 ring-white/[0.06] sm:flex-row sm:items-center sm:gap-4">
      <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        Prazo · art. 19, II
      </span>
      <div className="flex h-2 w-full min-w-0 gap-[3px] sm:flex-1" aria-hidden>
        {Array.from({ length: RESPONSE_DAYS }, (_, index) => (
          <span
            key={index}
            className={cn("h-full min-w-0 flex-1 rounded-[2px]", index < filled ? fill : "bg-white/[0.08]")}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-xs text-foreground tabular-nums">{caption}</span>
    </div>
  );
}

function StatusBanner({ lgpd }: { lgpd: Lgpd }) {
  const { timeline } = lgpd;
  if (timeline.status === "waiting" && timeline.sentAt && timeline.deadline) {
    return (
      <StateAlert tone="warning" label="Prazo correndo." icon={Hourglass} role="status">
        Enviada em {formatDate(timeline.sentAt)}. A empresa tem até <strong>{formatDate(timeline.deadline)}</strong>{" "}
        para responder
        {timeline.daysLeft !== null &&
          (timeline.daysLeft === 0 ? " (vence hoje)." : ` (faltam ${timeline.daysLeft} dias).`)}
      </StateAlert>
    );
  }
  if (timeline.status === "overdue" && timeline.deadline) {
    return (
      <StateAlert tone="danger" label="Prazo vencido." role="alert">
        O prazo de 15 dias da LGPD terminou em <strong>{formatDate(timeline.deadline)}</strong> sem resposta: a empresa
        está em falta. A petição à ANPD está pronta abaixo; leia o passo a passo antes de enviar.
      </StateAlert>
    );
  }
  if (timeline.status === "answered" && timeline.answeredAt) {
    return (
      <StateAlert tone="success" label="Respondida." role="status">
        A empresa respondeu em {formatDate(timeline.answeredAt)}. Se a resposta veio incompleta, você ainda pode
        peticionar à ANPD com o comprovante do pedido.
      </StateAlert>
    );
  }
  return null;
}

function TextBlock({ text, label, id }: { text: string; label: string; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={id} className="eyebrow text-muted-foreground">
          {label}
        </span>
        <CopyButton text={text} />
      </div>
      <pre
        aria-labelledby={id}
        tabIndex={0}
        className="max-h-96 overflow-auto rounded-lg bg-background p-4 font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-foreground/90 ring-1 ring-white/[0.08] outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:p-5"
      >
        {text}
      </pre>
    </div>
  );
}

function Petition({ petition }: { petition: NonNullable<Lgpd["petition"]> }) {
  return (
    <section
      aria-labelledby="peticao-anpd"
      className="flex flex-col gap-5 rounded-xl bg-ink p-4 ring-1 ring-white/10 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-rubi ring-1 ring-white/[0.08]">
          <Landmark className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h3 id="peticao-anpd" className="font-semibold tracking-tight">
              Petição à ANPD
            </h3>
            <span className="text-xs text-muted-foreground">Autoridade Nacional de Proteção de Dados</span>
          </div>
          <StateBadge tone="neutral" icon={FileCheck} className="text-foreground">
            Pronta para enviar
          </StateBadge>
        </div>
      </div>

      <TextBlock text={petition.text} label="Texto da petição" id="peticao-texto" />

      <div className="flex flex-col gap-2.5">
        <span className="eyebrow text-muted-foreground">Como enviar</span>
        <ol className="flex flex-col gap-2 text-sm">
          {petition.checklist.map((item, index) => (
            <li key={item} className="flex gap-3">
              <span className="flex h-5 shrink-0 items-center font-mono text-[11px] font-semibold text-rubi tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {petition.links.map((link, index) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: index === 0 ? "default" : "outline",
              className: cn("h-auto min-h-9 px-3.5 py-2 text-center whitespace-normal", index === 0 && "glow-crimson"),
            })}
          >
            {link.label}
            <ArrowUpRight aria-hidden />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function LgpdPanel({ incident, lgpd }: { incident: IncidentView; lgpd: Lgpd }) {
  const { timeline, notice, recipient, petition } = lgpd;
  const company = incident.breach?.company ?? incident.reportedBreach?.company ?? "empresa";
  const mailto = recipient.contact
    ? `mailto:${recipient.contact}?subject=${encodeURIComponent(notice.subject)}&body=${encodeURIComponent(notice.body)}`
    : null;
  const sent = timeline.status !== "not_sent";
  const articles = [...notice.articles, ...(petition?.articles ?? [])].filter(
    (article, index, all) => all.findIndex((other) => other.ref === article.ref) === index,
  );

  return (
    <section
      id="lgpd"
      aria-labelledby="lgpd-titulo"
      className="scroll-mt-20 overflow-hidden rounded-xl bg-card shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_16px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.07]"
    >
      <header className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <Scale className="size-4" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <span className="eyebrow text-rubi">LGPD · art. 18 e 19</span>
            <h2 id="lgpd-titulo" className="text-lg font-semibold tracking-tight">
              Notificação ao encarregado de dados
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A empresa precisa dizer quais dados seus foram afetados e o que fez a respeito. Sem resposta em 15
              dias, o próximo passo é a ANPD.
            </p>
          </div>
        </div>
        <LgpdBadge status={timeline.status} className="sm:mt-1" />
      </header>

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4">
          <Stages status={timeline.status} />
          <DeadlineMeter lgpd={lgpd} />
          <StatusBanner lgpd={lgpd} />
        </div>

        {petition && <Petition petition={petition} />}

        <div className="flex flex-col gap-4">
          <dl className="grid overflow-hidden rounded-lg text-sm ring-1 ring-white/[0.08] sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            <dt className="flex items-center gap-1.5 bg-ink px-4 pt-3 font-mono text-[11px] tracking-wider text-muted-foreground uppercase sm:py-3">
              <Mail className="size-3.5" aria-hidden />
              Para
            </dt>
            <dd className="flex min-w-0 flex-col gap-0.5 px-4 pt-1 pb-3 sm:py-3">
              <span className="font-medium">
                Encarregado(a) de dados da {company}
                {recipient.contact && (
                  <span className="font-mono text-xs font-normal break-all text-muted-foreground">
                    {" "}
                    · {recipient.contact}
                  </span>
                )}
              </span>
              {!sent && <span className="text-xs text-muted-foreground">{recipient.hint}</span>}
            </dd>
            <dt className="flex items-center gap-1.5 border-t border-white/[0.06] bg-ink px-4 pt-3 font-mono text-[11px] tracking-wider text-muted-foreground uppercase sm:py-3">
              <AlignLeft className="size-3.5" aria-hidden />
              Assunto
            </dt>
            <dd className="min-w-0 px-4 pt-1 pb-3 sm:border-t sm:border-white/[0.06] sm:py-3">{notice.subject}</dd>
          </dl>

          {sent ? (
            <details className="group rounded-lg ring-1 ring-white/[0.08]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground/85 select-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                Ver a notificação enviada
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-4">
                <TextBlock text={notice.body} label="Texto da notificação" id="notificacao-texto" />
              </div>
            </details>
          ) : (
            <>
              <TextBlock text={notice.body} label="Texto da notificação" id="notificacao-texto" />
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0 text-info" aria-hidden />
                Complete os campos entre colchetes antes de enviar. O Olharium guarda seu CPF e seu e-mail só como
                código irreversível (HMAC), por isso não consegue preenchê-los por você.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:flex-wrap sm:items-center">
          {timeline.status === "not_sent" && (
            <>
              {mailto && (
                <a href={mailto} className={buttonVariants({ variant: "outline", className: "h-9 px-3.5" })}>
                  <Mail aria-hidden />
                  Abrir no e-mail
                </a>
              )}
              <form action={recordLgpd.bind(null, incident.id, "sent")} className="flex">
                <SubmitButton pendingText="Registrando..." className="h-9 w-full px-3.5 sm:w-auto">
                  <Send aria-hidden />
                  Marquei como enviada
                </SubmitButton>
              </form>
              <span className="text-xs text-muted-foreground sm:ml-1">O prazo de 15 dias começa a contar daí.</span>
            </>
          )}
          {(timeline.status === "waiting" || timeline.status === "overdue") && (
            <form action={recordLgpd.bind(null, incident.id, "answered")} className="flex">
              <SubmitButton variant="outline" pendingText="Registrando..." className="h-9 w-full px-3.5 sm:w-auto">
                <CheckCircle2 aria-hidden />A empresa respondeu
              </SubmitButton>
            </form>
          )}
          {sent && (
            <form action={recordLgpd.bind(null, incident.id, "reset")} className="flex">
              <SubmitButton variant="ghost" pendingText="Desfazendo..." className="h-9 w-full px-3.5 sm:w-auto">
                <Undo2 aria-hidden />
                Desfazer o envio
              </SubmitButton>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          <span className="eyebrow text-muted-foreground">Base legal · Lei nº 13.709/2018</span>
          <ul className="grid gap-2 sm:grid-cols-2">
            {articles.map((article) => (
              <li
                key={article.ref}
                className="flex items-start gap-3 rounded-lg bg-ink px-3 py-2.5 text-xs ring-1 ring-white/[0.05]"
              >
                <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-foreground ring-1 ring-white/10">
                  {article.ref}
                </span>
                <span className="leading-relaxed text-muted-foreground">{article.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
