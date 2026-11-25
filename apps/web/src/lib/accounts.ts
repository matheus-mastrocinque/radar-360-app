import { apiFetch } from "./api-fetch";
import type { DataClass } from "./dashboard";
import type { ApiResult, Attribution } from "./incidents";

/** Espelho de GET /me/accounts (apps/api/src/modules/accounts/service.ts). */
export interface AccountBreach {
  id: string;
  company: string;
  occurredAt: string;
  pwnCount: number | null;
  dataClasses: DataClass[];
  sourceUrl: string | null;
  isSynthetic: boolean;
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

export interface AccountList {
  accounts: AccountItem[];
  summary: { accounts: number; withBreaches: number; breaches: number; financialWithoutTwoFactor: number };
  attribution: Attribution;
}

export interface ServiceSuggestion {
  name: string;
  domain: string;
  isFinancial: boolean;
  knownBreaches: number;
}

async function getJson<T>(token: string, path: string): Promise<ApiResult<T>> {
  try {
    const response = await apiFetch(path, { token });
    if (response.status === 401) return { ok: false, reason: "unauthorized" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function fetchAccounts(token: string) {
  return getJson<AccountList>(token, "/me/accounts");
}

export function fetchServiceSuggestions(token: string, query: string) {
  return getJson<{ services: ServiceSuggestion[] }>(token, `/services?q=${encodeURIComponent(query.slice(0, 80))}`);
}
