import type { ScoreLevel, Severity } from "@/lib/dashboard";

export const SEVERITY_STYLE: Record<Severity, { label: string; badge: string; dot: string }> = {
  critical: { label: "Crítico", badge: "bg-red-600 text-white", dot: "bg-red-600" },
  high: { label: "Alto", badge: "bg-red-50 text-red-700 ring-1 ring-red-200", dot: "bg-red-500" },
  medium: {
    label: "Médio",
    badge: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    dot: "bg-amber-500",
  },
  low: { label: "Baixo", badge: "bg-sky-50 text-sky-800 ring-1 ring-sky-200", dot: "bg-sky-500" },
  info: {
    label: "Info",
    badge: "bg-muted text-muted-foreground ring-1 ring-border",
    dot: "bg-muted-foreground/40",
  },
};

export const LEVEL_STYLE: Record<ScoreLevel, { text: string; badge: string; bar: string }> = {
  baixo: { text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500" },
  moderado: { text: "text-yellow-600", badge: "bg-yellow-50 text-yellow-800 ring-yellow-200", bar: "bg-yellow-400" },
  alto: { text: "text-orange-600", badge: "bg-orange-50 text-orange-700 ring-orange-200", bar: "bg-orange-500" },
  critico: { text: "text-red-600", badge: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-600" },
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
  if (weight >= 10) return "bg-red-50 text-red-700 ring-red-200";
  if (weight >= 4) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-muted text-muted-foreground ring-border";
}
