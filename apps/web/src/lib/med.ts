/**
 * Pedido de devolução de Pix por fraude (MED, Mecanismo Especial de Devolução do Banco Central).
 *
 * Modelo fixo, revisado à mão: nada aqui vem de IA. O que a pessoa preenche fica só no navegador
 * (não é enviado à API nem salvo), por isso a chave Pix e o valor podem aparecer no texto.
 *
 * Fatos usados (conferidos em 27/11/2026): o MED vale para Pix feito com fundada suspeita de fraude
 * (golpe, roubo do aparelho); o pedido é feito ao banco de quem pagou, em até 80 dias da
 * transferência; a devolução depende de haver saldo na conta de quem recebeu, então não é garantida.
 */
export interface MedFields {
  amount: string;
  when: string;
  receiver: string;
  transactionId: string;
  policeReport: string;
  summary: string;
}

export const EMPTY_MED_FIELDS: MedFields = {
  amount: "",
  when: "",
  receiver: "",
  transactionId: "",
  policeReport: "",
  summary: "",
};

/** Prazo do pedido, contado da transferência. */
export const MED_REQUEST_DAYS = 80;

function value(text: string, placeholder: string): string {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : placeholder;
}

function money(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "R$ [valor]";
  return /^r\$/i.test(trimmed) ? trimmed : `R$ ${trimmed}`;
}

export function buildMedRequest(fields: MedFields): string {
  return [
    "Assunto: Pedido de devolução de Pix por fraude (MED)",
    "",
    "Olá. Fui vítima de um golpe e peço a abertura do Mecanismo Especial de Devolução (MED) para o Pix abaixo, com o bloqueio cautelar dos valores na instituição de quem recebeu.",
    "",
    `- Valor: ${money(fields.amount)}`,
    `- Data e hora: ${value(fields.when, "[data e hora do Pix]")}`,
    `- Quem recebeu (nome ou chave Pix): ${value(fields.receiver, "[nome ou chave de quem recebeu]")}`,
    `- Identificador da transação: ${value(fields.transactionId, "[código do comprovante, começa com E]")}`,
    `- Boletim de ocorrência: ${value(fields.policeReport, "[número do BO, se já tiver]")}`,
    "",
    `O que aconteceu: ${value(fields.summary, "[conte em uma ou duas frases como foi o golpe]")}`,
    "",
    "Peço o número de protocolo deste pedido e a informação do prazo de análise.",
  ].join("\n");
}
