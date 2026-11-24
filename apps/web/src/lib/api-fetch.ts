import { headers } from "next/headers";
import { API_URL } from "./api";

/**
 * Chamadas do servidor do Next para a API.
 *
 * Em produção todas as chamadas saem do servidor do site, então a API veria sempre o mesmo IP e
 * os limites por IP (entrar como demo, enviar relato) valeriam para todos os visitantes juntos.
 * Por isso o site repassa o IP de quem abriu a página, junto com um segredo que só ele e a API
 * conhecem (`PROXY_SECRET`). Sem o segredo configurado, nada é repassado e a API usa o IP da conexão.
 */
const CLIENT_IP_HEADER = "x-radar-client-ip";
const PROXY_SECRET_HEADER = "x-radar-proxy-secret";

async function visitorIp(): Promise<string | null> {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || incoming.get("x-real-ip")?.trim() || null;
}

export interface ApiFetchInit extends Omit<RequestInit, "signal" | "cache"> {
  /** Token da sessão, enviado como Bearer. */
  token?: string;
  timeoutMs?: number;
}

export async function apiFetch(path: string, { token, timeoutMs = 5000, headers: extra, ...init }: ApiFetchInit = {}) {
  const outgoing = new Headers(extra);
  if (token) outgoing.set("authorization", `Bearer ${token}`);

  const secret = process.env.PROXY_SECRET;
  if (secret) {
    const ip = await visitorIp();
    if (ip) {
      outgoing.set(CLIENT_IP_HEADER, ip);
      outgoing.set(PROXY_SECRET_HEADER, secret);
    }
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: outgoing,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}
