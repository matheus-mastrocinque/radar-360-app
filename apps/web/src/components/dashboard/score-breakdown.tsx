import { Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard, ScoreFactor } from "@/lib/dashboard";

function FactorTable({ title, factors, points, raw, cap }: {
  title: string;
  factors: ScoreFactor[];
  points: number;
  raw: number;
  cap: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">teto de {cap} pontos</span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {factors.length === 0 ? (
            <tr>
              <td className="py-2 text-muted-foreground">Nada somado aqui.</td>
              <td />
            </tr>
          ) : (
            factors.map((factor) => (
              <tr key={factor.label}>
                <td className="py-1.5 pr-3">
                  <span>{factor.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{factor.detail}</span>
                </td>
                <td className="py-1.5 text-right font-mono text-xs tabular-nums">+{factor.points}</td>
              </tr>
            ))
          )}
          <tr className="font-medium">
            <td className="pt-2">Subtotal{raw > cap ? ` (${raw}, limitado ao teto)` : ""}</td>
            <td className="pt-2 text-right font-mono tabular-nums">{points}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ScoreBreakdown({ score }: { score: Dashboard["score"] }) {
  const leakFactors = score.factors.filter((factor) => factor.group === "leaks");
  const networkFactors = score.factors.filter((factor) => factor.group === "network");
  return (
    <Card id="como-calculamos" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4 text-muted-foreground" aria-hidden />
          Como calculamos o seu score
        </CardTitle>
        <CardDescription>
          Fórmula fixa e pública, sem inteligência artificial: o mesmo cenário sempre dá o mesmo número.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Score = vazamentos (até 70) + rede (até 30).</span> Vai
            de 0 a 100.
          </p>
          <p>
            <span className="font-medium text-foreground">Vazamentos:</span> cada tipo de dado exposto soma o seu peso
            uma vez (senha 12 a 14, CPF 10, telefone 5, e-mail 3, nome 1...). Se o mesmo tipo vazou em mais de um
            lugar, soma +2 por repetição, até +6.
          </p>
          <p>
            <span className="font-medium text-foreground">Rede:</span> cada problema da última auditoria de cada rede
            soma pela gravidade: crítico 12, alto 8, médio 4, baixo 1.
          </p>
          <p>
            <span className="font-medium text-foreground">Faixas:</span> 0 a 24 baixo, 25 a 49 moderado, 50 a 79 alto,
            80 ou mais crítico.
          </p>
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
          <div className="flex items-baseline justify-between border-t pt-3 font-medium">
            <span>Score total</span>
            <span className="font-mono text-lg tabular-nums">
              {score.value} <span className="text-sm text-muted-foreground">/ {score.max}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
