import type { Db } from "../../shared/db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vazamento da persona usado para mostrar o fluxo LGPD completo (prazo vencido → petição à ANPD). */
export const DEMO_OVERDUE_BREACH_SLUG = "teleconecta-2025";

/**
 * Incidentes de exemplo de cada sessão da demo. Criados na entrada, com datas relativas a "agora",
 * para o júri sempre ver o prazo da notificação LGPD vencido e a petição à ANPD pronta.
 * Somem junto com a sessão (onDelete: Cascade).
 */
export async function createDemoIncidents(db: Db, owner: { userId: string; sessionId: string }, now: Date) {
  const breach = await db.breach.findUnique({ where: { slug: DEMO_OVERDUE_BREACH_SLUG }, select: { id: true } });
  if (!breach) return;

  await db.incident.create({
    data: {
      userId: owner.userId,
      sessionId: owner.sessionId,
      type: "DATA_BREACH",
      source: "DETECTED",
      classifiedBy: "SYSTEM",
      breachId: breach.id,
      completedSteps: ["breach_phishing_alert", "breach_sim_pin", "breach_lgpd_notice", "breach_registrato"],
      lgpdSentAt: new Date(now.getTime() - 17 * DAY_MS),
      createdAt: new Date(now.getTime() - 18 * DAY_MS),
    },
  });
}
