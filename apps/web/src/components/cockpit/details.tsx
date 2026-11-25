import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  FlaskConical,
  Hand,
  Lock,
  Router,
  ShieldAlert,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { openBreachPlan } from "@/app/painel/copiloto/actions";
import { ArrivalForm } from "@/components/copilot/arrival-form";
import { BreachCard } from "@/components/dashboard/breaches";
import { AgentCommand, FixList, ScanDetail, SeverityBadge } from "@/components/dashboard/network";
import { ScoreDetail } from "@/components/dashboard/score-breakdown";
import { ASSET_META, dataClassTone as chipTone, SEVERITY_ORDER } from "@/components/dashboard/styles";
import { SubmitButton } from "@/components/submit-button";
import type { AccountItem, AccountList } from "@/lib/accounts";
import type { BreachItem, Dashboard, DataClass, Finding, ScanSummary } from "@/lib/dashboard";
import { formatDate, formatMonth, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InspectorPanel } from "./inspector";
import { InspectTrigger } from "./inspector";
import {
  AGENT_FIXABLE_KINDS,
  deviceName,
  FINDING_POINTS,
  findingsOfDevice,
  panelKey,
  SCOPE_LABEL,
  scans,
  SEVERITY_TONE,
  worstSeverity,
} from "./model";
import { TONE_RAIL } from "./panel";

/*
 * Painéis da gaveta de detalhes, renderizados no servidor. A gaveta mostra um por vez; links entre
 * eles (InspectTrigger) empilham. Só dados da API e textos curados, nunca o dado vazado.
 */

const numberFormat = new Intl.NumberFormat("pt-BR");

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow text-[10px] text-muted-foreground">{children}</span>;
}

