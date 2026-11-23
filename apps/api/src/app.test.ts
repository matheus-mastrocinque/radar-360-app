import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApp } from "./app.js";
import type { Db } from "./shared/db.js";

const env = { WEB_ORIGIN: "http://localhost:3000", JOBS_SECRET: "jobs-secret-for-tests" };

/** Banco falso: só o necessário para as rotas testadas aqui. */
function fakeDb(overrides: Partial<Record<string, unknown>> = {}): Db {
  return {
    $queryRaw: async () => [{ "?column?": 1 }],
    pairingToken: { findUnique: async () => null },
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
});
