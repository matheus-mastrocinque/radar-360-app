import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeExposureScore, levelFor, type Severity } from "./score.js";

const findings = (...severities: Severity[]) => severities.map((severity) => ({ severity }));

describe("computeExposureScore", () => {
  it("sem vazamentos nem auditorias, o score é 0 (baixo)", () => {
    const score = computeExposureScore({ breaches: [], scans: [] });
    assert.equal(score.value, 0);
    assert.equal(score.level, "baixo");
    assert.deepEqual(score.factors, []);
  });

  it("reproduz o score da persona da demo", () => {
    const score = computeExposureScore({
      breaches: [
        { dataClasses: ["nome", "cpf", "telefone", "endereco"] },
        { dataClasses: ["nome", "email", "senha_hash", "historico_compras"] },
        { dataClasses: ["nome", "cpf", "data_nascimento", "email", "convenio"] },
      ],
      scans: [
        { scope: "home", findings: findings("high", "medium", "low", "low", "low", "info") },
        { scope: "public", findings: findings("medium", "low", "info") },
      ],
    });
    assert.equal(score.leaks.points, 55);
    assert.equal(score.network.points, 20);
    assert.equal(score.value, 75);
    assert.equal(score.levelLabel, "Alto");
    assert.equal(score.factors[0]?.label, "CPF");
    assert.equal(score.factors[0]?.points, 12);
  });

  it("conta a categoria uma vez por vazamento e limita o bônus de repetição a +6", () => {
    const score = computeExposureScore({
      breaches: Array.from({ length: 5 }, () => ({ dataClasses: ["cpf", "cpf"] })),
      scans: [],
    });
    assert.equal(score.factors.length, 1);
    assert.equal(score.factors[0]?.points, 16);
  });

  it("usa o peso padrão para categorias fora da tabela", () => {
    const score = computeExposureScore({ breaches: [{ dataClasses: ["placa_veiculo"] }], scans: [] });
    assert.equal(score.value, 3);
    assert.equal(score.factors[0]?.label, "Placa veiculo");
  });

  it("aplica os tetos de 70 (vazamentos) e 30 (rede)", () => {
    const score = computeExposureScore({
      breaches: Array.from({ length: 4 }, (_, i) => ({
        dataClasses: ["senha", "cartao", "cpf", "rg", "dados_saude", `extra_${i}`],
      })),
      scans: [{ scope: "home", findings: findings("critical", "critical", "critical") }],
    });
    assert.equal(score.leaks.cap, 70);
    assert.ok(score.leaks.raw > 70);
    assert.equal(score.leaks.points, 70);
    assert.equal(score.network.points, 30);
    assert.equal(score.value, 100);
    assert.equal(score.level, "critico");
  });

  it("achados informativos não somam pontos", () => {
    const score = computeExposureScore({
      breaches: [],
      scans: [{ scope: "public", findings: findings("info", "info") }],
    });
    assert.equal(score.value, 0);
    assert.equal(score.factors.length, 0);
  });
});

describe("levelFor", () => {
  it("respeita os limites das faixas", () => {
    assert.equal(levelFor(24).level, "baixo");
    assert.equal(levelFor(25).level, "moderado");
    assert.equal(levelFor(49).level, "moderado");
    assert.equal(levelFor(50).level, "alto");
    assert.equal(levelFor(79).level, "alto");
    assert.equal(levelFor(80).level, "critico");
  });
});
