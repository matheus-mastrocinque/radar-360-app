/**
 * Score de exposição: fórmula fixa, determinística e explicada na tela. Nunca calculada pelo LLM.
 *
 * Score = min(vazamentos, 70) + min(rede, 30), de 0 a 100. Quanto maior, mais exposto.
 * - Vazamentos: cada categoria de dado exposta soma o seu peso (tabela curada em data-classes.ts)
 *   uma vez, mais 2 pontos por vazamento repetido, até +6.
 * - Rede: cada achado da última auditoria de cada modo soma pela gravidade.
 */
import { dataClassInfo } from "./data-classes.js";

export const LEAK_CAP = 70;
export const NETWORK_CAP = 30;
export const REPEAT_BONUS = 2;
export const MAX_REPEAT_BONUS = 6;

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_POINTS: Record<Severity, number> = {
  critical: 12,
  high: 8,
  medium: 4,
  low: 1,
  info: 0,
};

const SEVERITY_ADJECTIVE: Record<Severity, string> = {
  critical: "crítico",
  high: "alto",
  medium: "médio",
  low: "baixo",
  info: "informativo",
};

export type ScanScope = "home" | "public";

const SCOPE_LABEL: Record<ScanScope, string> = {
  home: "Rede de casa",
  public: "Rede pública",
};

export type ScoreLevel = "baixo" | "moderado" | "alto" | "critico";

/** Faixas do score, da mais grave para a mais leve. */
export const SCORE_LEVELS: ReadonlyArray<{ min: number; level: ScoreLevel; label: string }> = [
  { min: 80, level: "critico", label: "Crítico" },
  { min: 50, level: "alto", label: "Alto" },
  { min: 25, level: "moderado", label: "Moderado" },
  { min: 0, level: "baixo", label: "Baixo" },
];

export interface ScoreInput {
  /** Um item por vazamento distinto em que algum ativo do usuário apareceu. */
  breaches: ReadonlyArray<{ dataClasses: readonly string[] }>;
  /** Última auditoria de cada modo. */
  scans: ReadonlyArray<{ scope: ScanScope; findings: ReadonlyArray<{ severity: Severity }> }>;
}

export interface ScoreFactor {
  group: "leaks" | "network";
  label: string;
  detail: string;
  points: number;
}

export interface ExposureScore {
  value: number;
  max: 100;
  level: ScoreLevel;
  levelLabel: string;
  leaks: { points: number; raw: number; cap: number };
  network: { points: number; raw: number; cap: number };
  factors: ScoreFactor[];
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function levelFor(value: number) {
  const band = SCORE_LEVELS.find((item) => value >= item.min) ?? SCORE_LEVELS[SCORE_LEVELS.length - 1]!;
  return { level: band.level, label: band.label };
}

export function computeExposureScore(input: ScoreInput): ExposureScore {
  const counts = new Map<string, number>();
  for (const breach of input.breaches) {
    for (const key of new Set(breach.dataClasses)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const leakFactors: ScoreFactor[] = [...counts.entries()]
    .map(([key, occurrences]) => {
      const info = dataClassInfo(key);
      const bonus = Math.min(MAX_REPEAT_BONUS, REPEAT_BONUS * (occurrences - 1));
      const detail =
        bonus > 0
          ? `${plural(occurrences, "vazamento")}: peso ${info.weight} + ${bonus} pela repetição`
          : `1 vazamento: peso ${info.weight}`;
      return { group: "leaks" as const, label: info.label, detail, points: info.weight + bonus };
    })
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label, "pt-BR"));

  const networkFactors: ScoreFactor[] = [];
  for (const scan of input.scans) {
    const bySeverity = new Map<Severity, number>();
    for (const finding of scan.findings) {
      bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1);
    }
    for (const severity of ["critical", "high", "medium", "low"] as const) {
      const count = bySeverity.get(severity) ?? 0;
      if (count === 0) continue;
      const adjective = SEVERITY_ADJECTIVE[severity];
      networkFactors.push({
        group: "network",
        label: `${SCOPE_LABEL[scan.scope]}: ${plural(count, `achado ${adjective}`, `achados ${adjective}s`)}`,
        detail: `${count} × ${SEVERITY_POINTS[severity]} ${SEVERITY_POINTS[severity] === 1 ? "ponto" : "pontos"}`,
        points: count * SEVERITY_POINTS[severity],
      });
    }
  }

  const leakRaw = leakFactors.reduce((sum, factor) => sum + factor.points, 0);
  const networkRaw = networkFactors.reduce((sum, factor) => sum + factor.points, 0);
  const leaks = { points: Math.min(leakRaw, LEAK_CAP), raw: leakRaw, cap: LEAK_CAP };
  const network = { points: Math.min(networkRaw, NETWORK_CAP), raw: networkRaw, cap: NETWORK_CAP };
  const value = leaks.points + network.points;
  const { level, label } = levelFor(value);

  return {
    value,
    max: 100,
    level,
    levelLabel: label,
    leaks,
    network,
    factors: [...leakFactors, ...networkFactors],
  };
}
