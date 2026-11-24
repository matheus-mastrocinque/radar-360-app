import type { ReportableType } from "./incidents";

/**
 * Opções do formulário de relato. Mesmo texto curto da API, para escolher sem esperar o LLM.
 * Fica fora de `incidents.ts` porque o formulário roda no navegador e aquele módulo só roda no servidor.
 */
export const REPORT_OPTIONS: Array<{ type: ReportableType; label: string; example: string }> = [
  { type: "PIX_SCAM", label: "Golpe do Pix", example: "Fiz um Pix para um falso vendedor" },
  { type: "STOLEN_PHONE", label: "Celular roubado", example: "Levaram meu celular na rua" },
  { type: "ACCOUNT_TAKEOVER", label: "Conta invadida ou WhatsApp clonado", example: "Clonaram meu WhatsApp" },
  { type: "PHISHING", label: "Link ou site falso", example: "Digitei a senha num site falso" },
  { type: "IDENTITY_FRAUD", label: "Conta ou dívida em meu nome", example: "Abriram um empréstimo no meu CPF" },
];
