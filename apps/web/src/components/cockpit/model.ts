import type { AccountList } from "@/lib/accounts";
import type { BreachItem, Dashboard, DataClass, Finding, ScanSummary, Severity } from "@/lib/dashboard";
import { plural } from "@/lib/format";
import { HIGH_WEIGHT, SEVERITY_ORDER, SEVERITY_STYLE } from "@/components/dashboard/styles";

/*
 * Modelo da central de comando: transforma o JSON do painel em fila de ações, linha do tempo e mapa
 * de exposição. Tudo determinístico, a partir dos dados da API e das tabelas curadas. Nada vem de IA.
 *
 * Cada item clicável aponta para um painel da gaveta de detalhes por uma chave ("breach:<id>",
 * "finding:<id>"...). As chaves são montadas aqui e os painéis em details.tsx.
 */

export type Tone = "danger" | "warning" | "neutral" | "success" | "muted";

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
  info: "muted",
};

/** Pontos de cada achado de rede no score. Iguais aos da API (crítico 12, alto 8, médio 4, baixo 1). */
export const FINDING_POINTS: Record<Severity, number> = { critical: 12, high: 8, medium: 4, low: 1, info: 0 };

export const SCOPE_LABEL: Record<ScanSummary["scope"], string> = { home: "Rede de casa", public: "Wi-Fi público" };

/** Achados que o agente sabe corrigir com o OK do usuário. Igual a FIXABLE_FINDING_KINDS do scanner.py. */
export const AGENT_FIXABLE_KINDS = new Set([
  "firewall_disabled",
  "firewall_profile_disabled",
  "firewall_partially_disabled",
  "network_marked_private",
  "exposed_smb",
  "exposed_rdp",
  "exposed_database",
  "exposed_dev_server",
  "upnp_port_mapping",
]);

export const panelKey = {
  breach: (id: string) => `breach:${id}`,
  dataClass: (key: string) => `class:${key}`,
  finding: (id: string) => `finding:${id}`,
  network: (scope: ScanSummary["scope"]) => `net:${scope}`,
  device: (ip: string) => `device:${ip}`,
  service: (id: string) => `service:${id}`,
} as const;

export function worstSeverity(findings: Finding[]): Severity | null {
  return SEVERITY_ORDER.find((severity) => findings.some((finding) => finding.severity === severity)) ?? null;
}

export function dataClassTone(weight: number): Tone {
  if (weight >= HIGH_WEIGHT) return "danger";
  if (weight >= 4) return "warning";
  return "neutral";
}

/** Rótulo curto para o mapa: tira o "(fictícia)" e corta por palavras. */
export function shortLabel(text: string, max = 14): string {
  const words = text.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > max) break;
    out = next;
  }
  return out || `${(words[0] ?? text).slice(0, max - 1)}…`;
}

export function deviceName(scan: ScanSummary, ip: string | null): string | null {
  if (!ip) return null;
  const device = scan.devices.find((item) => item.ip === ip);
  return device?.model ?? device?.hostname ?? null;
}

/** Achados de um aparelho. Na rede de casa, achados sem IP ficam com o roteador. */
export function findingsOfDevice(scan: ScanSummary, ip: string): Finding[] {
  const isGateway = ip === scan.network.gateway;
  return scan.findings.filter((finding) => finding.deviceIp === ip || (isGateway && finding.deviceIp === null));
}

export function scans(dashboard: Dashboard): ScanSummary[] {
  return [dashboard.network.home, dashboard.network.public].filter((scan): scan is ScanSummary => scan !== null);
}

/* ------------------------------------------------------------------------------------------------ */
/* Fila de ações                                                                                     */
/* ------------------------------------------------------------------------------------------------ */

export interface ActionStep {
  key: string;
  target: string;
  kind: "leak" | "network";
  title: string;
  source: string;
  description: string;
  /** Quanto o item pesa no score hoje (fator da API ou pontos da gravidade). */
  points: number;
  tone: Tone;
  severity: Severity | null;
}

