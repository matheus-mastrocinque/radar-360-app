import type { ClassifiedBy, IncidentType } from "../../generated/prisma/enums.js";
import { HttpError } from "../../shared/auth.js";
import type { Db } from "../../shared/db.js";
import { dataClassInfo, type DataClassInfo } from "../dashboard/data-classes.js";
import { NEW_EXPOSURE_WINDOW_MS } from "../dashboard/service.js";
import {
  FLAG_LABELS,
  INCIDENT_TYPES,
  LEGAL_DISCLAIMER,
  isIncidentFlag,
  type IncidentFlag,
  type ReportableType,
} from "./catalog.js";
import {
  buildAnpdPetition,
  buildLgpdNotice,
  lgpdTimeline,
  type AnpdPetition,
  type LgpdNotice,
  type LgpdTimeline,
} from "./lgpd.js";
import { applicableSteps, buildPlan, type Plan } from "./plan.js";

/** Quem está olhando. Na demo, cada sessão só vê os próprios incidentes. */
export interface Viewer {
  userId: string;
  sessionId: string;
  isDemo: boolean;
  name: string | null;
}

/** Limite de relatos por hora (cada um pode chamar o LLM). */
export const MAX_REPORTS_PER_HOUR = 20;

const HOUR_MS = 60 * 60 * 1000;

function scope(viewer: Viewer) {
  return viewer.isDemo ? { userId: viewer.userId, sessionId: viewer.sessionId } : { userId: viewer.userId };
}

function holderName(viewer: Viewer): string {
  return viewer.name?.trim() || "[seu nome completo]";
}

function flagsOf(values: string[]): IncidentFlag[] {
  return values.filter(isIncidentFlag);
}

function titleOf(type: IncidentType, company: string | null | undefined): string {
  return type === "DATA_BREACH" && company ? `Vazamento na ${company}` : INCIDENT_TYPES[type].label;
}

/* ------------------------------------------------------------------ leitura */

export interface IncidentListItem {
  id: string;
  type: IncidentType;
  typeLabel: string;
  title: string;
  source: "DETECTED" | "REPORTED";
  createdAt: string;
  progress: { done: number; total: number };
  lgpdStatus: LgpdTimeline["status"] | null;
}

export async function listIncidents(db: Db, viewer: Viewer, now: Date) {
  const incidents = await db.incident.findMany({
    where: scope(viewer),
    orderBy: { createdAt: "desc" },
    include: { breach: { select: { company: true, dataClasses: true } } },
  });

  const items: IncidentListItem[] = incidents.map((incident) => {
    const plan = buildPlan({
      type: incident.type,
      flags: flagsOf(incident.flags),
      dataClasses: incident.breach?.dataClasses ?? [],
      completedSteps: incident.completedSteps,
    });
    return {
      id: incident.id,
      type: incident.type,
      typeLabel: INCIDENT_TYPES[incident.type].label,
      title: titleOf(incident.type, incident.breach?.company),
      source: incident.source,
      createdAt: incident.createdAt.toISOString(),
      progress: plan.progress,
      lgpdStatus:
        incident.type === "DATA_BREACH"
          ? lgpdTimeline(incident.lgpdSentAt, incident.lgpdAnsweredAt, now).status
          : null,
    };
  });

  // Vazamentos detectados que ainda não têm plano de resposta.
  const withPlan = new Set(incidents.map((incident) => incident.breachId).filter(Boolean));
  const exposures = await db.exposure.findMany({
    where: { asset: { userId: viewer.userId, verifiedAt: { not: null } } },
    include: { breach: { select: { id: true, company: true } } },
    orderBy: { detectedAt: "desc" },
  });
  const pending = new Map<string, { id: string; company: string; detectedAt: string; isNew: boolean }>();
  for (const exposure of exposures) {
    if (withPlan.has(exposure.breachId) || pending.has(exposure.breachId)) continue;
    pending.set(exposure.breachId, {
      id: exposure.breach.id,
      company: exposure.breach.company,
      detectedAt: exposure.detectedAt.toISOString(),
      isNew: now.getTime() - exposure.detectedAt.getTime() < NEW_EXPOSURE_WINDOW_MS,
    });
  }

  return { incidents: items, breachesWithoutPlan: [...pending.values()] };
}

