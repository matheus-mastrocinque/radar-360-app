import type { ScoreLevel, Severity } from "@/lib/dashboard";

export const SEVERITY_STYLE: Record<Severity, { label: string; badge: string; dot: string; rail: string }> = {
  critical: { label: "Crítico", badge: "bg-red-600 text-white", dot: "bg-red-600", rail: "bg-red-600" },
  high: {
    label: "Alto",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    dot: "bg-red-500",
    rail: "bg-red-500",
  },
  medium: {
    label: "Médio",
    badge: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
    rail: "bg-amber-400",
  },
  low: {
    label: "Baixo",
    badge: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
    dot: "bg-sky-500",
    rail: "bg-sky-400",
  },
  info: {
    label: "Info",
    badge: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dot: "bg-muted-foreground/40",
    rail: "bg-border",
  },
};

export const LEVEL_STYLE: Record<
  ScoreLevel,
  { text: string; onDark: string; badge: string; badgeOnDark: string; bar: string; stroke: string }
> = {
  baixo: {
    text: "text-emerald-600",
    onDark: "text-emerald-300",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    badgeOnDark: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
    bar: "bg-emerald-500",
    stroke: "stroke-emerald-400",
  },
  moderado: {
    text: "text-yellow-600",
    onDark: "text-yellow-300",
    badge: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    badgeOnDark: "bg-yellow-300/15 text-yellow-100 ring-yellow-200/30",
    bar: "bg-yellow-400",
    stroke: "stroke-yellow-300",
  },
  alto: {
    text: "text-orange-600",
    onDark: "text-orange-300",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    badgeOnDark: "bg-orange-400/15 text-orange-200 ring-orange-300/30",
    bar: "bg-orange-500",
    stroke: "stroke-orange-400",
  },
  critico: {
    text: "text-red-600",
    onDark: "text-red-300",
    badge: "bg-red-50 text-red-700 ring-red-200",
    badgeOnDark: "bg-red-400/15 text-red-200 ring-red-300/30",
    bar: "bg-red-600",
    stroke: "stroke-red-400",
  },
};

/** Faixas do score (iguais às da API: 0-24, 25-49, 50-79, 80-100). */
export const LEVEL_BANDS: Array<{ level: ScoreLevel; label: string; from: number; to: number }> = [
  { level: "baixo", label: "Baixo", from: 0, to: 25 },
  { level: "moderado", label: "Moderado", from: 25, to: 50 },
  { level: "alto", label: "Alto", from: 50, to: 80 },
  { level: "critico", label: "Crítico", from: 80, to: 100 },
];

/** Cor do chip de categoria exposta, pelo peso na tabela curada. */
export function dataClassTone(weight: number): string {
  if (weight >= 10) return "bg-red-50 text-red-700 ring-inset ring-red-200";
  if (weight >= 4) return "bg-amber-50 text-amber-800 ring-inset ring-amber-200";
  return "bg-muted text-muted-foreground ring-inset ring-border";
}
