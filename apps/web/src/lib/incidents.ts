import { apiFetch } from "./api-fetch";
import type { DataClass } from "./dashboard";

/** Tipos espelhados da API (apps/api/src/modules/incidents). */
export type IncidentType =
  | "DATA_BREACH"
  | "PIX_SCAM"
  | "PHISHING"
  | "ACCOUNT_TAKEOVER"
  | "STOLEN_PHONE"
  | "IDENTITY_FRAUD";

export type ReportableType = Exclude<IncidentType, "DATA_BREACH">;

export type LgpdStatus = "not_sent" | "waiting" | "overdue" | "answered";

export interface IncidentListItem {
  id: string;
  type: IncidentType;
  typeLabel: string;
  title: string;
  source: "DETECTED" | "REPORTED";
  createdAt: string;
  progress: { done: number; total: number };
  lgpdStatus: LgpdStatus | null;
}

export interface PendingBreach {
  id: string;
  company: string;
  detectedAt: string;
  isNew: boolean;
}

export interface IncidentList {
  incidents: IncidentListItem[];
  breachesWithoutPlan: PendingBreach[];
}

export interface OfficialLink {
  label: string;
  url: string;
}

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  links: OfficialLink[];
  lgpd: boolean;
  done: boolean;
}

export interface PlanPhase {
  key: "now" | "hour" | "day";
  label: string;
  window: string;
  steps: PlanStep[];
}

export interface LegalArticle {
  ref: string;
  text: string;
}

export interface IncidentView {
  id: string;
  type: IncidentType;
  typeLabel: string;
  typeDescription: string;
  title: string;
  source: "DETECTED" | "REPORTED";
  classifiedBy: "SYSTEM" | "USER" | "AI" | "RULES";
  createdAt: string;
  summary: string | null;
  narrative: string | null;
  flags: Array<{ key: string; label: string }>;
  breach: {
    id: string;
    company: string;
    occurredAt: string;
    disclosedAt: string | null;
    isSynthetic: boolean;
    dataClasses: DataClass[];
  } | null;
  plan: { phases: PlanPhase[]; progress: { done: number; total: number } };
  lgpd: {
    timeline: {
      status: LgpdStatus;
      sentAt: string | null;
      answeredAt: string | null;
      deadline: string | null;
      daysLeft: number | null;
    };
    recipient: { contact: string | null; hint: string };
    notice: { subject: string; body: string; articles: LegalArticle[] };
    petition: { text: string; articles: LegalArticle[]; links: OfficialLink[]; checklist: string[] } | null;
  } | null;
  disclaimer: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: "unauthorized" | "not_found" | "unavailable" };

async function getJson<T>(token: string, path: string): Promise<ApiResult<T>> {
  try {
    const response = await apiFetch(path, { token });
    if (response.status === 401) return { ok: false, reason: "unauthorized" };
    if (response.status === 404) return { ok: false, reason: "not_found" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function fetchIncidents(token: string) {
  return getJson<IncidentList>(token, "/me/incidents");
}

export function fetchIncident(token: string, id: string) {
  return getJson<IncidentView>(token, `/me/incidents/${encodeURIComponent(id)}`);
}
