"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { SESSION_COOKIE } from "@/lib/session";

/** "Entrar como demo": a API abre uma sessão curta na persona fictícia. */
export async function enterDemo() {
  let session: { token: string; expiresAt: string } | null = null;
  try {
    // Primeiro acesso do dia pode acordar a API e o banco: dá mais tempo que nas outras chamadas.
    const response = await apiFetch("/auth/demo", { method: "POST", timeoutMs: 10_000 });
    if (response.ok) session = (await response.json()) as { token: string; expiresAt: string };
  } catch {
    session = null;
  }
  if (!session) redirect("/?erro=demo");

  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  redirect("/painel");
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await apiFetch("/auth/logout", { method: "POST", token, timeoutMs: 3000 });
    } catch {
      // A sessão expira sozinha em 2 horas; o cookie é apagado de qualquer forma.
    }
  }
  store.delete(SESSION_COOKIE);
  redirect("/");
}
