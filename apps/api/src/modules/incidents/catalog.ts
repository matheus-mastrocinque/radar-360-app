/**
 * Tabelas curadas do copiloto de resposta a incidentes.
 *
 * Regra do projeto: o LLM não inventa dados críticos. Tipos de incidente, passos dos planos,
 * links oficiais e artigos da LGPD vêm daqui, revisados à mão. O LLM só escolhe entre estas opções.
 *
 * Links conferidos em 23/11/2026. Telefones não entram: cada banco e operadora tem o seu, e o
 * plano orienta a usar o número oficial impresso no cartão ou mostrado no app.
 */
import type { IncidentType } from "../../generated/prisma/enums.js";

/* ------------------------------------------------------------------ tipos */

export const REPORTABLE_TYPES = [
  "PIX_SCAM",
  "PHISHING",
  "ACCOUNT_TAKEOVER",
  "STOLEN_PHONE",
  "IDENTITY_FRAUD",
] as const satisfies readonly IncidentType[];

export type ReportableType = (typeof REPORTABLE_TYPES)[number];

export const INCIDENT_TYPES: Record<IncidentType, { label: string; description: string }> = {
  DATA_BREACH: {
    label: "Vazamento de dados",
    description: "Seus dados apareceram num vazamento detectado pelo monitoramento.",
  },
  PIX_SCAM: {
    label: "Golpe do Pix",
    description: "Você fez um Pix ou pagamento para um golpista.",
  },
  PHISHING: {
    label: "Link ou site falso",
    description: "Você clicou num link falso ou digitou dados numa página que imitava outra.",
  },
  ACCOUNT_TAKEOVER: {
    label: "Conta invadida ou WhatsApp clonado",
    description: "Alguém entrou numa conta sua ou está usando o seu WhatsApp.",
  },
  STOLEN_PHONE: {
    label: "Celular roubado ou furtado",
    description: "Levaram o seu celular, com seus apps e contas.",
  },
  IDENTITY_FRAUD: {
    label: "Conta ou dívida em seu nome",
    description: "Abriram conta, cartão, linha ou empréstimo usando os seus dados.",
  },
};

/* ------------------------------------------------------------------ sinais do relato */

/** Sinais que o relato pode trazer. Cada um ativa passos extras no plano. */
export const INCIDENT_FLAGS = [
  "MONEY_SENT",
  "PASSWORD_SHARED",
  "CODE_SHARED",
  "CARD_SHARED",
  "REMOTE_APP",
] as const;

export type IncidentFlag = (typeof INCIDENT_FLAGS)[number];

export const FLAG_LABELS: Record<IncidentFlag, string> = {
  MONEY_SENT: "Enviou dinheiro",
  PASSWORD_SHARED: "Informou uma senha",
  CODE_SHARED: "Passou um código de verificação",
  CARD_SHARED: "Informou dados do cartão",
  REMOTE_APP: "Instalou um app ou deu acesso remoto",
};

