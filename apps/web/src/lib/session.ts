import { cookies } from "next/headers";

/**
 * Cookie httpOnly com o token de sessão. O navegador nunca lê o token: o servidor do Next
 * o repassa para a API no header Authorization.
 */
export const SESSION_COOKIE = "r360_session";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
