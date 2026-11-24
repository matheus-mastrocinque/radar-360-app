import { cache } from "react";
import { apiFetch } from "./api-fetch";

/** Espelho do JSON de GET /me/dashboard (apps/api/src/modules/dashboard/service.ts). */
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AssetType = "EMAIL" | "CPF" | "PHONE";
export type ScoreLevel = "baixo" | "moderado" | "alto" | "critico";

export interface DataClass {
  key: string;
  label: string;
  weight: number;
  why: string;
  action: string | null;
}

export interface ScoreFactor {
  group: "leaks" | "network";
  label: string;
  detail: string;
  points: number;
}

export interface Finding {
  id: string;
  severity: Severity;
  kind: string;
  title: string;
  detail: string;
  recommendation: string;
  deviceIp: string | null;
  port: number | null;
}

export interface ScanSummary {
  id: string;
  scope: "home" | "public";
  finishedAt: string;
  agentVersion: string;
  hostOs: string;
  network: { localIp: string | null; gateway: string | null; wifiSecurity: string | null };
  devices: Array<{
    ip: string;
    vendor: string | null;
    hostname: string | null;
    model: string | null;
    openPorts: number[];
  }>;
  bySeverity: Record<Severity, number>;
  findings: Finding[];
}

export interface BreachItem {
  id: string;
  company: string;
  description: string;
  occurredAt: string;
  disclosedAt: string | null;
  detectedAt: string;
  isNew: boolean;
  isSynthetic: boolean;
  dataClasses: DataClass[];
  assets: Array<{ type: AssetType; masked: string }>;
}

export interface Dashboard {
  generatedAt: string;
  user: { name: string | null; isDemo: boolean };
  summary: {
    breaches: number;
    newBreaches: number;
    assets: number;
    verifiedAssets: number;
    importantNetworkAlerts: number;
  };
  score: {
    value: number;
    max: 100;
    level: ScoreLevel;
    levelLabel: string;
    leaks: { points: number; raw: number; cap: number };
    network: { points: number; raw: number; cap: number };
    factors: ScoreFactor[];
  };
  assets: Array<{ id: string; type: AssetType; masked: string; verifiedAt: string | null }>;
  breaches: BreachItem[];
  network: { home: ScanSummary | null; public: ScanSummary | null };
}

export type DashboardResult =
  | { ok: true; data: Dashboard }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function fetchDashboard(token: string): Promise<DashboardResult> {
  try {
    const response = await apiFetch("/me/dashboard", { token });
    if (response.status === 401) return { ok: false, reason: "unauthorized" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, data: (await response.json()) as Dashboard };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Mesma chamada, memorizada por requisição: o layout do painel (nome e aviso de demo)
 * e a página do painel compartilham uma única ida à API.
 */
export const fetchDashboardOnce = cache(fetchDashboard);
