import { AlertTriangle, ArrowUpRight, CheckCircle2, Hourglass, Mail, Scale, Send } from "lucide-react";
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
    <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da notificação LGPD">
      {STAGES.map((stage, index) => {
        const done = index < current;
        const active = index === current || (status === "overdue" && index === 2);
        return (
          <li key={stage.key} className="flex flex-col gap-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full",
                done ? "bg-emerald-600" : active ? (status === "overdue" ? "bg-red-600" : "bg-foreground") : "bg-muted",
              )}
            />
            <span className={cn("text-xs", done || active ? "font-medium text-foreground" : "text-muted-foreground")}>
              {index + 1}. {stage.label}
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
      <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

function StatusBanner({ lgpd }: { lgpd: Lgpd }) {
  const { timeline } = lgpd;
  if (timeline.status === "waiting" && timeline.sentAt && timeline.deadline) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
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
      <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          O prazo terminou em <strong>{formatDate(timeline.deadline)}</strong> sem resposta. Você já pode levar o caso à
          ANPD: a petição abaixo está pronta.
        </p>
      </div>
    );
  }
  if (timeline.status === "answered" && timeline.answeredAt) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
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
    <Card id="lgpd" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4 text-muted-foreground" aria-hidden />
          Notificação LGPD ao encarregado
        </CardTitle>
        <CardDescription>
          A empresa precisa dizer quais dados seus foram afetados e o que fez a respeito. Sem resposta em 15 dias, o
          próximo passo é a ANPD.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Stages status={timeline.status} />
        <StatusBanner lgpd={lgpd} />

        {petition && (
          <div className="flex flex-col gap-4 rounded-xl border border-red-200 p-4">
            <h3 className="font-semibold">Petição à ANPD</h3>
            <TextBlock text={petition.text} label="Texto da petição" />
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
              {petition.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              {petition.links.map((link, index) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: index === 0 ? "default" : "outline", size: "sm" })}
                >
                  {link.label}
                  <ArrowUpRight aria-hidden />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Para</span>
            <span className="font-medium">
              Encarregado(a) de dados da {incident.breach?.company}
              {recipient.contact && <span className="font-mono text-xs font-normal"> · {recipient.contact}</span>}
            </span>
            {!sent && <span className="text-xs text-muted-foreground">{recipient.hint}</span>}
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Assunto</span>
            <span>{notice.subject}</span>
          </div>

          {sent ? (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-foreground/80 select-none hover:text-foreground">
                Ver a notificação enviada
              </summary>
              <div className="mt-3">
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

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {timeline.status === "not_sent" && (
            <>
              {mailto && (
                <a href={mailto} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Mail aria-hidden />
                  Abrir no e-mail
                </a>
              )}
              <form action={recordLgpd.bind(null, incident.id, "sent")}>
                <SubmitButton size="sm" pendingText="Registrando...">
                  <Send aria-hidden />
                  Marquei como enviada
                </SubmitButton>
              </form>
            </>
          )}
          {(timeline.status === "waiting" || timeline.status === "overdue") && (
            <form action={recordLgpd.bind(null, incident.id, "answered")}>
              <SubmitButton size="sm" variant="outline" pendingText="Registrando...">
                <CheckCircle2 aria-hidden />A empresa respondeu
              </SubmitButton>
            </form>
          )}
          {sent && (
            <form action={recordLgpd.bind(null, incident.id, "reset")}>
              <SubmitButton size="sm" variant="ghost" pendingText="Desfazendo...">
                Desfazer o envio
              </SubmitButton>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <span className="text-xs font-medium text-muted-foreground">Base legal (Lei nº 13.709/2018)</span>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...notice.articles, ...(petition?.articles ?? [])]
              .filter((article, index, all) => all.findIndex((other) => other.ref === article.ref) === index)
              .map((article) => (
                <li key={article.ref} className="flex flex-col rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <span className="font-semibold">{article.ref}</span>
                  <span className="text-muted-foreground">{article.text}</span>
                </li>
              ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
