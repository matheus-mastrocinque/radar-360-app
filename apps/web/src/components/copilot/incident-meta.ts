import {
  Banknote,
  Bot,
  DatabaseZap,
  IdCard,
  KeyRound,
  Link2Off,
  Megaphone,
  ScanSearch,
  Smartphone,
  UserRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { IncidentType, IncidentView } from "@/lib/incidents";

/** Ícone de cada tipo de incidente (os tipos vêm da lista fechada da API). */
export const TYPE_ICON: Record<IncidentType, LucideIcon> = {
  DATA_BREACH: DatabaseZap,
  PIX_SCAM: Banknote,
  PHISHING: Link2Off,
  ACCOUNT_TAKEOVER: UserX,
  STOLEN_PHONE: Smartphone,
  IDENTITY_FRAUD: IdCard,
};

/** Quem definiu o tipo do incidente: o sistema, você, a IA ou as palavras-chave. */
export function originOf(incident: Pick<IncidentView, "classifiedBy" | "reportedBreach" | "breach">): {
  label: string;
  icon: LucideIcon;
} {
  if (incident.reportedBreach) return { label: "Aviso da empresa, informado por você", icon: Megaphone };
  // Catálogo público (HIBP): o serviço vazou, mas não sabemos se a conta da pessoa estava no vazamento.
  if (incident.breach?.source === "HIBP") return { label: "Vazamento público de um serviço que você usa", icon: KeyRound };
  switch (incident.classifiedBy) {
    case "SYSTEM":
      return { label: "Detectado pelo monitoramento", icon: ScanSearch };
    case "USER":
      return { label: "Tipo escolhido por você", icon: UserRound };
    case "AI":
      return { label: "Tipo identificado pela IA (Gemini)", icon: Bot };
    case "RULES":
      return { label: "Tipo identificado por palavras-chave", icon: Bot };
  }
}

/** Resumo do cabeçalho. Para o catálogo público, o texto padrão ("seus dados apareceram") não vale. */
export function summaryOf(incident: Pick<IncidentView, "summary" | "typeDescription" | "breach">): string {
  if (incident.summary) return incident.summary;
  if (incident.breach?.source === "HIBP") {
    return `${incident.breach.company} teve um vazamento público. Não sabemos se a sua conta estava nele: a notificação LGPD pede essa confirmação à empresa.`;
  }
  return incident.typeDescription;
}
