import {
  AlertTriangle,
  AlignLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Hourglass,
  Landmark,
  Mail,
  Scale,
  Send,
} from "lucide-react";
import { recordLgpd } from "@/app/painel/copiloto/actions";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncidentView, LgpdStatus } from "@/lib/incidents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

type Lgpd = NonNullable<IncidentView["lgpd"]>;

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
        const active = index === current || (status === "overdue" && index === 2);
        const alert = active && status === "overdue";
        return (
          <li key={stage.key} className="flex flex-col gap-2" aria-current={active ? "step" : undefined}>
            <div className="flex items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-1",
                  done && "bg-emerald-600 text-white ring-emerald-600",
                  !done && alert && "bg-red-600 text-white ring-red-600 shadow-[0_0_0_4px_oklch(0.64_0.2_25/0.15)]",
                  !done && active && !alert && "bg-ink text-signal ring-ink",
                  !done && !active && "bg-background text-muted-foreground ring-border",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : alert ? "!" : index + 1}
              </span>
              {index < STAGES.length - 1 && (
                <span
                  className={cn("mx-2 h-0.5 flex-1 rounded-full", done ? "bg-emerald-600" : "bg-border")}
                  aria-hidden
                />
              )}
            </div>
            <span
              className={cn(
                "pr-2 text-xs leading-snug",
                done || active ? "font-medium text-foreground" : "text-muted-foreground",
                alert && "text-red-700",
              )}
            >
              {stage.label}
              {done && <span className="sr-only"> (concluída)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TextBlock({ text, label }: { text: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton text={text} />
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg bg-background p-4 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap shadow-xs ring-1 ring-border sm:p-5">
        {text}
      </pre>
    </div>
  );
}

function StatusBanner({ lgpd }: { lgpd: Lgpd }) {
  const { timeline } = lgpd;
  if (timeline.status === "waiting" && timeline.sentAt && timeline.deadline) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
        <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Enviada em {formatDate(timeline.sentAt)}. A empresa tem até <strong>{formatDate(timeline.deadline)}</strong>{" "}
          para responder
          {timeline.daysLeft !== null &&
            (timeline.daysLeft === 0 ? " (vence hoje)." : ` (faltam ${timeline.daysLeft} dias).`)}
        </p>
      </div>
    );
  }
  if (timeline.status === "overdue" && timeline.deadline) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
        <p>
          O prazo terminou em <strong>{formatDate(timeline.deadline)}</strong> sem resposta. Você já pode levar o caso à
          ANPD: a petição abaixo está pronta.
        </p>
      </div>
    );
  }
  if (timeline.status === "answered" && timeline.answeredAt) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          A empresa respondeu em {formatDate(timeline.answeredAt)}. Se a resposta veio incompleta, você ainda pode
          peticionar à ANPD com o comprovante do pedido.
        </p>
      </div>
    );
  }
  return null;
}