export interface IncidentView {
  id: string;
  type: IncidentType;
  typeLabel: string;
  typeDescription: string;
  title: string;
  source: "DETECTED" | "REPORTED";
  classifiedBy: ClassifiedBy;
  createdAt: string;
  summary: string | null;
  narrative: string | null;
  flags: Array<{ key: IncidentFlag; label: string }>;
  breach: {
    id: string;
    company: string;
    occurredAt: string;
    disclosedAt: string | null;
    isSynthetic: boolean;
    dataClasses: DataClassInfo[];
  } | null;
  plan: Plan;
  lgpd: {
    timeline: LgpdTimeline;
    recipient: { contact: string | null; hint: string };
    notice: LgpdNotice;
    petition: AnpdPetition | null;
  } | null;
  disclaimer: string;
}

async function findInScope(db: Db, viewer: Viewer, id: string) {
  const incident = await db.incident.findFirst({ where: { id, ...scope(viewer) }, include: { breach: true } });
  if (!incident) throw new HttpError(404, "Incidente não encontrado");
  return incident;
}

export async function getIncidentView(db: Db, viewer: Viewer, id: string, now: Date): Promise<IncidentView> {
  const incident = await findInScope(db, viewer, id);
  const flags = flagsOf(incident.flags);
  const breach = incident.breach;
  const dataClasses = breach ? breach.dataClasses.map(dataClassInfo) : [];

  let lgpd: IncidentView["lgpd"] = null;
  if (incident.type === "DATA_BREACH" && breach) {
    const timeline = lgpdTimeline(incident.lgpdSentAt, incident.lgpdAnsweredAt, now);
    const name = holderName(viewer);
    lgpd = {
      timeline,
      recipient: {
        contact: breach.dpoContact,
        hint: breach.isSynthetic
          ? "Empresa fictícia: na demo, o envio é simulado. Use \"Marquei como enviada\" para ver o prazo correr."
          : breach.dpoContact
            ? "Contato do encarregado divulgado pela empresa."
            : "Procure o contato do encarregado na política de privacidade da empresa: a LGPD obriga a divulgação (art. 41, § 1º).",
      },
      notice: buildLgpdNotice({
        holderName: name,
        company: breach.company,
        occurredAt: breach.occurredAt,
        dataClassLabels: dataClasses.map((item) => item.label),
        now: incident.lgpdSentAt ?? now,
      }),
      petition:
        timeline.status === "overdue" && incident.lgpdSentAt && timeline.deadline
          ? buildAnpdPetition({
              holderName: name,
              company: breach.company,
              sentAt: incident.lgpdSentAt,
              deadline: new Date(timeline.deadline),
            })
          : null,
    };
  }

  return {
    id: incident.id,
    type: incident.type,
    typeLabel: INCIDENT_TYPES[incident.type].label,
    typeDescription: INCIDENT_TYPES[incident.type].description,
    title: titleOf(incident.type, breach?.company),
    source: incident.source,
    classifiedBy: incident.classifiedBy,
    createdAt: incident.createdAt.toISOString(),
    summary: incident.summary,
    narrative: incident.narrative,
    flags: flags.map((key) => ({ key, label: FLAG_LABELS[key] })),
    breach: breach
      ? {
          id: breach.id,
          company: breach.company,
          occurredAt: breach.occurredAt.toISOString(),
          disclosedAt: breach.disclosedAt?.toISOString() ?? null,
          isSynthetic: breach.isSynthetic,
          dataClasses,
        }
      : null,
    plan: buildPlan({
      type: incident.type,
      flags,
      dataClasses: breach?.dataClasses ?? [],
      completedSteps: incident.completedSteps,
    }),
    lgpd,
    disclaimer: LEGAL_DISCLAIMER,
  };
}

