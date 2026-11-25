/**
 * Normaliza um domínio digitado ou vindo de uma fonte externa: minúsculas, sem protocolo, sem "www.",
 * sem caminho e sem ponto final. Devolve null se o resultado não parecer um domínio.
 */
const DOMAIN_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  return DOMAIN_RE.test(domain) ? domain : null;
}
