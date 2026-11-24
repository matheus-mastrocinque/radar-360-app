import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";
import { safeEqual } from "./crypto.js";

/**
 * Chave dos limites de uso por IP.
 *
 * Em produção o site (Next) chama a API do próprio servidor, então todas as chamadas chegam com o
 * IP dele. O site repassa o IP do visitante neste header, assinado com `PROXY_SECRET`; só com o
 * segredo certo a API usa esse IP. Sem ele, vale o IP da conexão, e um header forjado não muda nada.
 */
export const CLIENT_IP_HEADER = "x-radar-client-ip";
export const PROXY_SECRET_HEADER = "x-radar-proxy-secret";

export function rateLimitKey(proxySecret: string | undefined) {
  return (request: FastifyRequest): string => {
    if (proxySecret) {
      const given = request.headers[PROXY_SECRET_HEADER];
      const ip = request.headers[CLIENT_IP_HEADER];
      if (typeof given === "string" && typeof ip === "string" && isIP(ip) && safeEqual(given, proxySecret)) {
        return ip;
      }
    }
    return request.ip;
  };
}
