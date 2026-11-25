/**
 * "Minhas contas": os serviços que a pessoa diz usar, cruzados com vazamentos reais pelo domínio.
 * Guardamos só nome e domínio do serviço: nunca login, e-mail da conta ou senha.
 */
import { HttpError } from "../../shared/auth.js";
import type { Db } from "../../shared/db.js";
import { normalizeDomain } from "../../shared/domain.js";
import { viewerOwner, viewerScope, type Viewer } from "../../shared/viewer.js";
import { HIBP_ATTRIBUTION } from "../breaches/hibp.js";
import { dataClassInfo, type DataClassInfo } from "../dashboard/data-classes.js";
import { POPULAR_SERVICES, knownService, searchKey } from "./services.js";

export const MAX_ACCOUNTS = 40;
const MAX_SUGGESTIONS = 12;

export interface ServiceSuggestion {
  name: string;
  domain: string;
  isFinancial: boolean;
  knownBreaches: number;
}

/** Sugestões para adicionar: lista curada + serviços do catálogo de vazamentos. */
export async function searchServices(db: Db, query: string): Promise<ServiceSuggestion[]> {
  const key = searchKey(query).slice(0, 60);
  const candidates = new Map<string, { name: string; domain: string; isFinancial: boolean }>();

  for (const service of POPULAR_SERVICES) {
    if (!key || searchKey(service.name).includes(key) || service.domain.includes(key)) {
      candidates.set(service.domain, { ...service });
    }
  }
  if (key.length >= 2) {
    const fromCatalog = await db.breach.findMany({
      where: {
        source: "HIBP",
        domain: { not: null },
        OR: [{ company: { contains: key, mode: "insensitive" } }, { domain: { contains: key } }],
      },
      select: { company: true, domain: true },
      orderBy: { pwnCount: "desc" },
      take: 30,
    });
    for (const breach of fromCatalog) {
      if (breach.domain && !candidates.has(breach.domain)) {
        candidates.set(breach.domain, { name: breach.company, domain: breach.domain, isFinancial: false });
      }
    }
  }

  const list = [...candidates.values()];
  const counts = await breachCounts(db, list.map((item) => item.domain));
  const ranked = list
    .map((item) => ({ ...item, knownBreaches: counts.get(item.domain) ?? 0 }))
    .sort((a, b) => {
      if (!key) return 0; // sem busca: mantém a ordem curada
      const aStarts = searchKey(a.name).startsWith(key) ? 1 : 0;
      const bStarts = searchKey(b.name).startsWith(key) ? 1 : 0;
      return bStarts - aStarts || b.knownBreaches - a.knownBreaches || a.name.localeCompare(b.name, "pt-BR");
    });
  return ranked.slice(0, MAX_SUGGESTIONS);
}

async function breachCounts(db: Db, domains: string[]): Promise<Map<string, number>> {
  if (domains.length === 0) return new Map();
  const rows = await db.breach.groupBy({
    by: ["domain"],
    where: { domain: { in: domains } },
    _count: { _all: true },
  });
  return new Map(rows.filter((row) => row.domain).map((row) => [row.domain as string, row._count._all]));
}

export interface AccountBreach {
  id: string;
  company: string;
  occurredAt: string;
  pwnCount: number | null;
  dataClasses: DataClassInfo[];
  sourceUrl: string | null;
  isSynthetic: boolean;
  /** Plano de resposta já aberto para este vazamento, se houver. */
  incidentId: string | null;
}

export interface AccountItem {
  id: string;
  name: string;
  domain: string;
  hasTwoFactor: boolean;
  isFinancial: boolean;
  createdAt: string;
  breaches: AccountBreach[];
}

