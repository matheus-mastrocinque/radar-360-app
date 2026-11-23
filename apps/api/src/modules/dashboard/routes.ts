import type { FastifyInstance } from "fastify";
import type { Db } from "../../shared/db.js";
import { requireSession } from "../../shared/auth.js";
import { getDashboard } from "./service.js";

export async function dashboardRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get(
    "/me/dashboard",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const session = await requireSession(db, request);
      const dashboard = await getDashboard(db, session.userId);
      return reply.header("cache-control", "no-store").send(dashboard);
    },
  );
}