/** As ações que mais reduzem o risco, com textos da tabela curada e das recomendações do agente. */
export function buildActionSteps(dashboard: Dashboard, limit = 6): ActionStep[] {
  const leakPoints = new Map(
    dashboard.score.factors.filter((factor) => factor.group === "leaks").map((factor) => [factor.label, factor.points]),
  );

  const classes = new Map<string, { info: DataClass; companies: string[] }>();
  for (const breach of dashboard.breaches) {
    for (const info of breach.dataClasses) {
      if (!info.action) continue;
      const entry = classes.get(info.key) ?? { info, companies: [] };
      entry.companies.push(shortLabel(breach.company, 24));
      classes.set(info.key, entry);
    }
  }

  const steps: Array<ActionStep & { weight: number }> = [...classes.values()].map(({ info, companies }) => ({
    key: `leak-${info.key}`,
    target: panelKey.dataClass(info.key),
    kind: "leak",
    title: info.label,
    source: `Vazou em ${companies.join(" e ")}`,
    description: info.action ?? "",
    points: leakPoints.get(info.label) ?? info.weight,
    tone: dataClassTone(info.weight),
    severity: null,
    weight: info.weight,
  }));

  for (const scan of scans(dashboard)) {
    for (const finding of scan.findings) {
      if (finding.severity !== "critical" && finding.severity !== "high" && finding.severity !== "medium") continue;
      const device = deviceName(scan, finding.deviceIp);
      steps.push({
        key: `net-${finding.id}`,
        target: panelKey.finding(finding.id),
        kind: "network",
        title: finding.title,
        source: [SCOPE_LABEL[scan.scope], device ?? (scan.scope === "public" ? "este computador" : null)]
          .filter(Boolean)
          .join(" · "),
        description: finding.recommendation,
        points: FINDING_POINTS[finding.severity],
        tone: SEVERITY_TONE[finding.severity],
        severity: finding.severity,
        weight: FINDING_POINTS[finding.severity],
      });
    }
  }

  steps.sort((a, b) => b.points - a.points || b.weight - a.weight);
  return steps.slice(0, limit);
}

/* ------------------------------------------------------------------------------------------------ */
/* Linha do tempo                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

export interface ActivityItem {
  key: string;
  at: string;
  kind: "breach" | "scan" | "fix";
  tone: Tone;
  title: string;
  meta: string;
  target: string;
}

function severitySummary(scan: ScanSummary): string {
  const parts = SEVERITY_ORDER.filter((severity) => severity !== "info" && scan.bySeverity[severity] > 0).map(
    (severity) => `${scan.bySeverity[severity]} ${SEVERITY_STYLE[severity].label.toLowerCase()}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "nenhum problema";
}

export function buildActivity(dashboard: Dashboard): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const breach of dashboard.breaches) {
    items.push({
      key: `breach-${breach.id}`,
      at: breach.detectedAt,
      kind: "breach",
      tone: breach.isNew ? "danger" : "warning",
      title: `Vazamento detectado em ${shortLabel(breach.company, 28)}`,
      meta: `${plural(breach.assets.length, "dado seu", "dados seus")} · ${plural(breach.dataClasses.length, "categoria")}`,
      target: panelKey.breach(breach.id),
    });
  }

  for (const scan of scans(dashboard)) {
    const worst = worstSeverity(scan.findings);
    items.push({
      key: `scan-${scan.id}`,
      at: scan.finishedAt,
      kind: "scan",
      tone: worst ? SEVERITY_TONE[worst] : "success",
      title: scan.scope === "home" ? "Auditoria da rede de casa" : "Auditoria em Wi-Fi público",
      meta: severitySummary(scan),
      target: panelKey.network(scan.scope),
    });
    for (const fix of scan.fixes) {
      items.push({
        key: `fix-${scan.id}-${fix.kind}-${fix.appliedAt}`,
        at: fix.appliedAt,
        kind: "fix",
        tone: "success",
        title: fix.title,
        meta: `Agente, com o seu OK · ${fix.target === "router" ? "no roteador" : "neste computador"}`,
        target: panelKey.network(scan.scope),
      });
    }
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/* ------------------------------------------------------------------------------------------------ */
/* Mapa de exposição                                                                                 */
/* ------------------------------------------------------------------------------------------------ */

