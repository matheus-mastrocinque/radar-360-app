/** URL da API para chamadas feitas no servidor do Next (Server Components e Route Handlers). */
export const API_URL = process.env.API_URL ?? "http://localhost:3333";

export type ApiHealth = { online: true; database: "ok" | "error" } | { online: false };

export async function getApiHealth(): Promise<ApiHealth> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      // Em produção a API e o banco dormem quando ninguém usa; acordar leva um ou dois segundos.
      signal: AbortSignal.timeout(5000),
    });
    const body = (await response.json()) as { database?: "ok" | "error" };
    return { online: true, database: body.database ?? "error" };
  } catch {
    return { online: false };
  }
}
