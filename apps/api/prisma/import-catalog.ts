/**
 * Atualiza os vazamentos reais (só metadados) com o catálogo público do Have I Been Pwned.
 * Uso: npm run catalog:import -w @radar/api
 * Em produção, o GitHub Actions chama POST /internal/jobs/breach-catalog.
 */
import { loadEnv } from "../src/config/env.js";
import { importHibpCatalog } from "../src/modules/breaches/hibp.js";
import { createDb } from "../src/shared/db.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

try {
  const result = await importHibpCatalog(db);
  console.log(
    `Catálogo HIBP: ${result.received} recebidos, ${result.created} novos, ${result.updated} atualizados, ${result.skipped} ignorados.`,
  );
} finally {
  await db.$disconnect();
}