/*
 * Layout radial em elipse: você no centro; no anel de dentro, os seus dados, as suas redes e as suas
 * contas; no anel de fora, o que ameaça cada um (vazamentos, aparelhos, serviços). Cada grupo tem o
 * seu setor: identidade em cima, contas embaixo à direita, rede embaixo à esquerda (graus: 0 = direita,
 * sentido horário, porque o y do SVG cresce para baixo).
 */
export interface MapGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  inner: { rx: number; ry: number };
  outer: { rx: number; ry: number };
}

/** Desenho largo (tablet e computador) e alto (celular): mesmos setores, elipses diferentes. */
export const MAP_WIDE: MapGeometry = {
  width: 640,
  height: 500,
  cx: 320,
  cy: 246,
  inner: { rx: 150, ry: 118 },
  outer: { rx: 262, ry: 198 },
};

export const MAP_TALL: MapGeometry = {
  width: 360,
  height: 470,
  cx: 180,
  cy: 232,
  inner: { rx: 90, ry: 108 },
  outer: { rx: 152, ry: 188 },
};

export type MapIcon =
  | "you"
  | "email"
  | "cpf"
  | "phone"
  | "home"
  | "wifi"
  | "accounts"
  | "breach"
  | "router"
  | "device"
  | "laptop"
  | "service";

export interface MapNode {
  id: string;
  x: number;
  y: number;
  ring: 0 | 1 | 2;
  label: string;
  /** Rótulo para o mapa do celular, quando o normal não cabe. */
  compactLabel?: string;
  sub: string | null;
  icon: MapIcon;
  tone: Tone;
  target: string;
  srLabel: string;
  fixes: number;
  pulse: boolean;
  dim: boolean;
}

export interface MapEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  tone: Tone;
  flow: boolean;
}

export interface MapReadout {
  sector: "identity" | "network" | "accounts";
  label: string;
  value: string;
}

export interface ExposureMap {
  nodes: MapNode[];
  edges: MapEdge[];
  readouts: MapReadout[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function onRing(geo: MapGeometry, ring: "inner" | "outer", degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const { rx, ry } = geo[ring];
  return { x: round(geo.cx + rx * Math.cos(radians)), y: round(geo.cy + ry * Math.sin(radians)) };
}

/** Ângulos igualmente espaçados em torno de um centro, sem passar de `span` graus no total. */
function evenly(count: number, center: number, step: number, span: number): number[] {
  if (count <= 1) return [center];
  const gap = Math.min(step, span / (count - 1));
  const start = center - (gap * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) => start + gap * index);
}

/** Afasta ângulos vizinhos para no mínimo `min` graus, dentro de [lo, hi]. */
function spread<T extends { angle: number }>(items: T[], min: number, lo: number, hi: number): T[] {
  const sorted = [...items].sort((a, b) => a.angle - b.angle);
  for (let index = 0; index < sorted.length; index++) {
    sorted[index].angle = Math.max(sorted[index].angle, lo);
    if (index > 0 && sorted[index].angle - sorted[index - 1].angle < min) {
      sorted[index].angle = sorted[index - 1].angle + min;
    }
  }
  const overflow = sorted.length > 0 ? sorted[sorted.length - 1].angle - hi : 0;
  if (overflow > 0) {
    for (const item of sorted) item.angle = Math.max(lo, item.angle - overflow);
  }
  return sorted;
}

function toneOfSeverity(severity: Severity | null, fallback: Tone): Tone {
  return severity ? SEVERITY_TONE[severity] : fallback;
}

const ASSET_ICON = { EMAIL: "email", CPF: "cpf", PHONE: "phone" } as const;
const ASSET_LABEL = { EMAIL: "E-mail", CPF: "CPF", PHONE: "Telefone" } as const;

function breachTone(breach: BreachItem): Tone {
  if (breach.isNew) return "danger";
  return breach.dataClasses.some((info) => info.weight >= HIGH_WEIGHT) ? "warning" : "neutral";
}

const MAX_BREACHES = 6;
const MAX_DEVICES = 6;
const MAX_SERVICES = 6;

export function buildExposureMap(
  dashboard: Dashboard,
  accounts: AccountList | null,
  geo: MapGeometry = MAP_WIDE,
): ExposureMap {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const center = { x: geo.cx, y: geo.cy };

  const link = (id: string, from: { x: number; y: number }, to: { x: number; y: number }, tone: Tone, flow = false) =>
    edges.push({ id, from, to, tone, flow });

  nodes.push({
    id: "you",
    ...center,
    ring: 0,
    label: "Você",
    sub: null,
    icon: "you",
    tone: "neutral",
    target: "assets",
    srLabel: "Você: ver os dados monitorados",
    fixes: 0,
    pulse: false,
    dim: false,
  });

  /* Identidade: dados monitorados (dentro) e vazamentos (fora), em cima. */
  const assetAngles = evenly(dashboard.assets.length, -90, 50, 120);
  const assetPositions = new Map<string, { angle: number; point: { x: number; y: number } }>();
  const breaches = [...dashboard.breaches]
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || (a.detectedAt < b.detectedAt ? 1 : -1))
    .slice(0, MAX_BREACHES);

