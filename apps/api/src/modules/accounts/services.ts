/**
 * Serviços populares no Brasil, para sugerir em "Minhas contas" mesmo quando não há vazamento
 * conhecido (bancos, governo, lojas). O cruzamento com vazamentos é sempre pelo domínio.
 * Lista curada à mão: nome e domínio oficiais, e se o serviço mexe com dinheiro.
 */
export interface KnownService {
  name: string;
  domain: string;
  isFinancial: boolean;
}

export const POPULAR_SERVICES: readonly KnownService[] = [
  { name: "gov.br", domain: "gov.br", isFinancial: false },
  { name: "WhatsApp", domain: "whatsapp.com", isFinancial: false },
  { name: "Instagram", domain: "instagram.com", isFinancial: false },
  { name: "Facebook", domain: "facebook.com", isFinancial: false },
  { name: "Google", domain: "google.com", isFinancial: false },
  { name: "Microsoft", domain: "microsoft.com", isFinancial: false },
  { name: "Apple", domain: "apple.com", isFinancial: false },
  { name: "LinkedIn", domain: "linkedin.com", isFinancial: false },
  { name: "X (Twitter)", domain: "twitter.com", isFinancial: false },
  { name: "TikTok", domain: "tiktok.com", isFinancial: false },
  { name: "Nubank", domain: "nubank.com.br", isFinancial: true },
  { name: "Itaú", domain: "itau.com.br", isFinancial: true },
  { name: "Bradesco", domain: "bradesco.com.br", isFinancial: true },
  { name: "Banco do Brasil", domain: "bb.com.br", isFinancial: true },
  { name: "Caixa", domain: "caixa.gov.br", isFinancial: true },
  { name: "Santander", domain: "santander.com.br", isFinancial: true },
  { name: "Inter", domain: "inter.co", isFinancial: true },
  { name: "C6 Bank", domain: "c6bank.com.br", isFinancial: true },
  { name: "PicPay", domain: "picpay.com", isFinancial: true },
  { name: "Mercado Pago", domain: "mercadopago.com.br", isFinancial: true },
  { name: "Mercado Livre", domain: "mercadolivre.com.br", isFinancial: false },
  { name: "Amazon", domain: "amazon.com.br", isFinancial: false },
  { name: "Magalu", domain: "magazineluiza.com.br", isFinancial: false },
  { name: "Shopee", domain: "shopee.com.br", isFinancial: false },
  { name: "SHEIN", domain: "shein.com", isFinancial: false },
  { name: "iFood", domain: "ifood.com.br", isFinancial: false },
  { name: "Uber", domain: "uber.com", isFinancial: false },
  { name: "Netflix", domain: "netflix.com", isFinancial: false },
  { name: "Spotify", domain: "spotify.com", isFinancial: false },
  { name: "Deezer", domain: "deezer.com", isFinancial: false },
  { name: "Canva", domain: "canva.com", isFinancial: false },
  { name: "Duolingo", domain: "duolingo.com", isFinancial: false },
  { name: "Dropbox", domain: "dropbox.com", isFinancial: false },
  { name: "Trello", domain: "trello.com", isFinancial: false },
];

const BY_DOMAIN = new Map(POPULAR_SERVICES.map((service) => [service.domain, service]));

export function knownService(domain: string): KnownService | undefined {
  return BY_DOMAIN.get(domain);
}

/** Minúsculas e sem acento, para buscar "itau" e achar "Itaú". */
export function searchKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
