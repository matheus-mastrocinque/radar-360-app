import type { FastifyRequest } from "fastify";
import { HttpError, requireSession } from "./auth.js";
import type { Db } from "./db.js";

/** Quem está olhando. Na demo, cada sessão só vê o que ela mesma criou (incidentes, contas). */
export interface Viewer {
  userId: string;
  sessionId: string;
  isDemo: boolean;
  name: string | null;
}

export async function loadViewer(db: Db, request: FastifyRequest): Promise<Viewer> {
  const session = await requireSession(db, request);
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { isDemo: true, name: true } });
  if (!user) throw new HttpError(401, "Sessão inválida ou expirada");
  return { userId: session.userId, sessionId: session.id, isDemo: user.isDemo, name: user.name };
}

/** Filtro do Prisma: usuário real vê tudo o que é dele; sessão demo vê só o que é da sessão. */
export function viewerScope(viewer: Viewer) {
  return viewer.isDemo ? { userId: viewer.userId, sessionId: viewer.sessionId } : { userId: viewer.userId };
}

/** Dono de um registro novo: na demo, ele fica preso à sessão e some junto com ela. */
export function viewerOwner(viewer: Viewer) {
  return { userId: viewer.userId, sessionId: viewer.isDemo ? viewer.sessionId : null };
}
