import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  ChevronRight,
  FileWarning,
  Megaphone,
  MessageSquareText,
  Radar,
  Scale,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import { openBreachPlan } from "./actions";
import { BreachPlanForm } from "@/components/copilot/breach-plan-form";
import { CompanyNoticeForm } from "@/components/copilot/company-notice-form";
import { TYPE_ICON } from "@/components/copilot/incident-meta";
import { PHASE_META, PHASE_ORDER } from "@/components/copilot/phase-style";
import { ProgressMeter } from "@/components/copilot/plan";
import { ReportForm } from "@/components/copilot/report-form";
import { LgpdBadge, StateAlert, StateBadge } from "@/components/copilot/status";
import { ErrorState } from "@/components/shell/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchIncidents, type IncidentListItem } from "@/lib/incidents";
import { formatDate } from "@/lib/format";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Copiloto · Olharium" };

/** Cartões que recebem uma âncora do mapa do topo. O cabeçalho fixo tem 56 px. */
const ANCHOR = "scroll-mt-20";

const ENTRY_LINK =
  "inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-medium text-foreground ring-1 ring-white/10 transition-colors outline-none hover:bg-muted hover:ring-white/20 focus-visible:ring-3 focus-visible:ring-ring/60";

/** Mapa do fluxo: de onde o incidente vem e o que cada entrada entrega. Os links levam a cada formulário. */
function FlowMap({ incidentCount }: { incidentCount: number }) {
  return (
    <ol
      aria-label="Como o copiloto funciona"
      className="grid gap-px overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/[0.07] sm:grid-cols-2 lg:grid-cols-[37fr_20fr_25fr_18fr]"
    >
      <li className="flex flex-col gap-2.5 bg-card px-4 py-4">
        <FlowLabel index="01" label="Entrada" />
        <div className="flex flex-wrap gap-1.5">
          <a href="#o-que-aconteceu" className={ENTRY_LINK}>
            <MessageSquareText className="size-3 text-muted-foreground" aria-hidden />
            Você conta
          </a>
          <a href="#empresa-avisou" className={ENTRY_LINK}>
            <Megaphone className="size-3 text-muted-foreground" aria-hidden />
            Empresa avisou
          </a>
          <a href="#vazamentos-detectados" className={ENTRY_LINK}>
            <Radar className="size-3 text-muted-foreground" aria-hidden />
            Monitoramento achou
          </a>
        </div>
      </li>
      <li className="flex flex-col gap-2.5 bg-card px-4 py-4">
        <FlowLabel index="02" label="Plano" />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs font-semibold tracking-[0.12em]">
          {PHASE_ORDER.map((key, index) => (
            <span key={key} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-muted-foreground/60" aria-hidden>
                  ·
                </span>
              )}
              <span className={index === 0 ? "text-rubi" : "text-foreground"}>{PHASE_META[key].tag}</span>
            </span>
          ))}
        </p>
        <p className="hidden text-xs leading-relaxed text-muted-foreground sm:block">Passos com prazo e links oficiais.</p>
      </li>
      <li className="flex flex-col gap-2.5 bg-card px-4 py-4">
        <FlowLabel index="03" label="LGPD" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">Quando há uma empresa,</span> a notificação ao encarregado sai pronta. Sem
          resposta em 15 dias, a petição à ANPD também.
        </p>
      </li>
      <li className="flex flex-col gap-2.5 bg-card px-4 py-4">
        <FlowLabel index="04" label="Acompanhar" />
        <a href="#seus-incidentes" className={cn(ENTRY_LINK, "w-fit")}>
          <FileWarning className="size-3 text-muted-foreground" aria-hidden />
          Seus incidentes
          <span className="font-mono text-muted-foreground tabular-nums">({incidentCount})</span>
        </a>
        <p className="hidden text-xs leading-relaxed text-muted-foreground sm:block">Marque os passos e registre o envio.</p>
      </li>
    </ol>
  );
}

function FlowLabel({ index, label }: { index: string; label: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
      <span className="text-rubi">{index}</span>
      {label}
    </span>
  );
}

/** Cabeçalho comum dos cartões de entrada: de onde vem e o que você recebe. */
function EntryHeader({
  icon: Icon,
  eyebrow,
  title,
  titleId,
  description,
  output,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  titleId: string;
  description: React.ReactNode;
  output: string;
}) {
  return (
    <CardHeader className="border-b border-white/[0.06]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="eyebrow text-muted-foreground">{eyebrow}</span>
          <CardTitle>
            <h2 id={titleId} className="text-lg leading-snug font-semibold tracking-tight">
              {title}
            </h2>
          </CardTitle>
          <CardDescription className="leading-relaxed">{description}</CardDescription>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            <ArrowRight className="size-3 text-rubi" aria-hidden />
            Você recebe: <span className="text-foreground">{output}</span>
          </p>
        </div>
      </div>
    </CardHeader>
  );
}

