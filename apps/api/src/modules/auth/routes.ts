import type { FastifyInstance } from "fastify";
import type { Db } from "../../shared/db.js";
import { HttpError, requireSession } from "../../shared/auth.js";
import { generateSessionToken, hashToken } from "../../shared/crypto.js";
import { createDemoAccounts } from "../accounts/service.js";
import { createDemoIncidents } from "../incidents/demo.js";

/** Sessão da demo dura 2 horas: suficiente para o júri navegar, curta o bastante para não acumular. */
export const DEMO_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export async function authRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  /**
   * "Entrar como demo": abre uma sessão curta na persona fictícia, sem cadastro.
   * Regra do regulamento (7.4): o júri não instala nada e precisa conseguir testar.
   */
  app.post(
    "/auth/demo",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (_request, reply) => {
      const demo = await db.user.findFirst({
        where: { isDemo: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!demo) throw new HttpError(503, "A demo ainda não foi preparada (rode npm run db:seed)");

      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

      const now = new Date();
      const token = generateSessionToken();
      const expiresAt = new Date(now.getTime() + DEMO_SESSION_TTL_MS);
      const session = await db.session.create({
        data: { userId: demo.id, tokenHash: hashToken(token), expiresAt },
        select: { id: true },
      });
      await createDemoIncidents(db, { userId: demo.id, sessionId: session.id }, now);
      await createDemoAccounts(db, { userId: demo.id, sessionId: session.id });

      return reply.code(201).send({ token, expiresAt: expiresAt.toISOString() });
    },
  );

  app.post(
    "/auth/logout",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const session = await requireSession(db, request);
      await db.session.deleteMany({ where: { id: session.id } });
      return reply.code(204).send();
    },
  );
}
