/**
 * Catálogo público do Have I Been Pwned (HIBP): metadados de vazamentos REAIS, ou seja, empresa,
 * domínio, data, categorias expostas e número de contas. Não exige chave e não traz nenhum dado
 * pessoal, então não fere a regra de "nenhum dado real de terceiros" (só metadados de incidentes).
 *
 * Licença CC BY 4.0: toda tela que mostra esses vazamentos traz a atribuição (HIBP_ATTRIBUTION).
 */
import { z } from "zod";
import type { Db } from "../../shared/db.js";
import { normalizeDomain } from "../../shared/domain.js";

export const HIBP_CATALOG_URL = "https://haveibeenpwned.com/api/v3/breaches";

export const HIBP_ATTRIBUTION = {
  label: "Have I Been Pwned",
  url: "https://haveibeenpwned.com",
  license: "CC BY 4.0",
} as const;

/** Categorias do HIBP (em inglês) → chaves da nossa tabela curada (data-classes.ts). */
const CLASS_MAP: Record<string, string> = {
  "Email addresses": "email",
  Passwords: "senha",
  "Historical passwords": "senha",
  "Password hints": "dica_senha",
  "Security questions and answers": "perguntas_seguranca",
  "Auth tokens": "tokens",
  Names: "nome",
  Usernames: "usuario",
  "Phone numbers": "telefone",
  "Physical addresses": "endereco",
  "Dates of birth": "data_nascimento",
  "Credit cards": "cartao",
  "Partial credit card data": "cartao",
  "Credit card CVV": "cartao",
  "Bank account numbers": "dados_bancarios",
  "Account balances": "dados_bancarios",
  "Payment histories": "dados_bancarios",
  "Payment methods": "dados_bancarios",
  "Government issued IDs": "documento",
  "Passport numbers": "documento",
  "Driver's licenses": "documento",
  "Social security numbers": "documento",
  "Tax file numbers": "documento",
  "Health insurance information": "convenio",
  "Medical records": "dados_saude",
  "Health records": "dados_saude",
  Purchases: "historico_compras",
  "IP addresses": "ip",
  "Geographic locations": "localizacao",
  Genders: "genero",
  Employers: "profissional",
  "Job titles": "profissional",
  "Social media profiles": "redes_sociais",
  "Private messages": "mensagens",
  "Device information": "dispositivo",
  "Browser user agent details": "dispositivo",
  Photos: "fotos",
  Avatars: "fotos",
};

export function mapDataClasses(classes: readonly string[]): string[] {
  const keys = classes.map((name) => CLASS_MAP[name] ?? "outros");
  return [...new Set(keys)];
}

const hibpBreachSchema = z.object({
  Name: z.string().min(1).max(200),
  Title: z.string().min(1).max(200),
  Domain: z.string().max(300).nullish(),
  BreachDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  AddedDate: z.string(),
  PwnCount: z.number().int().nonnegative(),
  DataClasses: z.array(z.string()).default([]),
  IsVerified: z.boolean().default(false),
  IsFabricated: z.boolean().default(false),
  IsSensitive: z.boolean().default(false),
  IsRetired: z.boolean().default(false),
  IsSpamList: z.boolean().default(false),
  IsMalware: z.boolean().default(false),
  IsStealerLog: z.boolean().default(false),
});

export type HibpBreach = z.infer<typeof hibpBreachSchema>;

export interface CatalogBreach {
  slug: string;
  externalId: string;
  company: string;
  domain: string;
  occurredAt: Date;
  disclosedAt: Date | null;
  dataClasses: string[];
  pwnCount: number;
  description: string;
  sourceUrl: string;
}

/**
 * Converte um item do catálogo. Devolve null para o que não deve aparecer: vazamentos não
 * verificados pelo HIBP, atribuídos à empresa errada ("Misattributed"), fabricados, sensíveis,
 * aposentados, listas de spam, malware/stealer logs ou sem domínio. Mostrar um vazamento que a
 * empresa não teve seria injusto com ela.
 */
export function toCatalogBreach(raw: unknown): CatalogBreach | null {
  const parsed = hibpBreachSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;
  if (!item.IsVerified || /^misattributed\b/i.test(item.Title)) return null;
  if (item.IsFabricated || item.IsSensitive || item.IsRetired || item.IsSpamList || item.IsMalware || item.IsStealerLog) {
    return null;
  }
  const domain = normalizeDomain(item.Domain);
  if (!domain) return null;

  const added = new Date(item.AddedDate);
  return {
    slug: `hibp-${item.Name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    externalId: item.Name,
    company: item.Title,
    domain,
    occurredAt: new Date(`${item.BreachDate}T00:00:00Z`),
    disclosedAt: Number.isNaN(added.getTime()) ? null : added,
    dataClasses: mapDataClasses(item.DataClasses),
    pwnCount: item.PwnCount,
    description: `Vazamento real catalogado pelo Have I Been Pwned: ${item.PwnCount.toLocaleString("pt-BR")} contas afetadas.`,
    sourceUrl: `${HIBP_ATTRIBUTION.url}/Breach/${encodeURIComponent(item.Name)}`,
  };
}

export interface CatalogImportResult {
  received: number;
  created: number;
  updated: number;
  skipped: number;
  /** Vazamentos do HIBP que deixaram de passar nos filtros e saíram da base. */
  removed: number;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Baixa o catálogo do HIBP e grava os vazamentos novos (e os que mudaram) como metadados. */
export async function importHibpCatalog(db: Db, fetchImpl: FetchLike = fetch): Promise<CatalogImportResult> {
  const response = await fetchImpl(HIBP_CATALOG_URL, {
    // O HIBP exige um User-Agent que identifique o cliente.
    headers: { "user-agent": "Olharium/0.1 (Hack Brasil 2026)", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`O catálogo do HIBP respondeu ${response.status}`);
  const list = z.array(z.unknown()).parse(await response.json());

  const breaches = list.map(toCatalogBreach).filter((item): item is CatalogBreach => item !== null);
  const existing = await db.breach.findMany({
    where: { externalId: { in: breaches.map((item) => item.externalId) } },
    select: { id: true, externalId: true, pwnCount: true, dataClasses: true, company: true, domain: true },
  });
  const byExternalId = new Map(existing.map((row) => [row.externalId, row]));

  const toCreate = breaches.filter((item) => !byExternalId.has(item.externalId));
  if (toCreate.length > 0) {
    await db.breach.createMany({
      data: toCreate.map((item) => ({ ...item, isSynthetic: false, source: "HIBP" as const })),
      skipDuplicates: true,
    });
  }

  let updated = 0;
  for (const item of breaches) {
    const row = byExternalId.get(item.externalId);
    if (!row) continue;
    const changed =
      row.pwnCount !== item.pwnCount ||
      row.company !== item.company ||
      row.domain !== item.domain ||
      row.dataClasses.join("|") !== item.dataClasses.join("|");
    if (!changed) continue;
    await db.breach.update({
      where: { id: row.id },
      data: {
        pwnCount: item.pwnCount,
        company: item.company,
        domain: item.domain,
        dataClasses: item.dataClasses,
        description: item.description,
      },
    });
    updated += 1;
  }

  // Um vazamento que o HIBP aposentou ou reclassificou sai da base (planos abertos ficam sem vínculo).
  const { count: removed } = await db.breach.deleteMany({
    where: { source: "HIBP", externalId: { notIn: breaches.map((item) => item.externalId) } },
  });

  return {
    received: list.length,
    created: toCreate.length,
    updated,
    skipped: list.length - breaches.length,
    removed,
  };
}
