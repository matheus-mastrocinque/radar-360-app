import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import { webOrigins, type Env } from "./config/env.js";
import { HttpError } from "./shared/auth.js";
import { rateLimitKey } from "./shared/client-ip.js";
import type { Db } from "./shared/db.js";
import { authRoutes } from "./modules/auth/routes.js";
import { breachJobRoutes } from "./modules/breaches/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import type { ReportClassifier } from "./modules/incidents/classify.js";
import { incidentRoutes } from "./modules/incidents/routes.js";
import { networkRoutes } from "./modules/network/routes.js";

export interface AppDeps {
  db: Db;
  env: Pick<Env, "WEB_ORIGIN" | "JOBS_SECRET"> & Partial<Pick<Env, "PROXY_SECRET">>;
  logger?: FastifyServerOptions["logger"];
  /** Classificador de relatos com LLM; sem ele, o copiloto usa só as regras por palavras-chave. */
  classifier?: ReportClassifier | null;
}

export async function buildApp({ db, env, logger = true, classifier = null }: AppDeps) {
  const app = Fastify({ logger, trustProxy: true });

  await app.register(helmet);
  await app.register(cors, { origin: webOrigins(env) });
  await app.register(rateLimit, { global: false, keyGenerator: rateLimitKey(env.PROXY_SECRET) });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Dados inválidos", issues: error.issues });
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({ error: (error as Error).message });
    }
    request.log.error({ err: error }, "unhandled error");
    return reply.code(500).send({ error: "Erro interno" });
  });

  await app.register(healthRoutes, { db });
  await app.register(networkRoutes, { db });
  await app.register(authRoutes, { db });
  await app.register(dashboardRoutes, { db });
  await app.register(incidentRoutes, { db, classifier });
  await app.register(breachJobRoutes, { db, jobsSecret: env.JOBS_SECRET });

  return app;
}
