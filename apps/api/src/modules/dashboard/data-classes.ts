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
  // Categorias que aparecem nos vazamentos reais do catálogo do Have I Been Pwned.
  documento: {
    label: "Documento de identidade",
    weight: 8,
    why: "Número de documento oficial facilita abrir contas e pedir crédito em seu nome.",
    action: "Consulte o Registrato, do Banco Central, e fique atento a cadastros em seu nome.",
  },
  perguntas_seguranca: {
    label: "Perguntas de segurança",
    weight: 8,
    why: "As respostas costumam valer em vários serviços e não mudam com o tempo.",
    action: "Troque as perguntas e respostas de segurança dos serviços que ainda usam esse método.",
  },
  tokens: {
    label: "Tokens de acesso",
    weight: 8,
    why: "Podem dar acesso à conta sem precisar da senha.",
    action: "Encerre as sessões abertas nas configurações de segurança do serviço e troque a senha.",
  },
  mensagens: {
    label: "Mensagens privadas",
    weight: 6,
    why: "Conversas expostas podem ser usadas para chantagem ou para golpes convincentes.",
  },
  dica_senha: {
    label: "Dica de senha",
    weight: 4,
    why: "A dica ajuda a adivinhar a senha, principalmente se ela se repete em outros serviços.",
    action: "Troque a senha desse serviço e de todos em que você usa a mesma.",
  },
  localizacao: {
    label: "Localização",
    weight: 3,
    why: "Mostra onde você está ou costuma estar.",
  },
  fotos: {
    label: "Fotos",
    weight: 3,
    why: "Imagens pessoais podem ser usadas em perfis falsos.",
  },
  usuario: {
    label: "Nome de usuário",
    weight: 2,
    why: "Junto com o e-mail, facilita tentativas de login com senhas vazadas.",
  },
  ip: {
    label: "Endereço IP",
    weight: 2,
    why: "Indica de onde você se conectou e ajuda a montar golpes direcionados.",
  },
  genero: {
    label: "Gênero",
    weight: 1,
    why: "Pesa pouco sozinho, mas completa o seu perfil.",
  },
  profissional: {
    label: "Dados profissionais",
    weight: 1,
    why: "Empregador e cargo dão credibilidade a golpes do tipo \"falso RH\".",
  },
  redes_sociais: {
    label: "Perfis em redes sociais",
    weight: 1,
    why: "Ligam você a outras contas e facilitam golpes personalizados.",
  },
  dispositivo: {
    label: "Dados do aparelho",
    weight: 1,
    why: "Modelo e navegador ajudam a montar ataques específicos.",
  },
  outros: {
    label: "Outros dados",
    weight: 1,
    why: "Categorias menos comuns, reunidas num grupo só.",
  },
};

const DEFAULT_WEIGHT = 3;

/** Chaves aceitas quando o próprio usuário informa o que vazou. */
export const DATA_CLASS_KEYS = Object.keys(CATALOG) as [string, ...string[]];

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
