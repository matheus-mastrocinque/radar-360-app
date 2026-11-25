import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "../../shared/db.js";
import { normalizeDomain } from "../../shared/domain.js";
import { searchKey } from "../accounts/services.js";
import { buildLgpdNotice } from "../incidents/lgpd.js";
import { importHibpCatalog, mapDataClasses, toCatalogBreach } from "./hibp.js";

const netshoes = {
  Name: "Netshoes",
  Title: "Netshoes",
  Domain: "www.netshoes.com.br",
  BreachDate: "2017-12-07",
  AddedDate: "2018-01-01T00:00:00Z",
  PwnCount: 499836,
  DataClasses: ["Email addresses", "Dates of birth", "Names", "Purchases", "Spoken languages"],
  IsVerified: true,
};

describe("catálogo do Have I Been Pwned", () => {
  it("converte um vazamento verificado em metadados, sem dado pessoal", () => {
    const breach = toCatalogBreach(netshoes);
    assert.ok(breach);
    assert.equal(breach.domain, "netshoes.com.br");
    assert.equal(breach.slug, "hibp-netshoes");
    assert.equal(breach.company, "Netshoes");
    assert.equal(breach.pwnCount, 499836);
    assert.deepEqual(breach.dataClasses, ["email", "data_nascimento", "nome", "historico_compras", "outros"]);
    assert.equal(breach.sourceUrl, "https://haveibeenpwned.com/Breach/Netshoes");
    assert.equal(breach.occurredAt.toISOString(), "2017-12-07T00:00:00.000Z");
  });

  it("ignora o que seria injusto ou inútil mostrar", () => {
    assert.equal(toCatalogBreach({ ...netshoes, IsVerified: false }), null, "não verificado");
    assert.equal(toCatalogBreach({ ...netshoes, Title: "Misattributed Netshoes Data" }), null, "atribuído à empresa errada");
    assert.equal(toCatalogBreach({ ...netshoes, IsSensitive: true }), null, "sensível");
    assert.equal(toCatalogBreach({ ...netshoes, IsSpamList: true }), null, "lista de spam");
    assert.equal(toCatalogBreach({ ...netshoes, IsFabricated: true }), null, "fabricado");
    assert.equal(toCatalogBreach({ ...netshoes, Domain: "" }), null, "sem domínio");
    assert.equal(toCatalogBreach({ nada: true }), null, "formato inválido");
  });

  it("traduz as categorias para a tabela curada e junta as repetidas", () => {
    assert.deepEqual(mapDataClasses(["Passwords", "Historical passwords", "Credit cards"]), ["senha", "cartao"]);
    assert.deepEqual(mapDataClasses(["Spoken languages", "Time zones"]), ["outros"]);
  });

  it("importa só os vazamentos válidos e remove os que saíram do catálogo", async () => {
    const created: Array<Record<string, unknown>> = [];
    let removedFilter: unknown;
    const db = {
      breach: {
        findMany: async () => [],
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          created.push(...data);
          return { count: data.length };
        },
        update: async () => ({}),
        deleteMany: async ({ where }: { where: unknown }) => {
          removedFilter = where;
          return { count: 2 };
        },
      },
    } as unknown as Db;
    const fetchCatalog = async () =>
      new Response(JSON.stringify([netshoes, { ...netshoes, Name: "Falso", IsVerified: false }]), { status: 200 });

    const result = await importHibpCatalog(db, fetchCatalog);
    assert.deepEqual(result, { received: 2, created: 1, updated: 0, skipped: 1, removed: 2 });
    assert.equal(created[0]?.source, "HIBP");
    assert.equal(created[0]?.isSynthetic, false);
    assert.deepEqual(removedFilter, { source: "HIBP", externalId: { notIn: ["Netshoes"] } });
  });

  it("falha com mensagem clara se o HIBP não responder", async () => {
    const db = {} as Db;
    await assert.rejects(importHibpCatalog(db, async () => new Response("", { status: 503 })), /503/);
  });
});

describe("domínios e busca", () => {
  it("normaliza o que a pessoa digita", () => {
    assert.equal(normalizeDomain("HTTPS://www.Netshoes.com.br/login?x=1"), "netshoes.com.br");
    assert.equal(normalizeDomain("gov.br."), "gov.br");
    assert.equal(normalizeDomain("localhost"), null);
    assert.equal(normalizeDomain("não é domínio"), null);
    assert.equal(normalizeDomain(""), null);
  });

  it("busca sem acento e sem maiúscula", () => {
    assert.equal(searchKey("  Itaú "), "itau");
  });
});

describe("notificação LGPD sem data", () => {
  it("omite a data quando a empresa não informou", () => {
    const notice = buildLgpdNotice({
      holderName: "Ana Demo",
      company: "Loja Exemplo",
      occurredAt: null,
      dataClassLabels: ["E-mail", "CPF"],
      now: new Date("2026-11-25T12:00:00Z"),
    });
    assert.doesNotMatch(notice.body, /ocorrido em/);
    assert.match(notice.body, /incidente de segurança na Loja Exemplo, que expôs dados como: e-mail, CPF\./);
  });
});