  dashboard.assets.forEach((asset, index) => {
    const angle = assetAngles[index];
    const point = onRing(geo, "inner", angle);
    const linked = breaches.filter((breach) =>
      breach.assets.some((item) => item.type === asset.type && item.masked === asset.masked),
    );
    const tone: Tone = linked.some((breach) => breach.isNew) ? "danger" : linked.length > 0 ? "warning" : "success";
    assetPositions.set(`${asset.type}|${asset.masked}`, { angle, point });
    nodes.push({
      id: `asset-${asset.id}`,
      ...point,
      ring: 1,
      label: ASSET_LABEL[asset.type],
      sub: linked.length > 0 ? plural(linked.length, "vazamento") : "limpo",
      icon: ASSET_ICON[asset.type],
      tone,
      target: "assets",
      srLabel: `${ASSET_LABEL[asset.type]} ${asset.masked}: ${
        linked.length > 0 ? `${plural(linked.length, "vazamento")} encontrado${linked.length > 1 ? "s" : ""}` : "nenhum vazamento"
      }`,
      fixes: 0,
      pulse: false,
      dim: false,
    });
    link(`you-asset-${asset.id}`, center, point, tone === "success" ? "muted" : tone, tone === "danger");
  });

  const breachSlots = spread(
    breaches.map((breach) => {
      const angles = breach.assets
        .map((item) => assetPositions.get(`${item.type}|${item.masked}`)?.angle)
        .filter((angle): angle is number => angle !== undefined);
      const angle = angles.length > 0 ? angles.reduce((sum, value) => sum + value, 0) / angles.length : -90;
      return { breach, angle };
    }),
    24,
    -172,
    -8,
  );
  for (const { breach, angle } of breachSlots) {
    const point = onRing(geo, "outer", angle);
    const tone = breachTone(breach);
    nodes.push({
      id: `breach-${breach.id}`,
      ...point,
      ring: 2,
      label: shortLabel(breach.company),
      sub: breach.isNew ? "novo" : String(new Date(breach.occurredAt).getUTCFullYear()),
      icon: "breach",
      tone,
      target: panelKey.breach(breach.id),
      srLabel: `Vazamento ${breach.company}${breach.isNew ? ", novo" : ""}: ver detalhes e plano de resposta`,
      fixes: 0,
      pulse: breach.isNew,
      dim: false,
    });
    for (const item of breach.assets) {
      const asset = assetPositions.get(`${item.type}|${item.masked}`);
      if (asset) link(`breach-${breach.id}-${item.type}`, asset.point, point, tone, breach.isNew);
    }
  }

