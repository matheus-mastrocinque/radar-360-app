import type { FastifyInstance } from "fastify";
import type { Db } from "../../shared/db.js";
import { requireJobsSecret } from "../../shared/auth.js";
import { runBreachCheck } from "./job.js";

/** Rota chamada pelo agendador (em produção, o GitHub Actions) quando a API não tem processo sempre ligado. */
export async function breachJobRoutes(app: FastifyInstance, opts: { db: Db; jobsSecret: string }) {
  app.post(
    "/internal/jobs/breach-check",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request) => {
      requireJobsSecret(request, opts.jobsSecret);
      const result = await runBreachCheck(opts.db);
      request.log.info(
        { assetsChecked: result.assetsChecked, newExposures: result.newExposures.length },
        "breach check finished",
      );
      return {
        assetsChecked: result.assetsChecked,
        matches: result.matches,
        newExposures: result.newExposures.length,
      };
    },
  );
}
