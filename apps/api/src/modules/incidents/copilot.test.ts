import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INCIDENT_FLAGS,
  LGPD_ARTICLES,
  OFFICIAL_LINKS,
  REPORTABLE_TYPES,
  playbookFor,
} from "./catalog.js";
import {
  classifyByRules,
  classifyReport,
  cleanSummary,
  withHourlyBudget,
  type ReportClassifier,
} from "./classify.js";
import { buildAnpdPetition, buildLgpdNotice, lgpdTimeline } from "./lgpd.js";
import { applicableSteps, buildPlan } from "./plan.js";
import { redactPersonalData } from "./redact.js";

const DAY = 24 * 60 * 60 * 1000;

describe("catálogo curado", () => {
  it("todo link oficial é https em domínio conhecido", () => {
    for (const link of Object.values(OFFICIAL_LINKS)) {
      const url = new URL(link.url);
      assert.equal(url.protocol, "https:");
      assert.match(url.hostname, /(gov\.br|google\.com|icloud\.com|consumidor\.gov\.br)$/);
    }
  });

  it("ids de passo são únicos em cada playbook e todos citam fase válida", () => {
    for (const type of [...REPORTABLE_TYPES, "DATA_BREACH"] as const) {
      const steps = playbookFor(type);
      assert.equal(new Set(steps.map((step) => step.id)).size, steps.length, type);
      for (const step of steps) assert.ok(["now", "hour", "day"].includes(step.phase));
    }
  });

  it("nenhum passo cita telefone: o plano manda usar o número oficial", () => {
    for (const type of [...REPORTABLE_TYPES, "DATA_BREACH"] as const) {
      for (const step of playbookFor(type)) assert.doesNotMatch(`${step.title} ${step.detail}`, /\d{4}-?\d{4}/);
    }
  });
});

describe("plano de resposta", () => {
  it("celular roubado tem os três horizontes e começa pelo Celular Seguro", () => {
    const plan = buildPlan({ type: "STOLEN_PHONE", flags: [] });
    assert.deepEqual(
      plan.phases.map((phase) => phase.key),
      ["now", "hour", "day"],
    );
    const now = plan.phases[0]!.steps.map((step) => step.id);
    assert.ok(now.includes("phone_celular_seguro"));
    const celularSeguro = plan.phases[0]!.steps.find((step) => step.id === "phone_celular_seguro")!;
    assert.equal(celularSeguro.links[0]?.url, "https://celularseguro.mj.gov.br");
  });

  it("passos condicionais só entram com o sinal do relato", () => {
    const without = applicableSteps({ type: "PIX_SCAM", flags: [] }).map((step) => step.id);
    const withRemote = applicableSteps({ type: "PIX_SCAM", flags: ["REMOTE_APP"] }).map((step) => step.id);
    assert.ok(!without.includes("remote_app_remove"));
    assert.ok(withRemote.includes("remote_app_remove"));
    assert.ok(withRemote.includes("pix_lock_account"));
  });

  it("vazamento: passos seguem as categorias expostas", () => {
    const ids = applicableSteps({ type: "DATA_BREACH", flags: [], dataClasses: ["nome", "cpf", "telefone"] }).map(
      (step) => step.id,
    );
    assert.ok(ids.includes("breach_sim_pin"));
    assert.ok(ids.includes("breach_registrato"));
    assert.ok(ids.includes("breach_lgpd_notice"));
    assert.ok(!ids.includes("breach_password"));
    assert.ok(!ids.includes("breach_card"));
  });

  it("progresso conta só passos aplicáveis", () => {
    const plan = buildPlan({
      type: "DATA_BREACH",
      flags: [],
      dataClasses: ["email", "senha_hash"],
      completedSteps: ["breach_password", "breach_card", "passo_inexistente"],
    });
    assert.equal(plan.progress.done, 1);
    assert.ok(plan.progress.total >= 4);
  });
});

