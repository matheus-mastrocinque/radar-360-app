import {
  ArrowDown,
  CircleAlert,
  IdCard,
  Info,
  Mail,
  OctagonAlert,
  Phone,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { AssetType, ScoreLevel, Severity } from "@/lib/dashboard";

/**
 * Cores do painel, só com tokens do design system (docs/design-system.md).
 * Estado usa success → warning → danger, sempre com ícone + palavra. O carmesim nunca indica estado.
 */

type Icon = React.ComponentType<{ className?: string }>;

export const ASSET_META: Record<AssetType, { label: string; icon: Icon }> = {
  EMAIL: { label: "E-mail", icon: Mail },
  CPF: { label: "CPF", icon: IdCard },
  PHONE: { label: "Telefone", icon: Phone },
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export const SEVERITY_STYLE: Record<Severity, { label: string; icon: Icon; badge: string; rail: string; text: string }> =
  {
    critical: {
      label: "Crítico",
      icon: OctagonAlert,
      badge: "bg-danger/20 text-danger ring-1 ring-inset ring-danger/50",
      rail: "border-danger",
      text: "text-danger",
    },
    high: {
      label: "Alto",
      icon: TriangleAlert,
      badge: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/30",
      rail: "border-danger",
      text: "text-danger",
    },
    medium: {
      label: "Médio",
      icon: CircleAlert,
      badge: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/30",
      rail: "border-warning",
      text: "text-warning",
    },
    low: {
      label: "Baixo",
      icon: ArrowDown,
      badge: "bg-white/[0.04] text-foreground/85 ring-1 ring-inset ring-white/15",
      rail: "border-foreground/30",
      text: "text-foreground/85",
    },
    info: {
      label: "Info",
      icon: Info,
      badge: "text-muted-foreground ring-1 ring-inset ring-white/10",
      rail: "border-white/10",
      text: "text-muted-foreground",
    },
  };

export const LEVEL_STYLE: Record<
  ScoreLevel,
  { label: string; icon: Icon; text: string; badge: string; bar: string; stroke: string }
> = {
  baixo: {
    label: "Risco baixo",
    icon: ShieldCheck,
    text: "text-success",
    badge: "bg-success/10 text-success ring-success/30",
    bar: "bg-success",
    stroke: "stroke-success",
  },
  moderado: {
    label: "Risco moderado",
    icon: CircleAlert,
    text: "text-warning",
    badge: "bg-warning/10 text-warning ring-warning/30",
    bar: "bg-warning",
    stroke: "stroke-warning",
  },
  alto: {
    label: "Risco alto",
    icon: TriangleAlert,
    text: "text-danger",
    badge: "bg-danger/10 text-danger ring-danger/35",
    bar: "bg-danger",
    stroke: "stroke-danger",
  },
  critico: {
    label: "Risco crítico",
    icon: OctagonAlert,
    text: "text-danger",
    badge: "bg-danger/20 text-danger ring-danger/55",
    bar: "bg-danger",
    stroke: "stroke-danger",
  },
};

/** Faixas do score (iguais às da API: 0-24, 25-49, 50-79, 80-100). */
export const LEVEL_BANDS: Array<{ level: ScoreLevel; label: string; from: number; to: number }> = [
  { level: "baixo", label: "Baixo", from: 0, to: 25 },
  { level: "moderado", label: "Moderado", from: 25, to: 50 },
  { level: "alto", label: "Alto", from: 50, to: 80 },
  { level: "critico", label: "Crítico", from: 80, to: 100 },
];

/** Peso a partir do qual uma categoria vazada é "sensível" (tabela curada: senha, CPF...). */
export const HIGH_WEIGHT = 10;

/**
 * Cor do chip de categoria exposta, pelo peso na tabela curada. Usado também no copiloto e em
 * "Minhas contas", sempre junto de `ring-1`. Peso alto ganha `danger`; o resto fica neutro.
 */
export function dataClassTone(weight: number): string {
  if (weight >= HIGH_WEIGHT) return "bg-danger/10 text-danger ring-inset ring-danger/40";
  if (weight >= 4) return "bg-muted text-foreground ring-inset ring-white/10";
  return "bg-transparent text-muted-foreground ring-inset ring-white/10";
}
