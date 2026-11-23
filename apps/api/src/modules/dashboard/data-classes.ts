/**
 * Tabela curada das categorias de dados que aparecem nos vazamentos.
 * O peso entra no score de exposição; o texto é fixo e revisado, nunca gerado pelo LLM.
 */
export interface DataClassInfo {
  key: string;
  label: string;
  /** Pontos que a categoria soma ao score na primeira vez em que aparece. */
  weight: number;
  /** Por que essa categoria pesa, em uma frase. */
  why: string;
  /** Primeiro passo recomendado quando essa categoria vaza (texto curado), ou null. */
  action: string | null;
}

const CATALOG: Record<string, Omit<DataClassInfo, "key" | "action"> & { action?: string }> = {
  senha: {
    label: "Senha",
    weight: 14,
    why: "Dá acesso direto à conta e a qualquer outro serviço em que você repita a mesma senha.",
    action: "Troque essa senha agora e em todo serviço em que você usa a mesma. Ative a verificação em duas etapas.",
  },
  senha_hash: {
    label: "Senha (cifrada)",
    weight: 12,
    why: "Senhas cifradas podem ser quebradas offline, principalmente as curtas ou repetidas.",
    action: "Troque essa senha agora e em todo serviço em que você usa a mesma. Ative a verificação em duas etapas.",
  },
  cartao: {
    label: "Cartão de crédito",
    weight: 12,
    why: "Permite compras indevidas e golpes com dados reais do cartão.",
    action: "Peça ao banco o bloqueio e a troca do cartão e acompanhe a fatura nas próximas semanas.",
  },
  dados_bancarios: {
    label: "Dados bancários",
    weight: 10,
    why: "Ajudam golpistas a se passar pelo seu banco de forma convincente.",
    action: "Desconfie de contatos em nome do banco: desligue e ligue você mesmo para o número oficial.",
  },
  cpf: {
    label: "CPF",
    weight: 10,
    why: "Usado para abrir contas, pedir crédito e confirmar identidade em golpes.",
    action: "Consulte o Registrato, do Banco Central, para ver se abriram contas ou empréstimos no seu CPF.",
  },
  rg: {
    label: "RG",
    weight: 8,
    why: "Junto com o CPF, facilita fraudes de identidade.",
    action: "Fique atento a cadastros em seu nome e registre boletim de ocorrência se houver uso indevido.",
  },
  dados_saude: {
    label: "Dados de saúde",
    weight: 8,
    why: "Dado pessoal sensível: pode ser usado para chantagem ou discriminação.",
    action: "Desconfie de contatos sobre exames ou reembolsos e confirme sempre pelos canais oficiais.",
  },
  convenio: {
    label: "Convênio médico",
    weight: 6,
    why: "Revela informação de saúde e serve de isca em golpes de falso reembolso.",
    action: "Desconfie de contatos sobre reembolsos ou exames e confirme sempre pelo app ou telefone oficial do convênio.",
  },
  telefone: {
    label: "Telefone",
    weight: 5,
    why: "Abre caminho para golpes por WhatsApp, SMS falso e clonagem de chip.",
    action: "Ative a verificação em duas etapas do WhatsApp e nunca repasse códigos recebidos por SMS.",
  },
  endereco: {
    label: "Endereço",
    weight: 4,
    why: "Dá credibilidade a golpes e expõe onde você mora.",
  },
  data_nascimento: {
    label: "Data de nascimento",
    weight: 4,
    why: "É pergunta de segurança comum e ajuda a confirmar identidade em fraudes.",
  },
  email: {
    label: "E-mail",
    weight: 3,
    why: "Vira alvo de phishing e de tentativas de login com senhas vazadas.",
    action: "Desconfie de e-mails que citam a empresa vazada e não clique em links de \"confirmação\".",
  },
  historico_compras: {
    label: "Histórico de compras",
    weight: 2,
    why: "Permite golpes personalizados, como falsa entrega ou falso estorno.",
    action: "Desconfie de mensagens sobre entregas ou estornos que você não pediu.",
  },
  nome: {
    label: "Nome",
    weight: 1,
    why: "Sozinho pesa pouco, mas torna os outros dados mais úteis para golpistas.",
  },
};

const DEFAULT_WEIGHT = 3;

export function dataClassInfo(key: string): DataClassInfo {
  const known = CATALOG[key];
  if (known) return { key, ...known, action: known.action ?? null };
  const label = key.replace(/_/g, " ");
  return {
    key,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    weight: DEFAULT_WEIGHT,
    why: "Categoria sem peso específico na tabela; recebe o peso padrão.",
    action: null,
  };
}
