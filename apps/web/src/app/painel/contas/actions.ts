"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { getSessionToken } from "@/lib/session";

async function requireToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) redirect("/?sessao=expirada");
  return token;
}

async function send(path: string, method: string, body?: unknown): Promise<{ status: number; error?: string }> {
  const token = await requireToken();
  let status = 0;
  let error: string | undefined;
  try {
    const response = await apiFetch(path, {
      method,
      token,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = response.status;
    if (!response.ok && response.status !== 401) {
      const data = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ message?: string }> };
      error = data.issues?.[0]?.message ?? data.error;
    }
  } catch {
    status = 0;
  }
  if (status === 401) redirect("/?sessao=expirada");
  return { status, error };
}

/** Botão "Adicionar" de uma sugestão. */
export async function addSuggestedAccount(domain: string) {
  await send("/me/accounts", "POST", { domain });
  revalidatePath("/painel/contas");
  redirect("/painel/contas");
}

export interface AddAccountState {
  error: string;
  domain: string;
}

/** Endereço digitado pela pessoa ("minhaloja.com.br"). */
export async function addTypedAccount(_previous: AddAccountState | null, formData: FormData): Promise<AddAccountState> {
  const domain = String(formData.get("domain") ?? "").trim();
  if (!domain) return { error: "Digite o endereço do serviço, por exemplo minhaloja.com.br.", domain };
  const result = await send("/me/accounts", "POST", { domain });
  if (result.status === 200 || result.status === 201) {
    revalidatePath("/painel/contas");
    redirect("/painel/contas");
  }
  if (result.status === 400) {
    return { error: result.error ?? "Confira o endereço, por exemplo minhaloja.com.br.", domain };
  }
  return { error: "Não conseguimos adicionar agora. Tente de novo em instantes.", domain };
}

export async function setAccountFlag(id: string, field: "hasTwoFactor" | "isFinancial", value: boolean) {
  await send(`/me/accounts/${encodeURIComponent(id)}`, "PATCH", { [field]: value });
  revalidatePath("/painel/contas");
}

export async function removeAccount(id: string) {
  await send(`/me/accounts/${encodeURIComponent(id)}`, "DELETE");
  revalidatePath("/painel/contas");
}
