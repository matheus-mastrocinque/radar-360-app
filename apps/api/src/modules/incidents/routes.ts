import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError, requireSession } from "../../shared/auth.js";
import type { Db } from "../../shared/db.js";
import { REPORTABLE_TYPES } from "./catalog.js";
import { classifyByRules, classifyReport, type ReportClassifier } from "./classify.js";
import { redactPersonalData } from "./redact.js";
import {
  assertReportQuota,
  createReportedIncident,
  getIncidentView,
  listIncidents,
  openBreachIncident,
  recordLgpdEvent,
  setStepDone,
  type Viewer,
} from "./service.js";

const idParams = z.object({ id: z.string().min(1).max(64) });

const reportBody = z.object({
  text: z
    .string()
    .trim()
    .min(15, "Conte um pouco mais sobre o que aconteceu (mínimo de 15 caracteres).")
    .max(2000, "O relato pode ter até 2.000 caracteres."),
  /** Tipo escolhido pelo próprio usuário. Se vier, o LLM não é chamado. */
  type: z.enum(REPORTABLE_TYPES).optional(),
});

const fromBreachBody = z.object({ breachId: z.string().min(1).max(64) });
const stepBody = z.object({ stepId: z.string().min(1).max(64), done: z.boolean() });
const lgpdBody = z.object({ event: z.enum(["sent", "answered", "reset"]) });

export interface IncidentRouteOptions {
  db: Db;
  /** Classificador com LLM; null quando não há GEMINI_API_KEY (usa só as regras). */
  classifier: ReportClassifier | null;
  now?: () => Date;
}

export async function incidentRoutes(app: FastifyInstance, opts: IncidentRouteOptions) {
  const { db, classifier } = opts;
  const now = opts.now ?? (() => new Date());

  async function viewerOf(request: FastifyRequest): Promise<Viewer> {
    const session = await requireSession(db, request);
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { isDemo: true, name: true } });
    if (!user) throw new HttpError(401, "Sessão inválida ou expirada");
    return { userId: session.userId, sessionId: session.id, isDemo: user.isDemo, name: user.name };
  }

  const read = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };
  const write = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

  app.get("/me/incidents", read, async (request, reply) => {
    const viewer = await viewerOf(request);
    return reply.header("cache-control", "no-store").send(await listIncidents(db, viewer, now()));
  });

  app.get("/me/incidents/:id", read, async (request, reply) => {
    const viewer = await viewerOf(request);
    const { id } = idParams.parse(request.params);
    return reply.header("cache-control", "no-store").send(await getIncidentView(db, viewer, id, now()));
  });

  app.post("/me/incidents/from-breach", write, async (request, reply) => {
    const viewer = await viewerOf(request);
    const { breachId } = fromBreachBody.parse(request.body);
    const result = await openBreachIncident(db, viewer, breachId);
    return reply.code(result.created ? 201 : 200).send(result);
  });

  /** Relato livre. É a rota que chama o LLM: limite mais baixo por IP e cota por hora. */
  app.post(
    "/me/incidents/report",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const viewer = await viewerOf(request);
      const body = reportBody.parse(request.body);
      await assertReportQuota(db, viewer, now());

      const narrative = redactPersonalData(body.text);
      const classification = body.type
        ? { ...classifyByRules(narrative), type: body.type, by: "USER" as const }
        : await classifyReport(narrative, classifier, request.log);

      if (!classification.type) {
        return reply.code(422).send({
          error: "Não consegui identificar o tipo de incidente. Escolha a opção mais próxima.",
          needsType: true,
        });
      }

      const incident = await createReportedIncident(db, viewer, {
        type: classification.type,
        flags: classification.flags,
        summary: classification.summary,
        narrative,
        classifiedBy: classification.by,
      });
      return reply.code(201).send({ id: incident.id, type: classification.type, classifiedBy: classification.by });
    },
  );

  app.patch("/me/incidents/:id/steps", write, async (request, reply) => {
    const viewer = await viewerOf(request);
    const { id } = idParams.parse(request.params);
    const { stepId, done } = stepBody.parse(request.body);
    await setStepDone(db, viewer, id, stepId, done);
    return reply.code(204).send();
  });

  app.post("/me/incidents/:id/lgpd", write, async (request, reply) => {
    const viewer = await viewerOf(request);
    const { id } = idParams.parse(request.params);
    const { event } = lgpdBody.parse(request.body);
    await recordLgpdEvent(db, viewer, id, event, now());
    return reply.code(204).send();
  });
}
