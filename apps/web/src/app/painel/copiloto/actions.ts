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

async function callApi(token: string, path: string, method: string, body: unknown, timeoutMs = 5000) {
  return apiFetch(path, {
    method,
    token,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs,
  });
}

export interface ReportState {
  error: string;
  needsType?: boolean;
  /** Devolve o texto para o usuário não perder o relato. */
  text: string;
}

/** Relato livre: a API remove dados pessoais, classifica e devolve o id do incidente. */
export async function reportIncident(_previous: ReportState | null, formData: FormData): Promise<ReportState> {
  const token = await requireToken();
  const text = String(formData.get("text") ?? "");
  const rawType = String(formData.get("type") ?? "");
  const payload = rawType ? { text, type: rawType } : { text };

  let response: Response;
  try {
    // O LLM pode levar alguns segundos; a API corta em 10 s e cai nas regras.
    response = await callApi(token, "/me/incidents/report", "POST", payload, 15_000);
  } catch {
    return { error: "Não conseguimos falar com o servidor agora. Tente de novo em instantes.", text };
  }

  if (response.status === 401) redirect("/?sessao=expirada");
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
    needsType?: boolean;
    issues?: Array<{ message?: string }>;
  };
  if (response.status === 201 && body.id) redirect(`/painel/copiloto/${body.id}`);

  if (response.status === 400) {
    return { error: body.issues?.[0]?.message ?? "Revise o relato e tente de novo.", text };
  }
  if (response.status === 422) {
    return { error: body.error ?? "Escolha a opção mais próxima do que aconteceu.", needsType: true, text };
  }
  if (response.status === 429) {
    return { error: body.error ?? "Muitos relatos em pouco tempo. Espere um minuto e tente de novo.", text };
  }
  return { error: "Algo deu errado do nosso lado. Tente de novo em instantes.", text };
}

/** "Plano de resposta" de um vazamento detectado: abre o incidente (ou o existente) e navega até ele. */
export async function openBreachPlan(breachId: string) {
  const token = await requireToken();
  let status = 0;
  let id: string | null = null;
  try {
    const response = await callApi(token, "/me/incidents/from-breach", "POST", { breachId });
    status = response.status;
    if (response.ok) id = ((await response.json()) as { id: string }).id;
  } catch {
    id = null;
  }
  if (status === 401) redirect("/?sessao=expirada");
  redirect(id ? `/painel/copiloto/${id}` : "/painel/copiloto?erro=plano");
}

/** Escritas pequenas (marcar passo, registrar envio): se a API falhar, a tela só não muda. */
async function write(incidentId: string, path: string, method: string, body: unknown) {
  const token = await requireToken();
  let status = 0;
  try {
    status = (await callApi(token, `/me/incidents/${encodeURIComponent(incidentId)}${path}`, method, body)).status;
  } catch {
    status = 0;
  }
  if (status === 401) redirect("/?sessao=expirada");
  revalidatePath(`/painel/copiloto/${incidentId}`);
}

export async function toggleStep(incidentId: string, stepId: string, done: boolean) {
  await write(incidentId, "/steps", "PATCH", { stepId, done });
}

export async function recordLgpd(incidentId: string, event: "sent" | "answered" | "reset") {
  await write(incidentId, "/lgpd", "POST", { event });
}
