import type { FastifyInstance } from "fastify";
import type { Db } from "../../shared/db.js";

export async function healthRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get("/health", async (_request, reply) => {
    let database: "ok" | "error" = "ok";
    try {
      await opts.db.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }
    return reply.code(database === "ok" ? 200 : 503).send({ status: database === "ok" ? "ok" : "degraded", database });
  });
}