  /* Rede: casa e Wi-Fi público (dentro), aparelhos e este computador (fora), embaixo à esquerda. */
  const home = dashboard.network.home;
  const pub = dashboard.network.public;
  const homePoint = onRing(geo, "inner", 124);
  const publicPoint = onRing(geo, "inner", 166);

  const homeWorst = home ? worstSeverity(home.findings) : null;
  nodes.push({
    id: "net-home",
    ...homePoint,
    ring: 1,
    label: "Casa",
    sub: home ? plural(home.devices.length, "aparelho") : "sem auditoria",
    icon: "home",
    tone: home ? toneOfSeverity(homeWorst, "success") : "muted",
    target: panelKey.network("home"),
    srLabel: home ? `Rede de casa: ${severitySummary(home)}` : "Rede de casa: ainda sem auditoria",
    fixes: 0,
    pulse: false,
    dim: !home,
  });
  link("you-home", center, homePoint, home ? toneOfSeverity(homeWorst, "muted") : "muted", homeWorst === "high" || homeWorst === "critical");

  const pubWorst = pub ? worstSeverity(pub.findings) : null;
  nodes.push({
    id: "net-public",
    ...publicPoint,
    ring: 1,
    label: "Wi-Fi público",
    compactLabel: "Público",
    sub: pub ? severitySummary(pub).split(" · ")[0] : "sem auditoria",
    icon: "wifi",
    tone: pub ? toneOfSeverity(pubWorst, "success") : "muted",
    target: panelKey.network("public"),
    srLabel: pub ? `Wi-Fi público: ${severitySummary(pub)}` : "Wi-Fi público: ainda sem auditoria",
    fixes: 0,
    pulse: false,
    dim: !pub,
  });
  link("you-public", center, publicPoint, pub ? toneOfSeverity(pubWorst, "muted") : "muted");

  const networkSlots: Array<{ angle: number; build: (angle: number) => void }> = [];
  if (home) {
    const devices = [...home.devices]
      .sort((a, b) => {
        if (a.ip === home.network.gateway) return -1;
        if (b.ip === home.network.gateway) return 1;
        const rank = (ip: string) => {
          const worst = worstSeverity(findingsOfDevice(home, ip));
          return worst ? SEVERITY_ORDER.indexOf(worst) : SEVERITY_ORDER.length;
        };
        return rank(a.ip) - rank(b.ip);
      })
      .slice(0, MAX_DEVICES);
    const angles = evenly(devices.length, 126, 16, 56);
    devices.forEach((device, index) => {
      networkSlots.push({
        angle: angles[index],
        build: (angle) => {
          const point = onRing(geo, "outer", angle);
          const findings = findingsOfDevice(home, device.ip);
          const worst = worstSeverity(findings);
          const isGateway = device.ip === home.network.gateway;
          const fixes = isGateway ? home.fixes.filter((fix) => fix.target === "router").length : 0;
          const tone = toneOfSeverity(worst === "info" ? null : worst, fixes > 0 ? "success" : "muted");
          const name = device.model ?? device.hostname ?? "Aparelho sem nome";
          const shortName = device.model ?? device.hostname ?? "Sem nome";
          nodes.push({
            id: `device-${device.ip}`,
            ...point,
            ring: 2,
            label: shortLabel(shortName),
            sub: worst && worst !== "info" ? SEVERITY_STYLE[worst].label.toLowerCase() : fixes > 0 ? "corrigido" : "ok",
            icon: isGateway ? "router" : "device",
            tone,
            target: panelKey.device(device.ip),
            srLabel: `${name} (${device.ip}): ${
              findings.length > 0 ? plural(findings.length, "achado") : "nenhum achado"
            }${fixes > 0 ? `, ${plural(fixes, "correção", "correções")} do agente` : ""}`,
            fixes,
            pulse: false,
            dim: tone === "muted",
          });
          link(`home-${device.ip}`, homePoint, point, tone, worst === "high" || worst === "critical");
        },
      });
    });
  }
  if (pub) {
    networkSlots.push({
      angle: 182,
      build: (angle) => {
        const point = onRing(geo, "outer", angle);
        const tone = toneOfSeverity(pubWorst === "info" ? null : pubWorst, pub.fixes.length > 0 ? "success" : "muted");
        nodes.push({
          id: "device-this-computer",
          ...point,
          ring: 2,
          label: "Este computador",
          sub: pubWorst && pubWorst !== "info" ? SEVERITY_STYLE[pubWorst].label.toLowerCase() : "ok",
          icon: "laptop",
          tone,
          target: panelKey.network("public"),
          srLabel: `Este computador no Wi-Fi público: ${severitySummary(pub)}${
            pub.fixes.length > 0 ? `, ${plural(pub.fixes.length, "correção", "correções")} do agente` : ""
          }`,
          fixes: pub.fixes.filter((fix) => fix.target === "computer").length,
          pulse: false,
          dim: false,
        });
        link("public-computer", publicPoint, point, tone);
      },
    });
  }
  for (const slot of spread(networkSlots, 16, 98, 196)) slot.build(slot.angle);

