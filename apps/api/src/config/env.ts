import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  /** Padrão: 127.0.0.1 em desenvolvimento (não expõe a API na rede local) e 0.0.0.0 em produção. */
  HOST: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  HMAC_SECRET: z.string().min(32, "HMAC_SECRET precisa de pelo menos 32 caracteres"),
  JOBS_SECRET: z.string().min(16, "JOBS_SECRET precisa de pelo menos 16 caracteres"),
  /** Origens liberadas no CORS, separadas por vírgula. */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  /** true = roda o job de vazamentos dentro deste processo (servidor sempre ligado). */
  RUN_CRON: booleanFromString,
  BREACH_CHECK_CRON: z.string().default("0 */6 * * *"),
  GEMINI_API_KEY: z.string().optional(),
  /** Modelo estável do Gemini para classificar relatos (conferido em 23/11/2026). */
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = Omit<z.infer<typeof envSchema>, "HOST"> & { HOST: string };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${problems}\nVeja apps/api/.env.example.`);
  }
  const data = parsed.data;
  return { ...data, HOST: data.HOST ?? (data.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1") };
}

export function webOrigins(env: Pick<Env, "WEB_ORIGIN">): string[] {
  return env.WEB_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
