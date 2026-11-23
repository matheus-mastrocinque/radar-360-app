import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import { webOrigins, type Env } from "./config/env.js";
import { HttpError } from "./shared/auth.js";
import type { Db } from "./shared/db.js";
import { breachJobRoutes } from "./modules/breaches/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { networkRoutes } from "./modules/network/routes.js";

export interface AppDeps {
  db: Db;
  env: Pick<Env, "WEB_ORIGIN" | "JOBS_SECRET">;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp({ db, env, logger = true }: AppDeps) {
  const app = Fastify({ logger, trustProxy: true });

  await app.register(helmet);
  await app.register(cors, { origin: webOrigins(env) });
  await app.register(rateLimit, { global: false });

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
  await app.register(breachJobRoutes, { db, jobsSecret: env.JOBS_SECRET });

  return app;
}
