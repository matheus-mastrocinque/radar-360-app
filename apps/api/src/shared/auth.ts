import type { FastifyRequest } from "fastify";
import type { Db } from "./db.js";
import { hashToken, safeEqual } from "./crypto.js";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Autentica o agente local pelo header X-Pairing-Token e devolve o dono do token. */
export async function requirePairingToken(db: Db, request: FastifyRequest) {
  const token = headerValue(request, "x-pairing-token");
  if (!token) throw new HttpError(401, "Token de pareamento ausente");

  const pairing = await db.pairingToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!pairing || pairing.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "Token de pareamento inválido ou expirado");
  }
  return pairing;
}

/** Protege rotas internas chamadas pelo Cloud Scheduler (header X-Jobs-Secret). */
export function requireJobsSecret(request: FastifyRequest, expected: string): void {
  const provided = headerValue(request, "x-jobs-secret");
  if (!provided || !safeEqual(provided, expected)) {
    throw new HttpError(401, "Segredo de job inválido");
  }
}