describe("LGPD", () => {
  const sentAt = new Date("2026-11-01T12:00:00Z");

  it("prazo do art. 19, II: 15 dias corridos a partir do envio", () => {
    assert.equal(lgpdTimeline(null, null, sentAt).status, "not_sent");

    const waiting = lgpdTimeline(sentAt, null, new Date(sentAt.getTime() + 10 * DAY));
    assert.equal(waiting.status, "waiting");
    assert.equal(waiting.daysLeft, 5);
    assert.equal(waiting.deadline, "2026-11-16T12:00:00.000Z");

    assert.equal(lgpdTimeline(sentAt, null, new Date(sentAt.getTime() + 15 * DAY)).status, "overdue");
    assert.equal(lgpdTimeline(sentAt, new Date(), new Date(sentAt.getTime() + 30 * DAY)).status, "answered");
  });

  it("notificação cita só artigos da tabela e deixa CPF e e-mail para o titular preencher", () => {
    const notice = buildLgpdNotice({
      holderName: "Ana Demo",
      company: "TeleConecta Telecom (fictícia)",
      occurredAt: new Date("2025-08-14"),
      dataClassLabels: ["CPF", "Telefone"],
      now: new Date("2026-11-23T12:00:00Z"),
    });
    assert.match(notice.body, /art\. 19, II/);
    assert.match(notice.body, /agosto de 2025/);
    assert.match(notice.body, /CPF: \[preencha/);
    assert.match(notice.body, /CPF, telefone/);
    const known = new Set<string>(Object.values(LGPD_ARTICLES).map((article) => article.ref));
    for (const article of notice.articles) assert.ok(known.has(article.ref));
  });

  it("petição à ANPD traz as datas e o canal oficial", () => {
    const petition = buildAnpdPetition({
      holderName: "Ana Demo",
      company: "TeleConecta",
      sentAt,
      deadline: new Date(sentAt.getTime() + 15 * DAY),
    });
    assert.match(petition.text, /01\/11\/2026/);
    assert.match(petition.text, /16\/11\/2026/);
    assert.equal(petition.links[0]?.url, OFFICIAL_LINKS.anpd_peticao.url);
  });
});

describe("remoção de dados pessoais do relato", () => {
  it("troca CPF, cartão, telefone, e-mail e chave aleatória por marcadores", () => {
    const text =
      "Meu CPF 123.456.789-09, cartão 4111 1111 1111 1111, celular (11) 91234-5678, " +
      "email ana@exemplo.com e a chave 123e4567-e89b-12d3-a456-426614174000. Paguei R$ 1.500,00.";
    const redacted = redactPersonalData(text);
    assert.doesNotMatch(redacted, /123\.456|4111|91234|ana@|123e4567/);
    assert.match(redacted, /\[CPF\]/);
    assert.match(redacted, /\[cartão\]/);
    assert.match(redacted, /\[telefone\]/);
    assert.match(redacted, /\[e-mail\]/);
    assert.match(redacted, /R\$ 1\.500,00/, "valores em reais continuam legíveis");
  });

  it("resumo do modelo também passa pela limpeza", () => {
    assert.equal(cleanSummary("Você enviou um Pix para 11912345678."), "Você enviou um Pix para [CPF ou telefone].");
    assert.equal(cleanSummary("   "), null);
  });
});

describe("classificação por regras", () => {
  const cases: Array<[string, string]> = [
    ["Caí num golpe do Pix, transferi 800 reais para um falso vendedor", "PIX_SCAM"],
    ["Roubaram meu celular no ônibus agora há pouco", "STOLEN_PHONE"],
    ["Clonaram meu WhatsApp e estão pedindo dinheiro aos meus amigos", "ACCOUNT_TAKEOVER"],
    ["Cliquei num link de SMS dos Correios e digitei meus dados", "PHISHING"],
    ["Apareceu um empréstimo que eu não fiz no meu CPF", "IDENTITY_FRAUD"],
  ];
  for (const [text, expected] of cases) {
    it(`"${text.slice(0, 40)}..." → ${expected}`, () => {
      assert.equal(classifyByRules(text).type, expected);
    });
  }

  it("sinais respeitam negação", () => {
    assert.deepEqual(classifyByRules("Instalei o app que o falso gerente pediu e passei a senha").flags, [
      "PASSWORD_SHARED",
      "REMOTE_APP",
    ]);
    assert.ok(!classifyByRules("Não passei a senha para ninguém").flags.includes("PASSWORD_SHARED"));
  });

  it("relato sem relação com os tipos não é classificado", () => {
    assert.equal(classifyByRules("Quero saber como funciona a plataforma").type, null);
  });
});

describe("classificação com LLM", () => {
  const ok: ReportClassifier = {
    classify: async () => ({ type: "PHISHING", flags: ["PASSWORD_SHARED"], summary: "Você digitou a senha num site falso." }),
  };
  const broken: ReportClassifier = {
    classify: async () => {
      throw new Error("timeout");
    },
  };
  const unsure: ReportClassifier = { classify: async () => ({ type: null, flags: [], summary: null }) };

  it("usa a resposta do modelo quando ele classifica", async () => {
    const result = await classifyReport("qualquer relato", ok);
    assert.equal(result.by, "AI");
    assert.equal(result.type, "PHISHING");
  });

  it("cai nas regras se o modelo falhar ou não reconhecer o tipo", async () => {
    const text = "Roubaram meu celular";
    assert.deepEqual(await classifyReport(text, broken), { ...classifyByRules(text), by: "RULES" });
    assert.equal((await classifyReport(text, unsure)).type, "STOLEN_PHONE");
    assert.equal((await classifyReport(text, null)).by, "RULES");
  });

  it("teto por hora: passou do limite, cai nas regras; na hora seguinte, volta ao modelo", async () => {
    let now = 0;
    let calls = 0;
    const counted: ReportClassifier = {
      classify: async (text) => {
        calls += 1;
        return ok.classify(text);
      },
    };
    const budgeted = withHourlyBudget(counted, 2, () => now);
    assert.equal((await classifyReport("relato", budgeted)).by, "AI");
    assert.equal((await classifyReport("relato", budgeted)).by, "AI");
    assert.equal((await classifyReport("Roubaram meu celular", budgeted)).by, "RULES");
    assert.equal(calls, 2, "a terceira chamada não chega ao modelo");
    now += 60 * 60 * 1000;
    assert.equal((await classifyReport("relato", budgeted)).by, "AI");
  });

  it("sinais possíveis são só os da lista curada", () => {
    assert.deepEqual([...INCIDENT_FLAGS].sort(), ["CARD_SHARED", "CODE_SHARED", "MONEY_SENT", "PASSWORD_SHARED", "REMOTE_APP"]);
  });
});