/* ------------------------------------------------------------------ escrita */

/** Abre (ou reabre) o plano de resposta de um vazamento detectado. Idempotente. */
export async function openBreachIncident(db: Db, viewer: Viewer, breachId: string) {
  const exposure = await db.exposure.findFirst({
    where: { breachId, asset: { userId: viewer.userId, verifiedAt: { not: null } } },
    select: { id: true },
  });
  if (!exposure) throw new HttpError(404, "Vazamento não encontrado entre os seus dados");

  const existing = await db.incident.findFirst({ where: { breachId, ...scope(viewer) }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };

  const incident = await db.incident.create({
    data: {
      userId: viewer.userId,
      sessionId: viewer.isDemo ? viewer.sessionId : null,
      type: "DATA_BREACH",
      source: "DETECTED",
      classifiedBy: "SYSTEM",
      breachId,
    },
    select: { id: true },
  });
  return { id: incident.id, created: true };
}

export interface NewReport {
  type: ReportableType;
  flags: IncidentFlag[];
  summary: string | null;
  narrative: string | null;
  classifiedBy: "USER" | "AI" | "RULES";
}

export async function assertReportQuota(db: Db, viewer: Viewer, now: Date) {
  const recent = await db.incident.count({
    where: { ...scope(viewer), source: "REPORTED", createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
  });
  if (recent >= MAX_REPORTS_PER_HOUR) {
    throw new HttpError(429, "Muitos relatos em pouco tempo. Tente de novo mais tarde.");
  }
}

export async function createReportedIncident(db: Db, viewer: Viewer, report: NewReport) {
  const incident = await db.incident.create({
    data: {
      userId: viewer.userId,
      sessionId: viewer.isDemo ? viewer.sessionId : null,
      type: report.type,
      source: "REPORTED",
      classifiedBy: report.classifiedBy,
      flags: report.flags,
      summary: report.summary,
      narrative: report.narrative,
    },
    select: { id: true },
  });
  return { id: incident.id };
}

export async function setStepDone(db: Db, viewer: Viewer, id: string, stepId: string, done: boolean) {
  const incident = await findInScope(db, viewer, id);
  const steps = applicableSteps({
    type: incident.type,
    flags: flagsOf(incident.flags),
    dataClasses: incident.breach?.dataClasses ?? [],
  });
  if (!steps.some((step) => step.id === stepId)) throw new HttpError(400, "Passo inválido para este incidente");

  const completed = new Set(incident.completedSteps);
  if (done) completed.add(stepId);
  else completed.delete(stepId);
  await db.incident.update({ where: { id: incident.id }, data: { completedSteps: [...completed] } });
}

export type LgpdEvent = "sent" | "answered" | "reset";

export async function recordLgpdEvent(db: Db, viewer: Viewer, id: string, event: LgpdEvent, now: Date) {
  const incident = await findInScope(db, viewer, id);
  if (incident.type !== "DATA_BREACH") throw new HttpError(400, "Este incidente não tem notificação LGPD");

  const completed = new Set(incident.completedSteps);
  if (event === "sent") {
    if (incident.lgpdSentAt) return;
    completed.add("breach_lgpd_notice");
    await db.incident.update({
      where: { id: incident.id },
      data: { lgpdSentAt: now, lgpdAnsweredAt: null, completedSteps: [...completed] },
    });
  } else if (event === "answered") {
    if (!incident.lgpdSentAt) throw new HttpError(400, "Marque primeiro o envio da notificação");
    completed.add("breach_follow_answer");
    await db.incident.update({
      where: { id: incident.id },
      data: { lgpdAnsweredAt: incident.lgpdAnsweredAt ?? now, completedSteps: [...completed] },
    });
  } else {
    completed.delete("breach_lgpd_notice");
    completed.delete("breach_follow_answer");
    await db.incident.update({
      where: { id: incident.id },
      data: { lgpdSentAt: null, lgpdAnsweredAt: null, completedSteps: [...completed] },
    });
  }
}