function IncidentRow({ incident }: { incident: IncidentListItem }) {
  const Icon = TYPE_ICON[incident.type] ?? ScanSearch;
  const origin =
    incident.breachSource === "HIBP"
      ? "Vazamento público de um serviço que você usa"
      : incident.source === "DETECTED"
        ? "Detectado pelo monitoramento"
        : incident.type === "DATA_BREACH"
          ? "Aviso de empresa, informado por você"
          : "Relatado por você";
  return (
    <li>
      <Link
        href={`/painel/copiloto/${incident.id}`}
        className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-foreground/80 ring-1 ring-white/[0.06]">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm leading-snug font-medium text-foreground">{incident.title}</span>
          <span className="text-xs text-muted-foreground">
            {incident.typeLabel} · {origin} ·{" "}
            <time dateTime={incident.createdAt} className="font-mono">
              {formatDate(incident.createdAt)}
            </time>
          </span>
          {incident.lgpdStatus && <LgpdBadge status={incident.lgpdStatus} />}
          <ProgressMeter done={incident.progress.done} total={incident.progress.total} className="mt-1" />
        </div>
        <ChevronRight
          className="mt-2.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}

export default async function CopilotPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const token = await getSessionToken();
  if (!token) redirect("/");

  const [result, { erro }] = await Promise.all([fetchIncidents(token), searchParams]);
  if (!result.ok && result.reason === "unauthorized") redirect("/?sessao=expirada");

  if (!result.ok) {
    return <ErrorState title="Não conseguimos carregar o copiloto" retryHref="/painel/copiloto" />;
  }

  const { incidents, breachesWithoutPlan } = result.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <span className="eyebrow text-rubi">Copiloto de resposta a incidentes</span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Do susto ao plano, em três prazos.</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            Conte o que aconteceu, registre o aviso de uma empresa ou abra um vazamento que o monitoramento achou. Cada
            caminho vira um plano com prazo, e você marca o que já fez.
          </p>
        </div>
        <FlowMap incidentCount={incidents.length} />
      </header>

      {erro === "plano" && (
        <StateAlert tone="danger" label="Erro." role="alert">
          Não conseguimos abrir o plano desse vazamento agora. Tente de novo em instantes.
        </StateAlert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          {/* Único destaque de HUD da tela: a entrada principal. */}
          <div id="o-que-aconteceu" className={cn("hud-corners -m-2 p-2 [--hud-color:var(--rubi)] [--hud-len:18px]", ANCHOR)}>
            <Card>
              <EntryHeader
                icon={MessageSquareText}
                eyebrow="Entrada · Você conta"
                title="O que aconteceu?"
                titleId="titulo-relato"
                description="Golpe do Pix, celular roubado, WhatsApp clonado, link falso ou conta aberta em seu nome."
                output="plano T+15MIN · T+1H · T+24H"
              />
              <CardContent>
                <ReportForm />
              </CardContent>
            </Card>
          </div>

          <Card id="empresa-avisou" className={ANCHOR}>
            <EntryHeader
              icon={Megaphone}
              eyebrow="Entrada · Empresa avisou"
              title="Uma empresa avisou que vazou seus dados?"
              titleId="titulo-empresa"
              description="Informe a empresa e o que vazou. A notificação pede a ela, em até 15 dias, quais dados seus foram afetados e o que foi feito."
              output="plano + notificação LGPD"
            />
            <CardContent>
              <CompanyNoticeForm />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
          <Card id="seus-incidentes" className={ANCHOR}>
            <CardHeader className="border-b border-white/[0.06]">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
                  <FileWarning className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="eyebrow text-muted-foreground">Acompanhamento</span>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <h2 id="titulo-incidentes" className="text-lg font-semibold tracking-tight">
                      Seus incidentes
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {String(incidents.length).padStart(2, "0")}
                    </span>
                  </CardTitle>
                  <CardDescription>Planos em andamento e o prazo de cada notificação LGPD.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm leading-relaxed text-muted-foreground">
                  Nenhum incidente ainda. Quando você relatar algo, registrar o aviso de uma empresa ou abrir o plano de
                  um vazamento, ele aparece aqui.
                </p>
              ) : (
                <ul className="-mx-3 flex flex-col divide-y divide-white/[0.05]">
                  {incidents.map((incident) => (
                    <IncidentRow key={incident.id} incident={incident} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card id="vazamentos-detectados" className={ANCHOR}>
            <EntryHeader
              icon={Radar}
              eyebrow="Entrada · Monitoramento achou"
              title="Vazamentos sem plano"
              titleId="titulo-detectados"
              description={
                <>
                  Vazamentos com os seus dados verificados. Os dos serviços que você usa ficam em{" "}
                  <Link
                    href="/painel/contas"
                    className="rounded-sm text-foreground underline underline-offset-2 outline-none hover:text-telemetry focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    Minhas contas
                  </Link>
                  .
                </>
              }
              output="plano + notificação LGPD"
            />
            <CardContent>
              {breachesWithoutPlan.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm leading-relaxed text-muted-foreground">
                  Todo vazamento detectado já tem plano. O monitoramento continua checando os seus dados; o resumo fica
                  no{" "}
                  <Link
                    href="/painel"
                    className="rounded-sm text-foreground underline underline-offset-2 outline-none hover:text-telemetry focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    Painel
                  </Link>
                  .
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {breachesWithoutPlan.map((breach) => (
                    <li
                      key={breach.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg bg-ink px-3 py-2.5 ring-1",
                        breach.isNew ? "ring-warning/30" : "ring-white/[0.06]",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {breach.company}
                          {breach.isNew && (
                            <StateBadge tone="warning" icon={BellRing}>
                              Novo
                            </StateBadge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Detectado em{" "}
                          <time dateTime={breach.detectedAt} className="font-mono">
                            {formatDate(breach.detectedAt)}
                          </time>
                        </span>
                      </div>
                      <BreachPlanForm action={openBreachPlan.bind(null, breach.id)} company={breach.company} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-2.5 rounded-lg bg-ink px-4 py-3 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/[0.06]">
        <Scale className="mt-px size-3.5 shrink-0 text-rubi" aria-hidden />
        <span>
          <span className="font-mono tracking-wider text-foreground uppercase">Olharium</span> · Orientações
          informativas, baseadas em fontes oficiais. Não é assessoria jurídica.
        </span>
      </p>
    </main>
  );
}
