import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../shared/db.js";
import { loadViewer } from "../../shared/viewer.js";
import { addAccount, listAccounts, removeAccount, searchServices, updateAccount } from "./service.js";

const idParams = z.object({ id: z.string().min(1).max(64) });
const searchQuery = z.object({ q: z.string().max(80).default("") });
const addBody = z.object({
  domain: z.string().trim().min(3).max(253),
  name: z.string().trim().max(60).optional(),
  isFinancial: z.boolean().optional(),
  hasTwoFactor: z.boolean().optional(),
});
const patchBody = z
  .object({ hasTwoFactor: z.boolean().optional(), isFinancial: z.boolean().optional() })
  .refine((body) => body.hasTwoFactor !== undefined || body.isFinancial !== undefined, {
    message: "Nada para atualizar",
  });

export async function accountRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;
  const read = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };
  const write = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

  /** Sugestões para "Minhas contas" (lista curada + catálogo de vazamentos). */
  app.get("/services", read, async (request, reply) => {
    await loadViewer(db, request);
    const { q } = searchQuery.parse(request.query);
    return reply.header("cache-control", "no-store").send({ services: await searchServices(db, q) });
  });

  app.get("/me/accounts", read, async (request, reply) => {
    const viewer = await loadViewer(db, request);
    return reply.header("cache-control", "no-store").send(await listAccounts(db, viewer));
  });

  app.post("/me/accounts", write, async (request, reply) => {
    const viewer = await loadViewer(db, request);
    const body = addBody.parse(request.body);
    const result = await addAccount(db, viewer, body);
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.patch("/me/accounts/:id", write, async (request, reply) => {
    const viewer = await loadViewer(db, request);
    const { id } = idParams.parse(request.params);
    await updateAccount(db, viewer, id, patchBody.parse(request.body));
    return reply.code(204).send();
  });

  app.delete("/me/accounts/:id", write, async (request, reply) => {
    const viewer = await loadViewer(db, request);
    const { id } = idParams.parse(request.params);
    await removeAccount(db, viewer, id);
    return reply.code(204).send();
  });
}
