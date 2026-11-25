/**
 * Para onde rolar ao chegar no plano depois de um formulário.
 *
 * O `redirect()` de uma server action mantém a rolagem da página anterior e descarta o `#lgpd` da URL,
 * então quem envia um formulário no meio da lista chegaria ao plano já rolado. O formulário marca o
 * destino aqui antes de enviar, e o `PlanArrival` da página do plano consome a marca uma vez.
 */
const KEY = "olharium:copiloto:chegada";
const MAX_AGE_MS = 60_000;

export type ArrivalTarget = "top" | "lgpd";

export function markArrival(target: ArrivalTarget): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ target, at: Date.now() }));
  } catch {
    // Sem sessionStorage (modo privado, bloqueio): a página só não rola sozinha.
  }
}

export function clearArrival(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // idem
  }
}

export function takeArrival(): ArrivalTarget | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const { target, at } = JSON.parse(raw) as { target?: unknown; at?: unknown };
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    return target === "lgpd" || target === "top" ? target : null;
  } catch {
    return null;
  }
}
