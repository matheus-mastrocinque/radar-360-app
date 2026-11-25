import type { PlanPhase } from "@/lib/incidents";

/**
 * As três fases do plano na linguagem da marca (T+15MIN · T+1H · T+24H).
 * Fase é tempo, não estado: nada de success/warning/danger aqui. O destaque é o Neon Rubi, em dose baixa.
 */
export const PHASE_META: Record<PlanPhase["key"], { tag: string; short: string; hint: string }> = {
  now: { tag: "T+15MIN", short: "15 min", hint: "Travar o que dá para travar" },
  hour: { tag: "T+1H", short: "1 h", hint: "Avisar quem precisa e trocar acessos" },
  day: { tag: "T+24H", short: "24 h", hint: "Registros, documentos e LGPD" },
};

export const PHASE_ORDER: Array<PlanPhase["key"]> = ["now", "hour", "day"];