export function LgpdPanel({ incident, lgpd }: { incident: IncidentView; lgpd: Lgpd }) {
  const { timeline, notice, recipient, petition } = lgpd;
  const mailto = recipient.contact
    ? `mailto:${recipient.contact}?subject=${encodeURIComponent(notice.subject)}&body=${encodeURIComponent(notice.body)}`
    : null;
  const sent = timeline.status !== "not_sent";

  return (
    <Card id="lgpd" className="scroll-mt-20">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-signal">
            <Scale className="size-4" aria-hidden />
          </span>
          Notificação LGPD ao encarregado
        </CardTitle>
        <CardDescription>
          A empresa precisa dizer quais dados seus foram afetados e o que fez a respeito. Sem resposta em 15 dias, o
          próximo passo é a ANPD.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Stages status={timeline.status} />
        <StatusBanner lgpd={lgpd} />

        {petition && (
          <div className="flex flex-col gap-5 rounded-xl bg-gradient-to-b from-red-50/80 to-red-50/20 p-4 ring-1 ring-red-200 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                <Landmark className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <h3 className="font-semibold tracking-tight">Petição à ANPD</h3>
                  <span className="text-xs text-muted-foreground">Autoridade Nacional de Proteção de Dados</span>
                </div>
                <span className="w-fit shrink-0 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Pronta para enviar
                </span>
              </div>
            </div>
            <TextBlock text={petition.text} label="Texto da petição" />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Como enviar</span>
              <ol className="flex flex-col gap-2 text-sm">
                {petition.checklist.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-card font-mono text-[11px] font-semibold ring-1 ring-red-200">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-wrap gap-2">
              {petition.links.map((link, index) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant: index === 0 ? "default" : "outline",
                    size: "sm",
                    className: "h-8 px-3",
                  })}
                >
                  {link.label}
                  <ArrowUpRight aria-hidden />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <dl className="grid overflow-hidden rounded-xl text-sm ring-1 ring-border sm:grid-cols-[7rem_minmax(0,1fr)]">
            <dt className="flex items-center gap-1.5 bg-muted/60 px-4 pt-3 text-xs font-medium text-muted-foreground sm:py-3">
              <Mail className="size-3.5" aria-hidden />
              Para
            </dt>
            <dd className="flex flex-col gap-0.5 px-4 pt-1 pb-3 sm:py-3">
              <span className="font-medium">
                Encarregado(a) de dados da {incident.breach?.company}
                {recipient.contact && (
                  <span className="font-mono text-xs font-normal break-all"> · {recipient.contact}</span>
                )}
              </span>
              {!sent && <span className="text-xs text-muted-foreground">{recipient.hint}</span>}
            </dd>
            <dt className="flex items-center gap-1.5 border-t bg-muted/60 px-4 pt-3 text-xs font-medium text-muted-foreground sm:py-3">
              <AlignLeft className="size-3.5" aria-hidden />
              Assunto
            </dt>
            <dd className="px-4 pt-1 pb-3 sm:border-t sm:py-3">{notice.subject}</dd>
          </dl>

          {sent ? (
            <details className="group rounded-xl ring-1 ring-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground/80 select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                Ver a notificação enviada
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-4">
                <TextBlock text={notice.body} label="Texto da notificação" />
              </div>
            </details>
          ) : (
            <>
              <TextBlock text={notice.body} label="Texto da notificação" />
              <p className="text-xs text-muted-foreground">
                Complete os campos entre colchetes antes de enviar. O Radar360 guarda seu CPF e seu e-mail só como
                código irreversível (HMAC), por isso não consegue preenchê-los por você.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-5">
          {timeline.status === "not_sent" && (
            <>
              {mailto && (
                <a href={mailto} className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-3" })}>
                  <Mail aria-hidden />
                  Abrir no e-mail
                </a>
              )}
              <form action={recordLgpd.bind(null, incident.id, "sent")}>
                <SubmitButton size="sm" pendingText="Registrando..." className="h-8 px-3">
                  <Send aria-hidden />
                  Marquei como enviada
                </SubmitButton>
              </form>
            </>
          )}
          {(timeline.status === "waiting" || timeline.status === "overdue") && (
            <form action={recordLgpd.bind(null, incident.id, "answered")}>
              <SubmitButton size="sm" variant="outline" pendingText="Registrando..." className="h-8 px-3">
                <CheckCircle2 aria-hidden />A empresa respondeu
              </SubmitButton>
            </form>
          )}
          {sent && (
            <form action={recordLgpd.bind(null, incident.id, "reset")}>
              <SubmitButton size="sm" variant="ghost" pendingText="Desfazendo..." className="h-8 px-3">
                Desfazer o envio
              </SubmitButton>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t pt-5">
          <span className="text-xs font-medium text-muted-foreground">Base legal (Lei nº 13.709/2018)</span>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...notice.articles, ...(petition?.articles ?? [])]
              .filter((article, index, all) => all.findIndex((other) => other.ref === article.ref) === index)
              .map((article) => (
                <li key={article.ref} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
                  <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap ring-1 ring-border">
                    {article.ref}
                  </span>
                  <span className="leading-relaxed text-muted-foreground">{article.text}</span>
                </li>
              ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
