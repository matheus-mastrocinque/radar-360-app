import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { buildApp } from "./app.js";
import type { ReportClassifier } from "./modules/incidents/classify.js";
import type { Db } from "./shared/db.js";

const env = { WEB_ORIGIN: "http://localhost:3000", JOBS_SECRET: "jobs-secret-for-tests" };

/** Banco falso: só o necessário para as rotas testadas aqui. */
function fakeDb(overrides: Partial<Record<string, unknown>> = {}): Db {
  return {
    $queryRaw: async () => [{ "?column?": 1 }],
    pairingToken: { findUnique: async () => null },
    session: { findUnique: async () => null },
    user: { findFirst: async () => null },
    breach: { findUnique: async () => null },
    ...overrides,
  } as unknown as Db;
}

const validScan = {
  agentVersion: "0.1.0",
  mode: "public",
  startedAt: "2026-11-22T12:00:00Z",
  finishedAt: "2026-11-22T12:00:05Z",
  host: { os: "windows", hostname: "host-de-teste" },
  network: { localIp: "192.168.0.10", cidr: null, gateway: "192.168.0.1", isPrivate: true, wifiSecurity: "WPA2-Personal" },
  devices: [],
  findings: [],
};

describe("API", () => {
  it("GET /health responde ok com banco disponível", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok", database: "ok" });
  });

  it("GET /health responde 503 quando o banco falha", async () => {
    const db = fakeDb({
      $queryRaw: async () => {
        throw new Error("down");
      },
    });
    const app = await buildApp({ db, env, logger: false });
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 503);
  });

  it("POST /network/scans exige token de pareamento", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({ method: "POST", url: "/network/scans", payload: validScan });
    assert.equal(response.statusCode, 401);
  });

  it("POST /network/scans recusa token desconhecido", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/network/scans",
      headers: { "x-pairing-token": "rdr_desconhecido" },
      payload: validScan,
    });
    assert.equal(response.statusCode, 401);
  });

  it("POST /network/scans recusa dispositivos de terceiros no modo rede pública", async () => {
    const db = fakeDb({
      pairingToken: {
        findUnique: async () => ({ id: "t1", userId: "u1", expiresAt: new Date(Date.now() + 60_000) }),
      },
    });
    const app = await buildApp({ db, env, logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/network/scans",
      headers: { "x-pairing-token": "rdr_valido" },
      payload: {
        ...validScan,
        devices: [{ ip: "192.168.0.20", mac: null, vendor: null, hostname: null, model: null, openPorts: [80], services: [] }],
      },
    });
    assert.equal(response.statusCode, 400);
  });

  it("POST /internal/jobs/breach-check exige o segredo do job", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({ method: "POST", url: "/internal/jobs/breach-check" });
    assert.equal(response.statusCode, 401);
  });

  it("POST /auth/demo responde 503 se a persona da demo não existe", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({ method: "POST", url: "/auth/demo" });
    assert.equal(response.statusCode, 503);
  });

  it("POST /auth/demo abre sessão e guarda só o hash do token", async () => {
    let stored: { userId: string; tokenHash: string; expiresAt: Date } | undefined;
    const db = fakeDb({
      user: { findFirst: async () => ({ id: "demo-user" }) },
      session: {
        deleteMany: async () => ({ count: 0 }),
        create: async ({ data }: { data: typeof stored }) => {
          stored = data;
          return data;
        },
      },
    });
    const app = await buildApp({ db, env, logger: false });
    const response = await app.inject({ method: "POST", url: "/auth/demo" });
    assert.equal(response.statusCode, 201);

    const { token } = response.json() as { token: string };
    assert.match(token, /^r360s_[A-Za-z0-9_-]{43}$/);
    assert.equal(stored?.userId, "demo-user");
    assert.equal(stored?.tokenHash, createHash("sha256").update(token).digest("hex"));
    assert.ok(stored && stored.expiresAt.getTime() > Date.now());
  });

  it("GET /me/dashboard exige sessão", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({ method: "GET", url: "/me/dashboard" });
    assert.equal(response.statusCode, 401);
  });

  it("GET /me/dashboard recusa sessão expirada", async () => {
    const db = fakeDb({
      session: {
        findUnique: async () => ({ id: "s1", userId: "u1", expiresAt: new Date(Date.now() - 1000) }),
      },
    });
    const app = await buildApp({ db, env, logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/me/dashboard",
      headers: { authorization: "Bearer r360s_expirado" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("POST /auth/logout exige sessão", async () => {
    const app = await buildApp({ db: fakeDb(), env, logger: false });
    const response = await app.inject({ method: "POST", url: "/auth/logout" });
    assert.equal(response.statusCode, 401);
  });

  describe("copiloto de incidentes", () => {
    const auth = { authorization: "Bearer r360s_valido" };

    /** Sessão válida da persona demo + um banco de incidentes em memória. */
    function copilotDb(overrides: Partial<Record<string, unknown>> = {}) {
      const created: Array<Record<string, unknown>> = [];
      const db = fakeDb({
        session: {
          findUnique: async () => ({ id: "s1", userId: "u1", expiresAt: new Date(Date.now() + 60_000) }),
        },
        user: { findUnique: async () => ({ isDemo: true, name: "Ana Demo" }), findFirst: async () => null },
        incident: {
          count: async () => 0,
          create: async ({ data }: { data: Record<string, unknown> }) => {
            created.push(data);
            return { id: `inc${created.length}` };
          },
          findFirst: async () => null,
          findMany: async () => [],
        },
        ...overrides,
      });
      return { db, created };
    }

    it("GET /me/incidents exige sessão", async () => {
      const app = await buildApp({ db: fakeDb(), env, logger: false });
      const response = await app.inject({ method: "GET", url: "/me/incidents" });
      assert.equal(response.statusCode, 401);
    });

    it("relato: remove CPF e telefone antes de chamar o LLM e de gravar", async () => {
      const { db, created } = copilotDb();
      let seenByModel = "";
      const classifier: ReportClassifier = {
        classify: async (text) => {
          seenByModel = text;
          return { type: "PIX_SCAM", flags: ["MONEY_SENT"], summary: "Você fez um Pix para um golpista." };
        },
      };
      const app = await buildApp({ db, env, logger: false, classifier });
      const response = await app.inject({
        method: "POST",
        url: "/me/incidents/report",
        headers: auth,
        payload: { text: "Fiz um Pix pro golpista, meu CPF é 123.456.789-09 e meu celular (11) 91234-5678" },
      });
      assert.equal(response.statusCode, 201);
      assert.deepEqual(response.json(), { id: "inc1", type: "PIX_SCAM", classifiedBy: "AI" });
      assert.doesNotMatch(seenByModel, /123\.456|91234/);
      assert.doesNotMatch(String(created[0]?.narrative), /123\.456|91234/);
      assert.equal(created[0]?.sessionId, "s1", "na demo o incidente fica preso à sessão");
    });

    it("relato com tipo escolhido pelo usuário não chama o LLM", async () => {
      const { db, created } = copilotDb();
      const classifier: ReportClassifier = {
        classify: async () => {
          throw new Error("não deveria ser chamado");
        },
      };
      const app = await buildApp({ db, env, logger: false, classifier });
      const response = await app.inject({
        method: "POST",
        url: "/me/incidents/report",
        headers: auth,
        payload: { text: "Levaram meu telefone quando eu saía do metrô", type: "STOLEN_PHONE" },
      });
      assert.equal(response.statusCode, 201);
      assert.equal(created[0]?.classifiedBy, "USER");
      assert.equal(created[0]?.type, "STOLEN_PHONE");
    });

    it("relato sem tipo reconhecível pede para o usuário escolher", async () => {
      const { db, created } = copilotDb();
      const app = await buildApp({ db, env, logger: false });
      const response = await app.inject({
        method: "POST",
        url: "/me/incidents/report",
        headers: auth,
        payload: { text: "Quero entender melhor como funciona o site de vocês" },
      });
      assert.equal(response.statusCode, 422);
      assert.equal((response.json() as { needsType: boolean }).needsType, true);
      assert.equal(created.length, 0);
    });

    it("relato muito curto é recusado", async () => {
      const { db } = copilotDb();
      const app = await buildApp({ db, env, logger: false });
      const response = await app.inject({
        method: "POST",
        url: "/me/incidents/report",
        headers: auth,
        payload: { text: "golpe" },
      });
      assert.equal(response.statusCode, 400);
    });

    it("cota por hora protege a rota do LLM", async () => {
      const { db } = copilotDb({
        incident: { count: async () => 20, create: async () => ({ id: "x" }), findFirst: async () => null },
      });
      const app = await buildApp({ db, env, logger: false });
      const response = await app.inject({
        method: "POST",
        url: "/me/incidents/report",
        headers: auth,
        payload: { text: "Roubaram meu celular agora há pouco" },
      });
      assert.equal(response.statusCode, 429);
    });

    it("incidente de outra pessoa ou de outra sessão responde 404", async () => {
      let where: Record<string, unknown> | undefined;
      const { db } = copilotDb({
        incident: {
          findFirst: async (args: { where: Record<string, unknown> }) => {
            where = args.where;
            return null;
          },
        },
      });
      const app = await buildApp({ db, env, logger: false });
      const response = await app.inject({ method: "GET", url: "/me/incidents/inc-alheio", headers: auth });
      assert.equal(response.statusCode, 404);
      assert.deepEqual(where, { id: "inc-alheio", userId: "u1", sessionId: "s1" });
    });

    it("plano de vazamento só abre para vazamento que tem dado do usuário", async () => {
      const { db } = copilotDb({ exposure: { findFirst: async () => null } });
      const app = await buildApp({ db, env, logger: false });
      const response = await app.inject({
        method: "POST",
        url: "/me/incidents/from-breach",
        headers: auth,
        payload: { breachId: "b-de-outra-pessoa" },
      });
      assert.equal(response.statusCode, 404);
    });

    it("marcar passo que não é do plano responde 400", async () => {
      const { db } = copilotDb({
        incident: {
          findFirst: async () => ({
            id: "inc1",
            type: "STOLEN_PHONE",
            flags: [],
            completedSteps: [],
            breach: null,
          }),
        },
      });
      const app = await buildApp({ db, env, logger: false });
      const response = await app.inject({
        method: "PATCH",
        url: "/me/incidents/inc1/steps",
        headers: auth,
        payload: { stepId: "pix_med", done: true },
      });
      assert.equal(response.statusCode, 400);
    });
  });
});
