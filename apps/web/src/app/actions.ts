"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

/** "Entrar como demo": a API abre uma sessão curta na persona fictícia. */
export async function enterDemo() {
  let session: { token: string; expiresAt: string } | null = null;
  try {
    const response = await fetch(`${API_URL}/auth/demo`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
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
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // A sessão expira sozinha em 2 horas; o cookie é apagado de qualquer forma.
    }
  }
  store.delete(SESSION_COOKIE);
  redirect("/");
}