function Facts({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/[0.06] sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 bg-ink px-3 py-2.5">
          <dt className="eyebrow text-[9.5px] text-muted-foreground">{item.label}</dt>
          <dd className="text-[13px]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Linha clicável que abre outro painel da gaveta. */
function RowLink({
  target,
  rail,
  children,
}: {
  target: string;
  rail?: keyof typeof TONE_RAIL;
  children: React.ReactNode;
}) {
  return (
    <InspectTrigger
      target={target}
      className="group relative flex w-full items-center gap-3 rounded-lg bg-ink px-3.5 py-2.5 text-left ring-1 ring-white/[0.06] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {rail && <span className={cn("absolute inset-y-2.5 left-0 w-[2px] rounded-r", TONE_RAIL[rail])} aria-hidden />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </InspectTrigger>
  );
}

function PlanButton({ breachId, primary = false }: { breachId: string; primary?: boolean }) {
  return (
    <ArrivalForm action={openBreachPlan.bind(null, breachId)} className="shrink-0">
      <SubmitButton variant={primary ? "default" : "outline"} size="sm" pendingText="Abrindo..." className="h-8 px-3">
        <FileText aria-hidden />
        Plano de resposta
      </SubmitButton>
    </ArrivalForm>
  );
}

function ClassChips({ classes }: { classes: DataClass[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {[...classes]
        .sort((a, b) => b.weight - a.weight)
        .map((item) => (
          <li key={item.key} title={item.why} className={cn("rounded-md px-2 py-0.5 text-xs font-medium ring-1", chipTone(item.weight))}>
            {item.label}
          </li>
        ))}
    </ul>
  );
}

/* --------------------------------------------------------------------------------------------- */

function AssetsDetail({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        O monitoramento confere estes dados contra novos vazamentos a cada 6 horas e avisa só quando surge risco novo.
      </p>
      <ul className="flex flex-col gap-2.5">
        {dashboard.assets.map((asset) => {
          const { label, icon: Icon } = ASSET_META[asset.type];
          const found = dashboard.breaches.filter((breach) =>
            breach.assets.some((item) => item.type === asset.type && item.masked === asset.masked),
          );
          return (
            <li key={asset.id} className="flex flex-col gap-2.5 rounded-lg bg-ink p-3 ring-1 ring-white/[0.06]">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="truncate font-mono text-sm">{asset.masked}</span>
                </span>
                {asset.verifiedAt ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success ring-1 ring-success/30 ring-inset"
                    title={`Verificado em ${formatDate(asset.verifiedAt)}`}
                  >
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Verificado
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-white/10 ring-inset">
                    <Clock className="size-3.5" aria-hidden />
                    Pendente
                  </span>
                )}
              </div>
              {found.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2.5">
                  <span className="text-xs text-muted-foreground">Apareceu em:</span>
                  {found.map((breach) => (
                    <InspectTrigger
                      key={breach.id}
                      target={panelKey.breach(breach.id)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium ring-1 transition-colors outline-none ring-inset hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        breach.isNew ? "text-danger ring-danger/40" : "text-foreground/85 ring-white/15",
                      )}
                    >
                      {breach.company}
                    </InspectTrigger>
                  ))}
                </div>
              ) : (
                <span className="border-t border-white/[0.06] pt-2.5 text-xs text-success">Nenhum vazamento encontrado.</span>
              )}
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
        {dashboard.user.isDemo && (
          <li className="flex gap-2">
            <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              <span className="font-medium text-foreground">Na demo,</span> estes são dados da persona fictícia, já
              verificados para você ver o monitoramento funcionando.
            </span>
          </li>
        )}
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Guardamos só uma assinatura criptográfica (HMAC-SHA256) e a versão mascarada de cada dado, nunca o dado
            completo. Só monitoramos dados verificados como seus.
          </span>
        </li>
      </ul>
    </div>
  );
}

function AttributionNote({ attribution }: { attribution: AccountList["attribution"] }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      O serviço ter vazado não quer dizer que a sua conta estava no vazamento. Fonte:{" "}
      <a
        href={attribution.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 rounded text-foreground/85 underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {attribution.label}
        <ArrowUpRight className="size-3" aria-hidden />
        <span className="sr-only">(abre em nova aba)</span>
      </a>{" "}
      ({attribution.license}).
    </p>
  );
}

function ManageAccountsLink({ label = "Gerenciar em Minhas contas" }: { label?: string }) {
  return (
    <Link
      href="/painel/contas"
      className="group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-colors outline-none ring-inset hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex-1">{label}</span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </Link>
  );
}

function AccountsDetail({ data }: { data: AccountList }) {
  if (data.accounts.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Marque os serviços que você usa e veja os vazamentos públicos de cada um, com o plano de resposta.
        </p>
        <ManageAccountsLink label="Marcar os serviços que você usa" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <Facts
        items={[
          { label: "Serviços", value: <span className="font-mono text-lg">{data.summary.accounts}</span> },
          { label: "Com vazamento", value: <span className="font-mono text-lg">{data.summary.withBreaches}</span> },
          { label: "Vazamentos", value: <span className="font-mono text-lg">{data.summary.breaches}</span> },
        ]}
      />
      {data.summary.financialWithoutTwoFactor > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed ring-1 ring-warning/35">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-medium">Atenção:</span>{" "}
            {plural(data.summary.financialWithoutTwoFactor, "conta que mexe", "contas que mexem")} com dinheiro sem
            verificação em duas etapas.
          </span>
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {data.accounts.map((account) => (
          <li key={account.id}>
            <RowLink target={panelKey.service(account.id)} rail={account.breaches.length > 0 ? "warning" : "muted"}>
              <span className="flex items-center gap-2 text-sm font-medium">
                {account.name}
                {account.breaches.length > 0 && <ShieldAlert className="size-3.5 text-warning" aria-hidden />}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {account.domain} ·{" "}
                {account.breaches.length > 0 ? plural(account.breaches.length, "vazamento") : "nenhum vazamento"}
                {account.hasTwoFactor ? " · 2 etapas" : ""}
              </span>
            </RowLink>
          </li>
        ))}
      </ul>
      <AttributionNote attribution={data.attribution} />
      <ManageAccountsLink />
    </div>
  );
}

function ServiceDetail({ account, attribution }: { account: AccountItem; attribution: AccountList["attribution"] }) {
  return (
    <div className="flex flex-col gap-5">
      <Facts
        items={[
          { label: "Domínio", value: <span className="font-mono">{account.domain}</span> },
          { label: "Duas etapas", value: account.hasTwoFactor ? "Ativada" : "Não marcada" },
          { label: "Mexe com dinheiro", value: account.isFinancial ? "Sim" : "Não" },
        ]}
      />
      {!account.hasTwoFactor && account.isFinancial && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed ring-1 ring-warning/35">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
          Conta que mexe com dinheiro sem verificação em duas etapas: ative no app do serviço.
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Vazamentos públicos deste serviço</SectionLabel>
        {account.breaches.length === 0 ? (
          <p className="text-sm text-success">Nenhum vazamento público conhecido.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {account.breaches.map((breach) => (
              <li key={breach.id} className="flex flex-col gap-3 rounded-lg bg-ink p-3.5 ring-1 ring-white/[0.06]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{breach.company}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatMonth(breach.occurredAt)}
                      {breach.pwnCount ? ` · ${numberFormat.format(breach.pwnCount)} contas afetadas` : ""}
                    </span>
                  </span>
                  {breach.sourceUrl && (
                    <a
                      href={breach.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 rounded text-xs text-telemetry underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      Fonte
                      <ArrowUpRight className="size-3" aria-hidden />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  )}
                </div>
                <ClassChips classes={breach.dataClasses} />
                <PlanButton breachId={breach.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {account.breaches.length > 0 && <AttributionNote attribution={attribution} />}
      <ManageAccountsLink />
    </div>
  );
}

function BreachesDetail({ breaches }: { breaches: BreachItem[] }) {
  if (breaches.length === 0) {
    return <p className="text-sm text-success">Nenhum vazamento encontrado com os seus dados. Avisaremos se surgir algum.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Mostramos a fonte, as datas e as categorias expostas. Nunca o dado vazado.</p>
      {breaches.map((breach) => (
        <BreachCard key={breach.id} breach={breach} />
      ))}
    </div>
  );
}

function DataClassDetail({ info, breaches, points }: { info: DataClass; breaches: BreachItem[]; points: number }) {
  return (
    <div className="flex flex-col gap-5">
      <Facts
        items={[
          { label: "Pesa no score", value: <span className="font-mono text-rubi">+{points}</span> },
          { label: "Vazou em", value: plural(breaches.length, "lugar", "lugares") },
          { label: "Peso do tipo", value: <span className="font-mono">{info.weight}</span> },
        ]}
      />
      <div className="flex flex-col gap-2 rounded-lg bg-crimson/[0.07] p-4 ring-1 ring-crimson/25">
        <SectionLabel>O que fazer agora</SectionLabel>
        <p className="text-sm leading-relaxed">{info.action}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Por que importa</SectionLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">{info.why}</p>
      </div>
      <div className="flex flex-col gap-2">
        <SectionLabel>Onde vazou</SectionLabel>
        <ul className="flex flex-col gap-2">
          {breaches.map((breach) => (
            <li key={breach.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <RowLink target={panelKey.breach(breach.id)} rail={breach.isNew ? "danger" : "muted"}>
                  <span className="text-sm font-medium">{breach.company}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {breach.isNew ? "novo · " : ""}detectado em {formatDate(breach.detectedAt)}
                  </span>
                </RowLink>
              </div>
              <PlanButton breachId={breach.id} primary={breach.isNew} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AgentFixNote({ finding, scope }: { finding: Finding; scope: ScanSummary["scope"] }) {
  if (AGENT_FIXABLE_KINDS.has(finding.kind)) {
    return (
      <div className="flex flex-col gap-3 rounded-lg bg-success/[0.07] p-4 ring-1 ring-success/25">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4 text-success" aria-hidden />O agente corrige isso com o seu OK
        </span>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ele mostra o que vai mudar, pede SIM antes da correção e guarda como desfazer.
        </p>
        <AgentCommand mode={scope} label="Rode no seu computador:" />
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-ink p-3.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/[0.06]">
      <Hand className="mt-px size-4 shrink-0 text-foreground/70" aria-hidden />
      <span>
        <span className="font-medium text-foreground">Correção manual.</span> O agente não entra no roteador nem em
        outros aparelhos e nunca pede senha: siga a recomendação acima no painel do próprio aparelho.
      </span>
    </div>
  );
}

function FindingDetail({ finding, scan }: { finding: Finding; scan: ScanSummary }) {
  const device = deviceName(scan, finding.deviceIp);
  const where =
    [device ?? (scan.scope === "public" ? "Este computador" : null), finding.deviceIp].filter(Boolean).join(" · ") || "—";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        {FINDING_POINTS[finding.severity] > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            pesa <span className="text-rubi">+{FINDING_POINTS[finding.severity]}</span> no score
          </span>
        )}
      </div>
      <Facts
        items={[
          { label: "Rede", value: SCOPE_LABEL[scan.scope] },
          { label: "Aparelho", value: <span className="break-words">{where}</span> },
          { label: "Porta", value: <span className="font-mono">{finding.port ?? "—"}</span> },
        ]}
      />
      <div className="flex flex-col gap-2 rounded-lg bg-crimson/[0.07] p-4 ring-1 ring-crimson/25">
        <SectionLabel>O que fazer</SectionLabel>
        <p className="text-sm leading-relaxed">{finding.recommendation}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Por que importa</SectionLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">{finding.detail}</p>
      </div>
      <AgentFixNote finding={finding} scope={scan.scope} />
      <RowLink target={panelKey.network(scan.scope)}>
        <span className="text-sm font-medium">Ver a auditoria completa da {SCOPE_LABEL[scan.scope].toLowerCase()}</span>
      </RowLink>
    </div>
  );
}

function FindingsDetail({ dashboard }: { dashboard: Dashboard }) {
  const all = scans(dashboard)
    .flatMap((scan) => scan.findings.map((finding) => ({ finding, scan })))
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.finding.severity) - SEVERITY_ORDER.indexOf(b.finding.severity));
  if (all.length === 0) {
    return <p className="text-sm text-success">Nenhum problema nas auditorias de rede.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {all.map(({ finding, scan }) => (
        <li key={finding.id}>
          <RowLink target={panelKey.finding(finding.id)} rail={SEVERITY_TONE[finding.severity]}>
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {finding.title}
              <SeverityBadge severity={finding.severity} />
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {SCOPE_LABEL[scan.scope]}
              {deviceName(scan, finding.deviceIp) ? ` · ${deviceName(scan, finding.deviceIp)}` : ""}
              {finding.port !== null ? ` · porta ${finding.port}` : ""}
            </span>
          </RowLink>
        </li>
      ))}
    </ul>
  );
}

function FixesDetail({ dashboard }: { dashboard: Dashboard }) {
  const withFixes = scans(dashboard).filter((scan) => scan.fixes.length > 0);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        O agente corrige o próprio computador e remove portas abertas no seu roteador (UPnP), uma ação por vez, sempre
        depois do seu SIM. Ele nunca entra no roteador, nunca pede senha e não mexe em outros aparelhos.
      </p>
      {withFixes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma correção aplicada ainda.</p>
      ) : (
        withFixes.map((scan) => (
          <div key={scan.id} className="flex flex-col gap-2">
            <SectionLabel>{SCOPE_LABEL[scan.scope]}</SectionLabel>
            <FixList fixes={scan.fixes} />
          </div>
        ))
      )}
      <div className="flex items-start gap-2.5 rounded-lg bg-ink p-3.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/[0.06]">
        <Undo2 className="mt-px size-4 shrink-0 text-foreground/70" aria-hidden />
        <span>
          Para desfazer, rode <code className="font-mono text-foreground">python scanner.py --desfazer</code> no mesmo
          computador.
        </span>
      </div>
    </div>
  );
}

function DeviceDetail({ scan, ip }: { scan: ScanSummary; ip: string }) {
  const device = scan.devices.find((item) => item.ip === ip);
  if (!device) return null;
  const isGateway = ip === scan.network.gateway;
  const findings = findingsOfDevice(scan, ip);
  const fixes = isGateway ? scan.fixes.filter((fix) => fix.target === "router") : [];
  const worst = worstSeverity(findings);
  return (
    <div className="flex flex-col gap-5">
      <Facts
        items={[
          { label: "Endereço", value: <span className="font-mono">{device.ip}</span> },
          {
            label: "Tipo",
            value: (
              <span className="flex items-center gap-1.5">
                {isGateway ? <Router className="size-3.5" aria-hidden /> : <Cpu className="size-3.5" aria-hidden />}
                {isGateway ? "Roteador" : (device.vendor ?? "Aparelho")}
              </span>
            ),
          },
          {
            label: "Portas abertas",
            value: (
              <span className="font-mono">{device.openPorts.length > 0 ? device.openPorts.join(", ") : "nenhuma"}</span>
            ),
          },
        ]}
      />
      {fixes.length > 0 && <FixList fixes={fixes} />}
      <div className="flex flex-col gap-2">
        <SectionLabel>Achados neste aparelho</SectionLabel>
        {findings.length === 0 ? (
          <p className="text-sm text-success">Nenhum problema encontrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {findings.map((finding) => (
              <li key={finding.id}>
                <RowLink target={panelKey.finding(finding.id)} rail={SEVERITY_TONE[finding.severity]}>
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {finding.title}
                    <SeverityBadge severity={finding.severity} />
                  </span>
                  {finding.port !== null && (
                    <span className="font-mono text-[11px] text-muted-foreground">porta {finding.port}</span>
                  )}
                </RowLink>
              </li>
            ))}
          </ul>
        )}
      </div>
      {worst && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          O agente só olha o que o aparelho deixa aberto na rede. Ele nunca tenta senhas nem invade.
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- */

/** Monta todos os painéis da gaveta, por chave. */
export function buildPanels(dashboard: Dashboard, accounts: AccountList | null): Record<string, InspectorPanel> {
  const panels: Record<string, InspectorPanel> = {};

  panels.assets = {
    eyebrow: "Identidade",
    title: "Dados monitorados",
    content: <AssetsDetail dashboard={dashboard} />,
  };

  panels.score = {
    eyebrow: "Score de exposição",
    title: "Como calculamos o seu score",
    content: <ScoreDetail score={dashboard.score} />,
  };

  panels.breaches = {
    eyebrow: "Identidade",
    title: `Vazamentos com seus dados (${dashboard.breaches.length})`,
    content: <BreachesDetail breaches={dashboard.breaches} />,
  };

  for (const breach of dashboard.breaches) {
    panels[panelKey.breach(breach.id)] = {
      eyebrow: breach.isNew ? "Vazamento novo" : "Vazamento",
      title: breach.company,
      content: <BreachCard breach={breach} />,
    };
  }

  const leakPoints = new Map(
    dashboard.score.factors.filter((factor) => factor.group === "leaks").map((factor) => [factor.label, factor.points]),
  );
  const classes = new Map<string, { info: DataClass; breaches: BreachItem[] }>();
  for (const breach of dashboard.breaches) {
    for (const info of breach.dataClasses) {
      const entry = classes.get(info.key) ?? { info, breaches: [] };
      entry.breaches.push(breach);
      classes.set(info.key, entry);
    }
  }
  for (const { info, breaches } of classes.values()) {
    if (!info.action) continue;
    panels[panelKey.dataClass(info.key)] = {
      eyebrow: "Ação · dado vazado",
      title: info.label,
      content: <DataClassDetail info={info} breaches={breaches} points={leakPoints.get(info.label) ?? info.weight} />,
    };
  }

  panels.findings = {
    eyebrow: "Rede",
    title: "Alertas das auditorias de rede",
    content: <FindingsDetail dashboard={dashboard} />,
  };
  panels.fixes = {
    eyebrow: "Agente local",
    title: "Corrigido pelo agente, com o seu OK",
    content: <FixesDetail dashboard={dashboard} />,
  };

  panels[panelKey.network("home")] = {
    eyebrow: "Agente local · rede de casa",
    title: "Rede de casa",
    content: (
      <ScanDetail scan={dashboard.network.home} agentMode="home" emptyText="Nenhuma auditoria da rede de casa ainda." />
    ),
  };
  panels[panelKey.network("public")] = {
    eyebrow: "Agente local · Wi-Fi público",
    title: "Wi-Fi público · este computador",
    content: (
      <ScanDetail scan={dashboard.network.public} agentMode="public" emptyText="Nenhuma auditoria em rede pública ainda." />
    ),
  };

  for (const scan of scans(dashboard)) {
    for (const finding of scan.findings) {
      panels[panelKey.finding(finding.id)] = {
        eyebrow: `Alerta · ${SCOPE_LABEL[scan.scope].toLowerCase()}`,
        title: finding.title,
        content: <FindingDetail finding={finding} scan={scan} />,
      };
    }
  }

  const home = dashboard.network.home;
  if (home) {
    for (const device of home.devices) {
      panels[panelKey.device(device.ip)] = {
        eyebrow: "Aparelho na rede de casa",
        title: device.model ?? device.hostname ?? "Aparelho sem nome",
        content: <DeviceDetail scan={home} ip={device.ip} />,
      };
    }
  }

  panels.accounts = {
    eyebrow: "Minhas contas",
    title: "Serviços que você usa",
    content: accounts ? (
      <AccountsDetail data={accounts} />
    ) : (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Não conseguimos carregar as suas contas agora.</p>
        <ManageAccountsLink label="Abrir Minhas contas" />
      </div>
    ),
  };
  if (accounts) {
    for (const account of accounts.accounts) {
      panels[panelKey.service(account.id)] = {
        eyebrow: "Minhas contas",
        title: account.name,
        content: <ServiceDetail account={account} attribution={accounts.attribution} />,
      };
    }
  }

  return panels;
}
