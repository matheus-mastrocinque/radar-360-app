import type { IncidentType } from "../../generated/prisma/enums.js";
import {
  OFFICIAL_LINKS,
  PHASES,
  playbookFor,
  type IncidentFlag,
  type PhaseKey,
  type StepDef,
} from "./catalog.js";

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  links: Array<{ label: string; url: string }>;
  lgpd: boolean;
  done: boolean;
}

export interface Plan {
  phases: Array<{ key: PhaseKey; label: string; window: string; steps: PlanStep[] }>;
  progress: { done: number; total: number };
}

export interface PlanInput {
  type: IncidentType;
  flags: readonly IncidentFlag[];
  /** Categorias expostas no vazamento (só para DATA_BREACH). */
  dataClasses?: readonly string[];
  completedSteps?: readonly string[];
}

function applies(step: StepDef, flags: readonly IncidentFlag[], dataClasses: readonly string[]): boolean {
  if (step.whenFlags && !step.whenFlags.some((flag) => flags.includes(flag))) return false;
  if (step.whenClasses && !step.whenClasses.some((key) => dataClasses.includes(key))) return false;
  return true;
}

/** Passos que valem para este incidente, na ordem do playbook. */
export function applicableSteps(input: Omit<PlanInput, "completedSteps">): StepDef[] {
  const dataClasses = input.dataClasses ?? [];
  return playbookFor(input.type).filter((step) => applies(step, input.flags, dataClasses));
}

/** Monta o plano 15 min / 1 h / 24 h a partir dos playbooks curados. Determinístico: sem LLM. */
export function buildPlan(input: PlanInput): Plan {
  const completed = new Set(input.completedSteps ?? []);
  const steps = applicableSteps(input);

  const phases = PHASES.map((phase) => ({
    key: phase.key,
    label: phase.label,
    window: phase.window,
    steps: steps
      .filter((step) => step.phase === phase.key)
      .map((step) => ({
        id: step.id,
        title: step.title,
        detail: step.detail,
        links: (step.links ?? []).map((id) => ({ ...OFFICIAL_LINKS[id] })),
        lgpd: step.lgpd ?? false,
        done: completed.has(step.id),
      })),
  })).filter((phase) => phase.steps.length > 0);

  const done = steps.filter((step) => completed.has(step.id)).length;
  return { phases, progress: { done, total: steps.length } };
}
