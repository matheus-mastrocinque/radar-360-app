/**
 * Popula o banco com dados 100% sintéticos para desenvolvimento e para a demo do júri:
 * - persona fictícia com e-mail, CPF e telefone já verificados;
 * - três vazamentos de empresas fictícias, com identificadores aleatórios guardados só como HMAC;
 * - um token de pareamento para testar o agente local.
 * Regra do regulamento (item 6.9): nada aqui pode ser dado real de terceiros.
 */
import type { AssetType } from "../src/generated/prisma/client.js";
import { loadEnv } from "../src/config/env.js";
import { createDb } from "../src/shared/db.js";
import {
  completeCpf,
  generatePairingToken,
  hashToken,
  hmacIdentifier,
  maskIdentifier,
  normalizeIdentifier,
} from "../src/shared/crypto.js";
import { runBreachCheck } from "../src/modules/breaches/job.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const PERSONA = {
  email: "demo@example.com",
  name: "Ana Demo (persona fictícia)",
  identifiers: [
    { type: "EMAIL", value: "demo@example.com" },
    { type: "CPF", value: "123.456.789-09" },
    { type: "PHONE", value: "(11) 90000-0001" },
  ] satisfies Array<{ type: AssetType; value: string }>,
};

const BREACHES = [
  {
    slug: "teleconecta-2025",
    company: "TeleConecta Telecom (fictícia)",
    occurredAt: new Date("2025-08-14"),
    disclosedAt: new Date("2025-09-02"),
    dataClasses: ["nome", "cpf", "telefone", "endereco"],
    description:
      "Base de clientes de uma operadora fictícia publicada em fórum. Incidente sintético para demonstração.",
    recordTypes: ["CPF", "PHONE"] as AssetType[],
    persona: ["CPF", "PHONE"] as AssetType[],
  },
  {
    slug: "lojafacil-2026",
    company: "LojaFácil Marketplace (fictícia)",
    occurredAt: new Date("2026-03-20"),
    disclosedAt: new Date("2026-04-11"),
    dataClasses: ["nome", "email", "senha_hash", "historico_compras"],
    description:
      "Credenciais de clientes de um marketplace fictício vendidas em canal clandestino. Incidente sintético.",
    recordTypes: ["EMAIL"] as AssetType[],
    persona: ["EMAIL"] as AssetType[],
  },
  {
    slug: "clinica-vida-2026",
    company: "Clínica Vida+ (fictícia)",
    occurredAt: new Date("2026-10-05"),
    disclosedAt: null,
    dataClasses: ["nome", "cpf", "data_nascimento", "email", "convenio"],
    description:
      "Cadastro de pacientes de uma rede de clínicas fictícia exposto por servidor mal configurado. Incidente sintético.",
    recordTypes: ["CPF", "EMAIL"] as AssetType[],
    persona: ["CPF", "EMAIL"] as AssetType[],
  },
];

const RECORDS_PER_TYPE = 300;

/** PRNG determinístico para o seed gerar sempre os mesmos dados. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDigits(random: () => number, length: number): string {
  return Array.from({ length }, () => Math.floor(random() * 10)).join("");
}

function syntheticIdentifier(type: AssetType, index: number, random: () => number): string {
  switch (type) {
    case "CPF":
      return completeCpf(randomDigits(random, 9));
    case "EMAIL":
      // .invalid é um domínio reservado: nunca pertence a ninguém.
      return `usuario${index}@exemplo.invalid`;
    case "PHONE":
      return `55${String(11 + Math.floor(random() * 88))}9${randomDigits(random, 8)}`;
  }
}

function hmacOf(type: AssetType, value: string): string {
  return hmacIdentifier(env.HMAC_SECRET, type, normalizeIdentifier(type, value));
}

async function main() {
  const user = await db.user.upsert({
    where: { email: PERSONA.email },
    update: { name: PERSONA.name, isDemo: true },
    create: { email: PERSONA.email, name: PERSONA.name, isDemo: true },
  });

  for (const { type, value } of PERSONA.identifiers) {
    const normalized = normalizeIdentifier(type, value);
    const hmac = hmacIdentifier(env.HMAC_SECRET, type, normalized);
    await db.asset.upsert({
      where: { type_hmac: { type, hmac } },
      update: { userId: user.id, verifiedAt: new Date() },
      create: {
        userId: user.id,
        type,
        hmac,
        masked: maskIdentifier(type, normalized),
        verifiedAt: new Date(),
      },
    });
  }

  for (const [breachIndex, spec] of BREACHES.entries()) {
    const { recordTypes, persona, ...data } = spec;
    const breach = await db.breach.upsert({
      where: { slug: spec.slug },
      update: data,
      create: { ...data, isSynthetic: true },
    });

    const random = mulberry32(1000 + breachIndex);
    const records: Array<{ breachId: string; assetType: AssetType; hmac: string }> = [];
    for (const type of recordTypes) {
      for (let i = 0; i < RECORDS_PER_TYPE; i++) {
        records.push({
          breachId: breach.id,
          assetType: type,
          hmac: hmacOf(type, syntheticIdentifier(type, i, random)),
        });
      }
    }
    for (const { type, value } of PERSONA.identifiers) {
      if (persona.includes(type)) {
        records.push({ breachId: breach.id, assetType: type, hmac: hmacOf(type, value) });
      }
    }
    await db.breachRecord.createMany({ data: records, skipDuplicates: true });
  }

  await db.pairingToken.deleteMany({ where: { userId: user.id, label: "seed" } });
  const token = generatePairingToken();
  await db.pairingToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      label: "seed",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const check = await runBreachCheck(db);

  console.log("Seed concluído (dados sintéticos).");
  console.log(`  Persona: ${PERSONA.email}`);
  console.log(`  Vazamentos sintéticos: ${BREACHES.length}`);
  console.log(`  Exposições novas da persona: ${check.newExposures.length}`);
  console.log("  Token de pareamento do agente (válido por 30 dias, mostrado só agora):");
  console.log(`  ${token}`);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
