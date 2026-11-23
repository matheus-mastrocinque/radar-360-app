/**
 * Remove identificadores do relato antes de gravar ou de enviar ao LLM.
 * O usuário pode colar CPF, cartão ou telefone sem perceber; nada disso precisa sair daqui.
 */
const PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]"],
  // Cartão: 13 a 19 dígitos, com ou sem espaços e hífens.
  [/\b(?:\d[ -]?){12,18}\d\b/g, "[cartão]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]"],
  [/\b\d{11}\b/g, "[CPF ou telefone]"],
  // Telefone com DDD: (11) 91234-5678, 11 91234 5678, +55 11 912345678.
  [/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]"],
  // Chaves aleatórias do Pix (UUID).
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[chave Pix]"],
  // Qualquer outra sequência longa de dígitos (conta, agência com dígito, protocolo).
  [/\b\d{6,}\b/g, "[número]"],
];

export function redactPersonalData(text: string): string {
  return PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}