export async function listAccounts(db: Db, viewer: Viewer) {
  const accounts = await db.trackedService.findMany({
    where: viewerScope(viewer),
    orderBy: { createdAt: "asc" },
  });
  const domains = [...new Set(accounts.map((account) => account.domain))];
  const breaches =
    domains.length > 0
      ? await db.breach.findMany({ where: { domain: { in: domains } }, orderBy: { occurredAt: "desc" } })
      : [];
  const plans =
    breaches.length > 0
      ? await db.incident.findMany({
          where: { ...viewerScope(viewer), breachId: { in: breaches.map((breach) => breach.id) } },
          select: { id: true, breachId: true },
        })
      : [];
  const planByBreach = new Map(plans.map((plan) => [plan.breachId, plan.id]));

  const items: AccountItem[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    domain: account.domain,
    hasTwoFactor: account.hasTwoFactor,
    isFinancial: account.isFinancial,
    createdAt: account.createdAt.toISOString(),
    breaches: breaches
      .filter((breach) => breach.domain === account.domain)
      .map((breach) => ({
        id: breach.id,
        company: breach.company,
        occurredAt: breach.occurredAt.toISOString(),
        pwnCount: breach.pwnCount,
        dataClasses: breach.dataClasses.map(dataClassInfo),
        sourceUrl: breach.sourceUrl,
        isSynthetic: breach.isSynthetic,
        incidentId: planByBreach.get(breach.id) ?? null,
      })),
  }));

  return {
    accounts: items,
    summary: {
      accounts: items.length,
      withBreaches: items.filter((item) => item.breaches.length > 0).length,
      breaches: items.reduce((sum, item) => sum + item.breaches.length, 0),
      financialWithoutTwoFactor: items.filter((item) => item.isFinancial && !item.hasTwoFactor).length,
    },
    attribution: HIBP_ATTRIBUTION,
  };
}

export interface NewAccount {
  domain: string;
  name?: string;
  isFinancial?: boolean;
  hasTwoFactor?: boolean;
}

export async function addAccount(db: Db, viewer: Viewer, input: NewAccount) {
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new HttpError(400, "Informe o endereço do serviço, por exemplo netshoes.com.br.");

  const existing = await db.trackedService.findFirst({ where: { ...viewerScope(viewer), domain }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };

  const total = await db.trackedService.count({ where: viewerScope(viewer) });
  if (total >= MAX_ACCOUNTS) throw new HttpError(400, `Você pode acompanhar até ${MAX_ACCOUNTS} serviços.`);

  const curated = knownService(domain);
  const fromCatalog = curated
    ? null
    : await db.breach.findFirst({ where: { domain }, orderBy: { pwnCount: "desc" }, select: { company: true } });
  const name = curated?.name ?? fromCatalog?.company ?? input.name?.trim().slice(0, 60) ?? domain;

  const account = await db.trackedService.create({
    data: {
      ...viewerOwner(viewer),
      domain,
      name: name || domain,
      isFinancial: input.isFinancial ?? curated?.isFinancial ?? false,
      hasTwoFactor: input.hasTwoFactor ?? false,
    },
    select: { id: true },
  });
  return { id: account.id, created: true };
}

async function findAccount(db: Db, viewer: Viewer, id: string) {
  const account = await db.trackedService.findFirst({ where: { id, ...viewerScope(viewer) }, select: { id: true } });
  if (!account) throw new HttpError(404, "Serviço não encontrado na sua lista");
  return account;
}

export async function updateAccount(
  db: Db,
  viewer: Viewer,
  id: string,
  patch: { hasTwoFactor?: boolean; isFinancial?: boolean },
) {
  const account = await findAccount(db, viewer, id);
  await db.trackedService.update({ where: { id: account.id }, data: patch });
}

export async function removeAccount(db: Db, viewer: Viewer, id: string) {
  const account = await findAccount(db, viewer, id);
  await db.trackedService.delete({ where: { id: account.id } });
}

/** Contas de exemplo de cada sessão demo: dois serviços com vazamento real e um banco sem vazamento. */
export const DEMO_ACCOUNTS: readonly NewAccount[] = [
  { domain: "netshoes.com.br" },
  { domain: "linkedin.com", hasTwoFactor: false },
  { domain: "nubank.com.br", hasTwoFactor: true },
];

export async function createDemoAccounts(db: Db, owner: { userId: string; sessionId: string }) {
  const viewer: Viewer = { userId: owner.userId, sessionId: owner.sessionId, isDemo: true, name: null };
  for (const account of DEMO_ACCOUNTS) await addAccount(db, viewer, account);
}
