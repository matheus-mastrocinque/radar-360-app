import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeCpf,
  generatePairingToken,
  hashToken,
  hmacIdentifier,
  InvalidIdentifierError,
  isValidCpf,
  maskIdentifier,
  normalizeIdentifier,
  safeEqual,
} from "./crypto.js";

const SECRET = "test-secret-with-at-least-32-characters!!";

describe("CPF", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    assert.equal(isValidCpf("12345678909"), true);
  });

  it("recusa dígito verificador errado e dígitos repetidos", () => {
    assert.equal(isValidCpf("12345678900"), false);
    assert.equal(isValidCpf("11111111111"), false);
    assert.equal(isValidCpf("123"), false);
  });

  it("gera CPFs sintéticos válidos", () => {
    assert.equal(completeCpf("123456789"), "12345678909");
    assert.equal(isValidCpf(completeCpf("987654321")), true);
  });
});

describe("normalizeIdentifier", () => {
  it("normaliza e-mail para minúsculas sem espaços", () => {
    assert.equal(normalizeIdentifier("EMAIL", "  Ana.Demo@Example.COM "), "ana.demo@example.com");
  });

  it("normaliza CPF com ou sem máscara", () => {
    assert.equal(normalizeIdentifier("CPF", "123.456.789-09"), "12345678909");
  });

  it("normaliza telefone para o formato com DDI 55", () => {
    assert.equal(normalizeIdentifier("PHONE", "(11) 90000-0001"), "5511900000001");
    assert.equal(normalizeIdentifier("PHONE", "+55 11 90000-0001"), "5511900000001");
  });

  it("recusa identificadores inválidos", () => {
    assert.throws(() => normalizeIdentifier("CPF", "123.456.789-00"), InvalidIdentifierError);
    assert.throws(() => normalizeIdentifier("EMAIL", "sem-arroba"), InvalidIdentifierError);
    assert.throws(() => normalizeIdentifier("PHONE", "123"), InvalidIdentifierError);
  });
});

describe("hmacIdentifier", () => {
  it("é determinístico para o mesmo dado e chave", () => {
    const a = hmacIdentifier(SECRET, "CPF", "12345678909");
    assert.equal(a, hmacIdentifier(SECRET, "CPF", "12345678909"));
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("muda com a chave e com o tipo", () => {
    const base = hmacIdentifier(SECRET, "CPF", "12345678909");
    assert.notEqual(base, hmacIdentifier(`${SECRET}x`, "CPF", "12345678909"));
    assert.notEqual(base, hmacIdentifier(SECRET, "PHONE", "12345678909"));
  });
});

describe("maskIdentifier", () => {
  it("mascara CPF no padrão ***.456.789-**", () => {
    assert.equal(maskIdentifier("CPF", "12345678909"), "***.456.789-**");
  });

  it("mascara e-mail mantendo a primeira e a última letra", () => {
    assert.equal(maskIdentifier("EMAIL", "ana.demo@example.com"), "a******o@example.com");
    assert.equal(maskIdentifier("EMAIL", "ab@example.com"), "**@example.com");
  });

  it("mascara telefone mantendo DDD e 4 últimos dígitos", () => {
    assert.equal(maskIdentifier("PHONE", "5511900000001"), "(11) *****-0001");
  });
});

describe("tokens", () => {
  it("gera tokens únicos com prefixo", () => {
    const token = generatePairingToken();
    assert.match(token, /^rdr_[A-Za-z0-9_-]{43}$/);
    assert.notEqual(token, generatePairingToken());
  });

  it("compara segredos em tempo constante", () => {
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abcd"), false);
    assert.match(hashToken("x"), /^[0-9a-f]{64}$/);
  });
});
