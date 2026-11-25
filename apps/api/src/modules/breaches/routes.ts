import type { FastifyInstance } from "fastify";
import type { Db } from "../../shared/db.js";
import { requireJobsSecret } from "../../shared/auth.js";
import { importHibpCatalog, type FetchLike } from "./hibp.js";
import { runBreachCheck } from "./job.js";

export interface BreachJobOptions {
  db: Db;
  jobsSecret: string;
  /** Troca o fetch do catálogo do HIBP (testes). */
  fetchCatalog?: FetchLike;
}

/** Rotas chamadas pelo agendador (em produção, o GitHub Actions), protegidas pelo X-Jobs-Secret. */
export async function breachJobRoutes(app: FastifyInstance, opts: BreachJobOptions) {
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

  /** Atualiza a base de vazamentos reais com o catálogo público do HIBP (só metadados). */
  app.post(
    "/internal/jobs/breach-catalog",
    { config: { rateLimit: { max: 2, timeWindow: "1 minute" } } },
    async (request) => {
      requireJobsSecret(request, opts.jobsSecret);
      const result = await importHibpCatalog(opts.db, opts.fetchCatalog);
      request.log.info(result, "breach catalog imported");
      return result;
    },
  );
}