  /* Contas: o hub (dentro) e os serviços (fora), embaixo à direita. */
  const accountList = accounts?.accounts ?? [];
  const breached = accountList.filter((account) => account.breaches.length > 0);
  const hubPoint = onRing(geo, "inner", 40);
  const hubTone: Tone = accountList.length === 0 ? "muted" : breached.length > 0 ? "warning" : "success";
  nodes.push({
    id: "accounts",
    ...hubPoint,
    ring: 1,
    label: "Contas",
    sub: accountList.length > 0 ? plural(accountList.length, "serviço") : "nenhuma",
    icon: "accounts",
    tone: hubTone,
    target: "accounts",
    srLabel: `Minhas contas: ${plural(accountList.length, "serviço")}, ${breached.length} com vazamento público`,
    fixes: 0,
    pulse: false,
    dim: accountList.length === 0,
  });
  link("you-accounts", center, hubPoint, hubTone === "success" ? "muted" : hubTone);

  const services = [...accountList]
    .sort((a, b) => b.breaches.length - a.breaches.length)
    .slice(0, MAX_SERVICES);
  const serviceAngles = evenly(services.length, 40, 18, 64);
  const serviceSlots = spread(
    services.map((account, index) => ({ account, angle: serviceAngles[index] })),
    18,
    0,
    86,
  );
  for (const { account, angle } of serviceSlots) {
    const point = onRing(geo, "outer", angle);
    const count = account.breaches.length;
    const tone: Tone = count > 0 ? "warning" : "muted";
    nodes.push({
      id: `service-${account.id}`,
      ...point,
      ring: 2,
      label: shortLabel(account.name),
      sub: count > 0 ? plural(count, "vazamento") : account.hasTwoFactor ? "2 etapas" : "sem vazamento",
      icon: "service",
      tone,
      target: panelKey.service(account.id),
      srLabel: `${account.name}: ${count > 0 ? `${plural(count, "vazamento público", "vazamentos públicos")}` : "nenhum vazamento público"}`,
      fixes: 0,
      pulse: false,
      dim: count === 0,
    });
    link(`accounts-${account.id}`, hubPoint, point, tone);
  }

  const deviceCount = home?.devices.length ?? 0;
  const alerts = dashboard.summary.importantNetworkAlerts;
  const readouts: MapReadout[] = [
    {
      sector: "identity",
      label: "Identidade",
      value: `${plural(dashboard.assets.length, "dado")} · ${plural(dashboard.breaches.length, "vazamento")}`,
    },
    {
      sector: "network",
      label: "Rede",
      value: `${plural(deviceCount + (pub ? 1 : 0), "aparelho")} · ${plural(alerts, "alerta")}`,
    },
    {
      sector: "accounts",
      label: "Contas",
      value: `${plural(accountList.length, "serviço")} · ${breached.length} com vazamento`,
    },
  ];

  return { nodes, edges, readouts };
}