export function isIncidentFlag(value: string): value is IncidentFlag {
  return (INCIDENT_FLAGS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ links oficiais */

export const OFFICIAL_LINKS = {
  registrato: {
    label: "Registrato (Banco Central)",
    url: "https://www.bcb.gov.br/cidadaniafinanceira/registrato",
  },
  celular_seguro: {
    label: "Celular Seguro (Ministério da Justiça)",
    url: "https://celularseguro.mj.gov.br",
  },
  consumidor_gov: {
    label: "consumidor.gov.br",
    url: "https://www.consumidor.gov.br",
  },
  bcb_reclamacao: {
    label: "Reclamação no Banco Central",
    url: "https://www.bcb.gov.br/meubc/registrar_reclamacao",
  },
  google_find: {
    label: "Encontre Meu Dispositivo (Google)",
    url: "https://www.google.com/android/find",
  },
  apple_find: {
    label: "Buscar (Apple)",
    url: "https://www.icloud.com/find",
  },
  phishing_report: {
    label: "Denunciar site falso (Google Safe Browsing)",
    url: "https://safebrowsing.google.com/safebrowsing/report_phish/",
  },
  anpd_peticao: {
    label: "Requerimento à ANPD (gov.br)",
    url: "https://www.gov.br/pt-br/servicos/abrir-requerimento-relacionado-a-lgpd",
  },
  anpd_fluxo: {
    label: "Como funciona a petição do titular (ANPD)",
    url: "https://www.gov.br/anpd/pt-br/fluxo-da-peticao-do-titular",
  },
} as const satisfies Record<string, { label: string; url: string }>;

export type LinkId = keyof typeof OFFICIAL_LINKS;

/* ------------------------------------------------------------------ LGPD */

/** Artigos citados nas notificações. Texto resumido, conferido com a Lei nº 13.709/2018. */
export const LGPD_ARTICLES = {
  art18_1_2: {
    ref: "Art. 18, I e II",
    text: "Direito de confirmar se a empresa trata seus dados e de acessá-los.",
  },
  art18_7: {
    ref: "Art. 18, VII",
    text: "Direito de saber com quais entidades públicas e privadas seus dados foram compartilhados.",
  },
  art18_p1: {
    ref: "Art. 18, § 1º",
    text: "Direito de peticionar contra a empresa perante a ANPD.",
  },
  art19_2: {
    ref: "Art. 19, II",
    text: "A resposta completa deve sair em até 15 dias, contados do pedido.",
  },
  art41_p1: {
    ref: "Art. 41, § 1º",
    text: "A empresa deve divulgar publicamente quem é o encarregado e como contatá-lo.",
  },
  art48: {
    ref: "Art. 48",
    text: "A empresa deve comunicar à ANPD e ao titular o incidente que possa causar risco ou dano relevante.",
  },
  art55j_5: {
    ref: "Art. 55-J, V",
    text: "A ANPD aprecia petições do titular contra a empresa quando o pedido feito a ela não foi resolvido.",
  },
} as const satisfies Record<string, { ref: string; text: string }>;

export type LgpdArticleId = keyof typeof LGPD_ARTICLES;

/** Prazo do art. 19, II, em dias corridos. */
export const LGPD_RESPONSE_DAYS = 15;

export const LEGAL_DISCLAIMER =
  "Orientações informativas, baseadas em fontes oficiais. Não é assessoria jurídica.";

/* ------------------------------------------------------------------ planos */

export const PHASES = [
  { key: "now", label: "Agora", window: "em até 15 min" },
  { key: "hour", label: "Na primeira hora", window: "em até 1 h" },
  { key: "day", label: "Nas próximas 24 horas", window: "em até 24 h" },
] as const;

export type PhaseKey = (typeof PHASES)[number]["key"];

export interface StepDef {
  id: string;
  phase: PhaseKey;
  title: string;
  detail: string;
  links?: LinkId[];
  /** Mostra o passo só se o relato tiver algum destes sinais. */
  whenFlags?: IncidentFlag[];
  /** Mostra o passo só se o vazamento tiver alguma destas categorias (DATA_BREACH). */
  whenClasses?: string[];
  /** Passo que leva à seção da notificação LGPD. */
  lgpd?: boolean;
}

const REMOTE_APP_STEP: StepDef = {
  id: "remote_app_remove",
  phase: "now",
  title: "Desligue a internet do celular e desinstale o app que você instalou",
  detail:
    "Apps de acesso remoto, como os de \"suporte\", deixam o golpista ver e controlar a sua tela. Depois de remover, troque as senhas usando outro aparelho.",
  whenFlags: ["REMOTE_APP"],
};

const CARD_BLOCK_STEP: StepDef = {
  id: "card_block",
  phase: "now",
  title: "Bloqueie o cartão pelo app do banco",
  detail: "Peça um cartão com outro número e confira as últimas compras na fatura.",
  whenFlags: ["CARD_SHARED"],
};

const REGISTRATO_STEP: StepDef = {
  id: "registrato",
  phase: "day",
  title: "Consulte o Registrato do Banco Central",
  detail:
    "É gratuito, com a conta gov.br, e mostra contas, chaves Pix e empréstimos no seu CPF. Algo que você não reconhece pode ser fraude.",
  links: ["registrato"],
};

/** Vazamento detectado: os passos dependem das categorias expostas. */
const DATA_BREACH_STEPS: StepDef[] = [
  {
    id: "breach_password",
    phase: "now",
    title: "Troque a senha dessa conta e onde você repete a mesma",
    detail: "Comece pelo e-mail e pelos bancos. Use uma senha diferente em cada serviço; um gerenciador de senhas ajuda.",
    whenClasses: ["senha", "senha_hash"],
  },
  {
    id: "breach_2fa",
    phase: "now",
    title: "Ative a verificação em duas etapas no e-mail e nos bancos",
    detail: "Mesmo com a senha em mãos, o golpista vai precisar de um código que só chega para você.",
    whenClasses: ["senha", "senha_hash", "email"],
  },
  {
    id: "breach_card",
    phase: "now",
    title: "Bloqueie o cartão e peça outro número",
    detail: "Pelo app do banco. Depois, confira as compras recentes na fatura.",
    whenClasses: ["cartao"],
  },
  {
    id: "breach_phishing_alert",
    phase: "now",
    title: "Desconfie de contatos que citem seus dados",
    detail:
      "Golpistas usam dados vazados para parecer legítimos. Empresas sérias não pedem senha nem código por mensagem: na dúvida, desligue e ligue você para o número oficial.",
    whenClasses: ["nome", "email", "telefone", "cpf", "dados_bancarios"],
  },
  {
    id: "breach_sim_pin",
    phase: "hour",
    title: "Proteja o seu chip",
    detail:
      "Ative o PIN do chip nas configurações do celular e peça à operadora uma senha para troca de chip e portabilidade. Isso dificulta que clonem o seu número.",
    whenClasses: ["telefone"],
  },
  {
    id: "breach_health_scam",
    phase: "hour",
    title: "Cuidado com o golpe do falso convênio",
    detail: "Confirme qualquer cobrança, reembolso ou pedido de exame ligando para o número oficial do seu plano de saúde.",
    whenClasses: ["dados_saude", "convenio"],
  },
  {
    id: "breach_bank_alerts",
    phase: "hour",
    title: "Ative os alertas de transação do banco",
    detail: "Assim você vê na hora qualquer compra ou Pix que não fez.",
    whenClasses: ["cartao", "dados_bancarios"],
  },
  {
    id: "breach_lgpd_notice",
    phase: "hour",
    title: "Envie a notificação LGPD ao encarregado da empresa",
    detail:
      "Ela pede a confirmação dos seus dados afetados, as medidas tomadas e com quem os dados foram compartilhados. A empresa tem até 15 dias para responder (LGPD, art. 19, II).",
    lgpd: true,
  },
  {
    ...REGISTRATO_STEP,
    id: "breach_registrato",
    whenClasses: ["cpf", "rg", "data_nascimento", "dados_bancarios"],
  },
  {
    id: "breach_statements",
    phase: "day",
    title: "Confira extratos e faturas dos últimos 30 dias",
    detail: "Procure compras pequenas que você não reconhece: golpistas costumam testar o cartão antes.",
    whenClasses: ["cartao", "dados_bancarios", "cpf"],
  },
  {
    id: "breach_follow_answer",
    phase: "day",
    title: "Acompanhe a resposta da empresa",
    detail: "Marque aqui quando enviar a notificação. Se passar de 15 dias sem resposta, o Radar360 prepara a petição à ANPD.",
    lgpd: true,
  },
];

const PLAYBOOKS: Record<ReportableType, StepDef[]> = {
  PIX_SCAM: [
    {
      id: "pix_med",
      phase: "now",
      title: "Peça a devolução pelo app do banco (MED)",
      detail:
        "No comprovante do Pix, use a opção de contestação. Quanto antes, maior a chance de o dinheiro ainda estar na conta do golpista. O pedido pode ser feito em até 80 dias após a transferência. Se não achar a opção, ligue para o número oficial no verso do cartão.",
    },
    {
      id: "pix_stop_paying",
      phase: "now",
      title: "Não faça nenhum outro pagamento",
      detail: "Golpistas pedem uma \"taxa\" para devolver ou desbloquear o dinheiro. Nenhuma devolução de verdade exige um novo Pix.",
    },
    {
      id: "pix_lock_account",
      phase: "now",
      title: "Peça ao banco o bloqueio do acesso à conta",
      detail: "Você informou senha, código ou deu acesso ao aparelho. Ligue para o banco e troque a senha do app usando outro aparelho.",
      whenFlags: ["PASSWORD_SHARED", "CODE_SHARED", "REMOTE_APP"],
    },
    REMOTE_APP_STEP,
    CARD_BLOCK_STEP,
    {
      id: "pix_evidence",
      phase: "now",
      title: "Guarde as provas",
      detail: "Comprovante do Pix, chave e nome de quem recebeu, prints da conversa e o número ou perfil usado no golpe.",
    },
    {
      id: "pix_police_report",
      phase: "hour",
      title: "Registre um boletim de ocorrência",
      detail: "Pela delegacia online do seu estado, com as provas anexadas. O banco pode pedir o número do BO.",
    },
    {
      id: "pix_report_profile",
      phase: "hour",
      title: "Denuncie o perfil ou o número usado no golpe",
      detail: "Na própria plataforma (WhatsApp, Instagram, site de anúncios), para evitar novas vítimas.",
    },
    {
      id: "pix_follow_med",
      phase: "day",
      title: "Acompanhe o pedido de devolução",
      detail:
        "Guarde o protocolo. Se o banco não responder ou negar sem explicação, registre reclamação no Banco Central e no consumidor.gov.br.",
      links: ["bcb_reclamacao", "consumidor_gov"],
    },
    REGISTRATO_STEP,
  ],
  PHISHING: [
    {
      id: "phish_password",
      phase: "now",
      title: "Troque a senha da conta que o site imitava",
      detail:
        "Faça isso pelo app ou site oficial, nunca pelo link recebido. Se você usa a mesma senha em outros serviços, troque lá também.",
    },
    CARD_BLOCK_STEP,
    REMOTE_APP_STEP,
    {
      id: "phish_2fa",
      phase: "now",
      title: "Ative a verificação em duas etapas",
      detail: "Mesmo que o golpista tenha a senha, ele vai precisar de um código que só chega para você.",
    },
    {
      id: "phish_sessions",
      phase: "hour",
      title: "Encerre as sessões que você não reconhece",
      detail: "Nas configurações de segurança da conta, saia de todos os aparelhos e locais desconhecidos.",
    },
    {
      id: "phish_recovery",
      phase: "hour",
      title: "Confira o e-mail e o telefone de recuperação",
      detail: "No e-mail, veja também se surgiram regras de encaminhamento ou filtros que você não criou.",
    },
    {
      id: "phish_report",
      phase: "hour",
      title: "Denuncie o site falso",
      detail: "A denúncia ajuda os navegadores a bloquear a página para outras pessoas.",
      links: ["phishing_report"],
    },
    {
      id: "phish_statements",
      phase: "day",
      title: "Acompanhe extratos e faturas",
      detail: "Por alguns dias, confira se aparecem compras ou transferências que você não fez.",
      whenFlags: ["CARD_SHARED", "PASSWORD_SHARED", "CODE_SHARED", "MONEY_SENT"],
    },
    REGISTRATO_STEP,
  ],
  ACCOUNT_TAKEOVER: [
    {
      id: "ato_recover",
      phase: "now",
      title: "Recupere o acesso pela opção \"esqueci minha senha\"",
      detail:
        "Use só o app ou o site oficial. Se o invasor trocou o e-mail de recuperação, procure a página de conta invadida do próprio serviço.",
    },
    {
      id: "ato_whatsapp",
      phase: "now",
      title: "No WhatsApp, reative a conta no seu número",
      detail:
        "Reinstale o app e confirme o número com o código por SMS: isso desconecta quem clonou. Depois, ative a confirmação em duas etapas (PIN de 6 dígitos).",
    },
    {
      id: "ato_warn_contacts",
      phase: "now",
      title: "Avise seus contatos por outro canal",
      detail: "Peça que ignorem pedidos de dinheiro feitos em seu nome até você recuperar a conta.",
    },
    {
      id: "ato_email_password",
      phase: "hour",
      title: "Troque a senha do e-mail ligado à conta",
      detail: "Quem controla o seu e-mail consegue redefinir as outras senhas.",
    },
    {
      id: "ato_2fa",
      phase: "hour",
      title: "Ative a verificação em duas etapas",
      detail: "No e-mail, nas redes sociais e nos bancos. Prefira app autenticador a SMS quando houver a opção.",
    },
    {
      id: "ato_sessions",
      phase: "hour",
      title: "Encerre sessões e remova aparelhos desconhecidos",
      detail: "E confira se o e-mail e o telefone de recuperação ainda são os seus.",
    },
    {
      id: "ato_police_report",
      phase: "day",
      title: "Registre um boletim de ocorrência",
      detail: "Pela delegacia online do seu estado, principalmente se alguém perdeu dinheiro com o golpe.",
      whenFlags: ["MONEY_SENT"],
    },
    {
      id: "ato_monitor",
      phase: "day",
      title: "Acompanhe a conta nos próximos dias",
      detail: "Veja se aparecem novas sessões, posts ou mensagens que você não fez.",
    },
  ],
  STOLEN_PHONE: [
    {
      id: "phone_safety",
      phase: "now",
      title: "Fique em segurança",
      detail: "Não tente recuperar o aparelho sozinho. Use o celular de outra pessoa ou um computador para os próximos passos.",
    },
    {
      id: "phone_celular_seguro",
      phase: "now",
      title: "Acione o Celular Seguro",
      detail:
        "No site ou app do governo, com a conta gov.br, registre o alerta. Ele pede às operadoras e aos bancos parceiros o bloqueio da linha, do aparelho e dos apps de banco.",
      links: ["celular_seguro"],
    },
    {
      id: "phone_banks",
      phase: "now",
      title: "Ligue para os seus bancos",
      detail: "Pelo número no verso do cartão. Peça o bloqueio do acesso pelo celular, do Pix e dos cartões salvos no aparelho.",
    },
    {
      id: "phone_carrier",
      phase: "now",
      title: "Peça à operadora o bloqueio da linha",
      detail: "Isso impede que o ladrão receba por SMS os códigos dos seus apps.",
    },
    {
      id: "phone_find_device",
      phase: "hour",
      title: "Bloqueie e marque o aparelho como perdido",
      detail:
        "Pelo Encontre Meu Dispositivo (Android) ou pelo Buscar (iPhone): bloqueie a tela e mostre um contato. Se não houver chance de recuperar, apague os dados à distância.",
      links: ["google_find", "apple_find"],
    },
    {
      id: "phone_email_password",
      phase: "hour",
      title: "Troque a senha do e-mail e da conta Google ou Apple",
      detail: "E remova o aparelho roubado da lista de dispositivos conectados.",
    },
    {
      id: "phone_whatsapp",
      phase: "hour",
      title: "Proteja o WhatsApp",
      detail:
        "Pela ajuda do WhatsApp, peça a desativação da conta no aparelho roubado. Quando tiver o chip novo, reative a conta no mesmo número.",
    },
    {
      id: "phone_police_report",
      phase: "hour",
      title: "Registre o boletim de ocorrência com o IMEI",
      detail:
        "O IMEI está na caixa ou na nota fiscal do aparelho, e também na sua conta Google ou Apple. A operadora pede o BO para bloquear o aparelho.",
    },
    {
      id: "phone_imei_block",
      phase: "day",
      title: "Peça o bloqueio do IMEI à operadora",
      detail: "Com o BO, o aparelho fica bloqueado nas redes de todas as operadoras do país.",
    },
    {
      id: "phone_new_sim",
      phase: "day",
      title: "Peça a segunda via do chip com o mesmo número",
      detail: "Assim você volta a receber os códigos de verificação dos seus apps.",
    },
    {
      id: "phone_passwords",
      phase: "day",
      title: "Troque as senhas que estavam salvas no celular",
      detail: "Comece pelos bancos, pelo e-mail e pelas redes sociais.",
    },
    REGISTRATO_STEP,
  ],
  IDENTITY_FRAUD: [
    {
      id: "idf_contest",
      phase: "now",
      title: "Conteste na empresa onde abriram a conta ou o crédito",
      detail: "Pelos canais oficiais. Diga que não reconhece a contratação, peça o cancelamento e anote o protocolo.",
    },
    {
      id: "idf_evidence",
      phase: "now",
      title: "Guarde as provas",
      detail: "Cobranças, cartas, e-mails e mensagens que você recebeu sobre a conta ou a dívida.",
    },
    {
      id: "idf_registrato",
      phase: "hour",
      title: "Consulte o Registrato do Banco Central",
      detail: "Mostra contas, chaves Pix e empréstimos no seu CPF. Anote tudo o que você não reconhece.",
      links: ["registrato"],
    },
    {
      id: "idf_police_report",
      phase: "hour",
      title: "Registre um boletim de ocorrência",
      detail: "Pela delegacia online do seu estado. O BO ajuda a contestar dívidas e cadastros feitos em seu nome.",
    },
    {
      id: "idf_consumidor",
      phase: "day",
      title: "Se a empresa não resolver, registre uma reclamação",
      detail: "No consumidor.gov.br. Se for banco ou financeira, registre também no Banco Central.",
      links: ["consumidor_gov", "bcb_reclamacao"],
    },
    {
      id: "idf_credit_watch",
      phase: "day",
      title: "Acompanhe o seu CPF nos birôs de crédito",
      detail: "Consultas gratuitas, como as da Serasa e da Boa Vista, mostram dívidas abertas no seu nome.",
    },
  ],
};

export function playbookFor(type: IncidentType): StepDef[] {
  return type === "DATA_BREACH" ? DATA_BREACH_STEPS : PLAYBOOKS[type];
}
