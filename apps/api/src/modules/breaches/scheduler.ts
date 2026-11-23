import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../shared/db.js";
import { runBreachCheck } from "./job.js";

/** Agenda o job dentro do próprio processo. Use só em servidor sempre ligado (RUN_CRON=true). */
export function startBreachCron(db: Db, expression: string, log: FastifyBaseLogger) {
  if (!cron.validate(expression)) {
    throw new Error(`BREACH_CHECK_CRON inválido: "${expression}"`);
  }

  let running = false;
  const task = cron.schedule(expression, async () => {
    if (running) {
      log.warn("breach check still running, skipping this tick");
      return;
    }
    running = true;
    try {
      const result = await runBreachCheck(db);
      log.info(
        { assetsChecked: result.assetsChecked, newExposures: result.newExposures.length },
        "scheduled breach check finished",
      );
    } catch (error) {
      log.error({ err: error }, "scheduled breach check failed");
    } finally {
      running = false;
    }
  });

  log.info({ expression }, "breach check cron started");
  return task;
}
