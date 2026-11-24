/**
 * Ponto de entrada da API: local (`npm run dev`), `node dist/server.js` ou Vercel Functions.
 * A Vercel procura src/app, src/index e src/server, nessa ordem; por isso o app em si fica em
 * build-app.ts e este é o único arquivo que chama listen().
 */
import { buildApp } from "./build-app.js";
import { loadEnv } from "./config/env.js";
import { createDb } from "./shared/db.js";
import { startBreachCron } from "./modules/breaches/scheduler.js";
import { createGeminiClassifier, withHourlyBudget } from "./modules/incidents/classify.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const classifier = env.GEMINI_API_KEY
  ? withHourlyBudget(
      createGeminiClassifier({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }),
      env.LLM_MAX_CALLS_PER_HOUR,
    )
  : null;
const app = await buildApp({ db, env, classifier });
app.log.info(
  { classifier: classifier ? env.GEMINI_MODEL : "rules" },
  classifier ? "incident copilot uses Gemini" : "incident copilot uses keyword rules (no GEMINI_API_KEY)",
);

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
