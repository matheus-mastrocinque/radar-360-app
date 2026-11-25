import { Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard, ScoreFactor } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { LEVEL_BANDS, LEVEL_STYLE } from "./styles";

function FactorTable({
  title,
  factors,
  points,
  raw,
  cap,
}: {
  title: string;
  factors: ScoreFactor[];
  points: number;
  raw: number;
  cap: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">teto de {cap} pontos</span>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Pontos de {title.toLowerCase()} no score</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Fator</th>
            <th scope="col">Pontos</th>
          </tr>
        </thead>
        <tbody>
          {factors.length === 0 ? (
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 text-muted-foreground">Nada somado aqui.</td>
              <td />
            </tr>
          ) : (
            factors.map((factor) => (
              <tr key={factor.label} className="border-b border-white/[0.06]">
                <td className="py-2 pr-3">
                  <span>{factor.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{factor.detail}</span>
                </td>
                <td className="py-2 text-right align-top font-mono text-xs text-foreground/80 tabular-nums">
                  +{factor.points}
                </td>
              </tr>
            ))
          )}
          <tr className="font-medium">
            <td className="pt-2.5">Subtotal{raw > cap ? ` (${raw}, limitado ao teto)` : ""}</td>
            <td className="pt-2.5 text-right font-mono tabular-nums">{points}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ScoreBreakdown({ score }: { score: Dashboard["score"] }) {
  const leakFactors = score.factors.filter((factor) => factor.group === "leaks");
  const networkFactors = score.factors.filter((factor) => factor.group === "network");
  const level = LEVEL_STYLE[score.level];
  const LevelIcon = level.icon;
  return (
    <Card id="como-calculamos" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <Calculator className="size-4" aria-hidden />
          </span>
          Como calculamos o seu score
        </CardTitle>
        <CardDescription>
          Fórmula fixa e pública, sem inteligência artificial: o mesmo cenário sempre dá o mesmo número.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
          <div className="flex flex-col gap-1.5 rounded-lg bg-ink px-4 py-3 font-mono text-[13px] text-foreground ring-1 ring-white/[0.06]">
            <span className="eyebrow text-[10px] text-rubi">Fórmula</span>
            <span>
              score = vazamentos <span className="text-muted-foreground">(até 70)</span> + rede{" "}
              <span className="text-muted-foreground">(até 30)</span>
            </span>
            <span className="text-muted-foreground">vai de 0 a 100</span>
          </div>
          <p>
            <span className="font-medium text-foreground">Vazamentos:</span> cada tipo de dado exposto soma o seu peso
            uma vez (senha 12 a 14, CPF 10, telefone 5, e-mail 3, nome 1...). Se o mesmo tipo vazou em mais de um
            lugar, soma +2 por repetição, até +6.
          </p>
          <p>
            <span className="font-medium text-foreground">Rede:</span> cada problema da última auditoria de cada rede
            soma pela gravidade: crítico 12, alto 8, médio 4, baixo 1.
          </p>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Faixas:</span>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {LEVEL_BANDS.map((band) => (
                <li
                  key={band.level}
                  className="flex flex-col gap-0.5 rounded-md bg-ink px-2.5 py-1.5 ring-1 ring-white/[0.06]"
                >
                  <span className="flex items-center gap-1.5 text-xs text-foreground">
                    <span className={cn("size-1.5 rounded-full", LEVEL_STYLE[band.level].bar)} aria-hidden />
                    {band.label}
                  </span>
                  <span className="font-mono text-[11px]">
                    {band.from} a {band.to === 100 ? 100 : band.to - 1}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <FactorTable
            title="Vazamentos"
            factors={leakFactors}
            points={score.leaks.points}
            raw={score.leaks.raw}
            cap={score.leaks.cap}
          />
          <FactorTable
            title="Rede"
            factors={networkFactors}
            points={score.network.points}
            raw={score.network.raw}
            cap={score.network.cap}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink px-4 py-3 ring-1 ring-white/[0.06]">
            <span className="flex flex-wrap items-center gap-2.5 font-medium">
              Score total
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-px font-mono text-[10px] tracking-wider uppercase ring-1 ring-inset",
                  level.badge,
                )}
              >
                <LevelIcon className="size-3" aria-hidden />
                {level.label}
              </span>
            </span>
            <span className="font-mono text-lg tabular-nums">
              {score.value} <span className="text-sm text-muted-foreground">/ {score.max}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
