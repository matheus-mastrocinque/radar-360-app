import { z } from "zod";
import type { Db } from "../../shared/db.js";
import { dataClassInfo } from "./data-classes.js";
import { computeExposureScore, type ScanScope, type Severity } from "./score.js";

/** Exposição detectada há menos de 7 dias aparece como "nova". */
export const NEW_EXPOSURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/** O JSON do scan já foi validado na entrada; aqui só lemos com tolerância a campos ausentes. */
const storedNetworkSchema = z.object({
  localIp: z.string().nullish(),
  gateway: z.string().nullish(),
  wifiSecurity: z.string().nullish(),
});

const storedDevicesSchema = z.array(
  z.object({
    ip: z.string(),
    vendor: z.string().nullish(),
    hostname: z.string().nullish(),
    model: z.string().nullish(),
    openPorts: z.array(z.number()).default([]),
  }),
);

function toSeverity(value: string): Severity {
  return value.toLowerCase() as Severity;
}

async function latestScan(db: Db, userId: string, mode: "HOME" | "PUBLIC") {
  return db.networkScan.findFirst({
    where: { userId, mode },
    orderBy: { finishedAt: "desc" },
    include: { findings: true },
  });
}

type ScanWithFindings = NonNullable<Awaited<ReturnType<typeof latestScan>>>;

function summarizeScan(scan: ScanWithFindings, scope: ScanScope) {
  const network = storedNetworkSchema.safeParse(scan.network);
  const devices = storedDevicesSchema.safeParse(scan.devices);

  const findings = scan.findings
    .map((finding) => ({
      id: finding.id,
      severity: toSeverity(finding.severity),
      kind: finding.kind,
      title: finding.title,
      detail: finding.detail,
      recommendation: finding.recommendation,
      deviceIp: finding.deviceIp,
      port: finding.port,
    }))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.title.localeCompare(b.title, "pt-BR"));

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) bySeverity[finding.severity] += 1;

  return {
    id: scan.id,
    scope,
    finishedAt: scan.finishedAt.toISOString(),
    agentVersion: scan.agentVersion,
    hostOs: scan.hostOs,
    network: {
      localIp: network.success ? (network.data.localIp ?? null) : null,
      gateway: network.success ? (network.data.gateway ?? null) : null,
      wifiSecurity: network.success ? (network.data.wifiSecurity ?? null) : null,
    },
    devices: devices.success
      ? devices.data.map((device) => ({
          ip: device.ip,
          vendor: device.vendor ?? null,
          hostname: device.hostname ?? null,
          model: device.model ?? null,
          openPorts: device.openPorts,
        }))
      : [],
    bySeverity,
    findings,
  };
}

export type ScanSummary = ReturnType<typeof summarizeScan>;

/** Tudo o que o painel mostra. Nunca inclui o dado vazado: só fonte, datas e categorias. */
export async function getDashboard(db: Db, userId: string, now: Date = new Date()) {
  const [user, assets, exposures, homeScan, publicScan] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, isDemo: true } }),
    db.asset.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
      select: { id: true, type: true, masked: true, verifiedAt: true },
    }),
    db.exposure.findMany({
      where: { asset: { userId } },
      orderBy: { detectedAt: "desc" },
      include: { breach: true, asset: { select: { type: true, masked: true } } },
    }),
    latestScan(db, userId, "HOME"),
    latestScan(db, userId, "PUBLIC"),
  ]);

  type BreachEntry = {
    breach: (typeof exposures)[number]["breach"];
    detectedAt: Date;
    assets: Array<{ type: string; masked: string }>;
  };
  const byBreach = new Map<string, BreachEntry>();
  for (const exposure of exposures) {
    const entry = byBreach.get(exposure.breachId) ?? {
      breach: exposure.breach,
      detectedAt: exposure.detectedAt,
      assets: [],
    };
    if (exposure.detectedAt < entry.detectedAt) entry.detectedAt = exposure.detectedAt;
    entry.assets.push({ type: exposure.asset.type, masked: exposure.asset.masked });
    byBreach.set(exposure.breachId, entry);
  }

  const breaches = [...byBreach.values()]
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
    .map(({ breach, detectedAt, assets: exposedAssets }) => ({
      id: breach.id,
      company: breach.company,
      description: breach.description,
      occurredAt: breach.occurredAt.toISOString(),
      disclosedAt: breach.disclosedAt?.toISOString() ?? null,
      detectedAt: detectedAt.toISOString(),
      isNew: now.getTime() - detectedAt.getTime() < NEW_EXPOSURE_WINDOW_MS,
      isSynthetic: breach.isSynthetic,
      dataClasses: breach.dataClasses.map(dataClassInfo),
      assets: exposedAssets,
    }));

  const home = homeScan ? summarizeScan(homeScan, "home") : null;
  const publicNetwork = publicScan ? summarizeScan(publicScan, "public") : null;
  const scans = [home, publicNetwork].filter((scan): scan is ScanSummary => scan !== null);

  const score = computeExposureScore({
    breaches: breaches.map((breach) => ({ dataClasses: breach.dataClasses.map((item) => item.key) })),
    scans: scans.map((scan) => ({ scope: scan.scope, findings: scan.findings })),
  });

  const importantNetworkAlerts = scans.reduce(
    (sum, scan) => sum + scan.bySeverity.critical + scan.bySeverity.high + scan.bySeverity.medium,
    0,
  );

  return {
    generatedAt: now.toISOString(),
    user,
    summary: {
      breaches: breaches.length,
      newBreaches: breaches.filter((breach) => breach.isNew).length,
      assets: assets.length,
      verifiedAssets: assets.filter((asset) => asset.verifiedAt !== null).length,
      importantNetworkAlerts,
    },
    score,
    assets: assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      masked: asset.masked,
      verifiedAt: asset.verifiedAt?.toISOString() ?? null,
    })),
    breaches,
    network: { home, public: publicNetwork },
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
