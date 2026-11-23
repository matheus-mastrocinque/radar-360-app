import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDb } from "./shared/db.js";
import { startBreachCron } from "./modules/breaches/scheduler.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = await buildApp({ db, env });

if (env.RUN_CRON) {
  startBreachCron(db, env.BREACH_CHECK_CRON, app.log);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: env.PORT, host: env.HOST });
