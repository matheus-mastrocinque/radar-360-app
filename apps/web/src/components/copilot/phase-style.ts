import type { PlanPhase } from "@/lib/incidents";

/** Cor de cada fase do plano: vermelho (agora), âmbar (1 h) e azul (24 h). */
export const PHASE_DOT: Record<PlanPhase["key"], string> = {
  now: "bg-red-500",
  hour: "bg-amber-400",
  day: "bg-sky-500",
};

export const PHASE_STYLE: Record<PlanPhase["key"], { rail: string; badge: string; time: string }> = {
  now: { rail: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-200", time: "15 min" },
  hour: { rail: "bg-amber-400", badge: "bg-amber-50 text-amber-800 ring-amber-200", time: "1 h" },
  day: { rail: "bg-sky-500", badge: "bg-sky-50 text-sky-800 ring-sky-200", time: "24 h" },
};
