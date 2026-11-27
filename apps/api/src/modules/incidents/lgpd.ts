/**
 * Notificação LGPD ao encarregado e petição à ANPD.
 *
 * Os textos são modelos fixos, com artigos da tabela curada: o LLM não escreve nada aqui.
 * Campos que o Olharium não guarda em texto claro (CPF, e-mail) ficam entre colchetes para o
 * próprio titular preencher antes de enviar.
 */
import {
  LGPD_ARTICLES,
  LGPD_RESPONSE_DAYS,
  OFFICIAL_LINKS,
  type LgpdArticleId,
} from "./catalog.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LgpdStatus = "not_sent" | "waiting" | "overdue" | "answered";

export interface LgpdTimeline {
  status: LgpdStatus;
  sentAt: string | null;
  answeredAt: string | null;
  /** Fim do prazo do art. 19, II (sentAt + 15 dias). */
  deadline: string | null;
  /** Dias inteiros até o fim do prazo (0 no último dia), só enquanto aguarda. */
  daysLeft: number | null;
}

export function lgpdTimeline(sentAt: Date | null, answeredAt: Date | null, now: Date): LgpdTimeline {
  if (!sentAt) {
    return { status: "not_sent", sentAt: null, answeredAt: null, deadline: null, daysLeft: null };
  }
  const deadline = new Date(sentAt.getTime() + LGPD_RESPONSE_DAYS * DAY_MS);
  const base = { sentAt: sentAt.toISOString(), deadline: deadline.toISOString() };
  if (answeredAt) {
    return { ...base, status: "answered", answeredAt: answeredAt.toISOString(), daysLeft: null };
  }
  if (now.getTime() >= deadline.getTime()) {
    return { ...base, status: "overdue", answeredAt: null, daysLeft: null };
  }
  const daysLeft = Math.floor((deadline.getTime() - now.getTime()) / DAY_MS);
  return { ...base, status: "waiting", answeredAt: null, daysLeft };
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** Datas sem hora (ocorrência do vazamento) ficam à meia-noite UTC. */
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function articles(ids: LgpdArticleId[]) {
  return ids.map((id) => ({ ...LGPD_ARTICLES[id] }));
}

export interface NoticeInput {
  holderName: string;
  company: string;
  /** Null quando a empresa não informou a data. */
  occurredAt: Date | null;
  dataClassLabels: string[];
  now: Date;
}

export interface LgpdNotice {
  subject: string;
  body: string;
  articles: Array<{ ref: string; text: string }>;
}

export function buildLgpdNotice({ holderName, company, occurredAt, dataClassLabels, now }: NoticeInput): LgpdNotice {
  // "E-mail" vira "e-mail", mas siglas como "CPF" e "RG" ficam como estão.
  const categories = dataClassLabels
    .map((label) => (label === label.toUpperCase() ? label : label.charAt(0).toLowerCase() + label.slice(1)))
    .join(", ");
  const when = occurredAt ? `, ocorrido em ${monthFormat.format(occurredAt)}` : "";
  const what = categories ? `, que expôs dados como: ${categories}` : ", que pode ter exposto meus dados pessoais";
  const body = [
    `Ao(À) Encarregado(a) pelo Tratamento de Dados Pessoais da ${company},`,
    "",
    `Eu, ${holderName}, titular de dados pessoais, tomei conhecimento de um incidente de segurança na ${company}${when}${what}.`,
    "",
    "Com base na Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), solicito:",
    "",
    "1. a confirmação de que meus dados pessoais foram afetados e de quais categorias foram expostas (art. 18, I e II);",
    "2. a descrição do incidente, dos riscos envolvidos e das medidas adotadas para reverter ou reduzir seus efeitos, e se o incidente foi comunicado à ANPD e aos titulares (art. 48 e Resolução CD/ANPD nº 15/2024);",
    "3. a informação das entidades públicas e privadas com as quais meus dados foram compartilhados (art. 18, VII);",
    "4. a indicação de outras medidas que eu deva tomar para me proteger.",
    "",
    "Peço que a resposta seja dada por declaração clara e completa, no prazo de até 15 (quinze) dias contados desta solicitação (art. 19, II).",
    "",
    "Para me identificar:",
    `Nome: ${holderName}`,
    "E-mail cadastrado na empresa: [preencha]",
    "CPF: [preencha só se a empresa precisar para localizar seus dados]",
    "",
    `${dateFormat.format(now)}.`,
    "",
    holderName,
  ].join("\n");

  return {
    subject: `Solicitação de informações sobre incidente de segurança (LGPD, arts. 18, 19 e 48) – ${company}`,
    body,
    articles: articles(["art18_1_2", "art18_7", "art19_2", "art48", "art41_p1"]),
  };
}

export interface PetitionInput {
  holderName: string;
  company: string;
  sentAt: Date;
  deadline: Date;
}

export interface AnpdPetition {
  text: string;
  articles: Array<{ ref: string; text: string }>;
  links: Array<{ label: string; url: string }>;
  checklist: string[];
}

export function buildAnpdPetition({ holderName, company, sentAt, deadline }: PetitionInput): AnpdPetition {
  const text = [
    "Petição de titular de dados pessoais (LGPD, art. 18, § 1º, e art. 55-J, V)",
    "",
    `Controlador: ${company}`,
    `Titular: ${holderName}`,
    "",
    `Em ${dateFormat.format(sentAt)}, enviei ao encarregado da ${company} um requerimento de confirmação e acesso aos meus dados pessoais afetados por um incidente de segurança, com base nos arts. 18 e 19 da LGPD. O prazo de 15 dias previsto no art. 19, II, terminou em ${dateFormat.format(deadline)} sem resposta.`,
    "",
    "Peço que a ANPD aprecie esta petição e adote as providências cabíveis para que o controlador:",
    "",
    "1. responda ao requerimento;",
    "2. informe a natureza do incidente, os dados afetados, os riscos e as medidas adotadas (art. 48).",
    "",
    "Anexo: comprovante do requerimento enviado ao controlador.",
  ].join("\n");

  return {
    text,
    articles: articles(["art18_p1", "art55j_5", "art19_2"]),
    links: [{ ...OFFICIAL_LINKS.anpd_peticao }, { ...OFFICIAL_LINKS.anpd_fluxo }],
    checklist: [
      "Entre no serviço da ANPD com a sua conta gov.br (nível prata ou ouro).",
      "Escolha \"Petição de titular\" e cole o texto acima.",
      "Anexe o comprovante do envio à empresa (o e-mail enviado ou o protocolo). Sem comprovante, a ANPD aceita a sua autodeclaração (Resolução CD/ANPD nº 1/2021, art. 25, § 1º).",
      "Os 15 dias são o prazo da empresa na LGPD (art. 19, II). A ANPD pode pedir uma espera maior antes de aceitar a petição: se o serviço recusar agora, aguarde e use este mesmo texto.",
      "A ANPD analisa as petições em conjunto, para orientar a fiscalização. Ela não garante uma resposta individual ao seu caso.",
    ],
  };
}
