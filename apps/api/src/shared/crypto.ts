import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type IdentifierType = "EMAIL" | "CPF" | "PHONE";

export class InvalidIdentifierError extends Error {
  constructor(type: IdentifierType) {
    super(`Identificador inválido para o tipo ${type}`);
    this.name = "InvalidIdentifierError";
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida os dígitos verificadores de um CPF (11 dígitos, sem máscara). */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

/** Completa 9 dígitos-base com os 2 dígitos verificadores. Usado só para gerar CPFs sintéticos. */
export function completeCpf(base9: string): string {
  if (!/^\d{9}$/.test(base9)) throw new Error("A base do CPF precisa de 9 dígitos");
  const digitFor = (digits: string): number => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (digits.length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const first = digitFor(base9);
  return `${base9}${first}${digitFor(`${base9}${first}`)}`;
}

/** Normaliza o identificador para que o mesmo dado sempre gere o mesmo HMAC. */
export function normalizeIdentifier(type: IdentifierType, raw: string): string {
  const value = raw.trim();
  switch (type) {
    case "EMAIL": {
      const email = value.toLowerCase();
      if (!EMAIL_PATTERN.test(email)) throw new InvalidIdentifierError(type);
      return email;
    }
    case "CPF": {
      const digits = onlyDigits(value);
      if (!isValidCpf(digits)) throw new InvalidIdentifierError(type);
      return digits;
    }
    case "PHONE": {
      const digits = onlyDigits(value);
      if (digits.length === 10 || digits.length === 11) return `55${digits}`;
      if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
      throw new InvalidIdentifierError(type);
    }
  }
}

/**
 * HMAC-SHA256 com chave secreta guardada fora do banco.
 * Um hash simples não serve: CPF e telefone têm poucas combinações e cairiam por força bruta.
 */
export function hmacIdentifier(secret: string, type: IdentifierType, normalized: string): string {
  return createHmac("sha256", secret).update(`${type}:${normalized}`).digest("hex");
}

export function maskIdentifier(type: IdentifierType, normalized: string): string {
  switch (type) {
    case "EMAIL": {
      const [local = "", domain = ""] = normalized.split("@");
      if (local.length <= 2) return `${"*".repeat(Math.max(local.length, 1))}@${domain}`;
      return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    }
    case "CPF":
      return `***.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-**`;
    case "PHONE": {
      const ddd = normalized.slice(2, 4);
      const local = normalized.slice(4);
      return `(${ddd}) ${"*".repeat(local.length - 4)}-${local.slice(-4)}`;
    }
  }
}

/** Token de pareamento do agente: 256 bits aleatórios, mostrado uma única vez ao usuário. */
export function generatePairingToken(): string {
  return `rdr_${randomBytes(32).toString("base64url")}`;
}

/** Token de sessão do site: 256 bits aleatórios, guardado no banco só como SHA-256. */
export function generateSessionToken(): string {
  return `r360s_${randomBytes(32).toString("base64url")}`;
}

/** Tokens aleatórios de alta entropia podem ser guardados com SHA-256 simples. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparação em tempo constante, inclusive para tamanhos diferentes. */
export function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
