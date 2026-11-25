import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, Fingerprint, FlaskConical, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { ASSET_META } from "./styles";

export function AssetsCard({ assets, isDemo }: { assets: Dashboard["assets"]; isDemo: boolean }) {
  return (
    <Card id="dados-monitorados" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-rubi ring-1 ring-white/[0.06]">
            <Fingerprint className="size-4" aria-hidden />
          </span>
          Dados monitorados
        </CardTitle>
        <CardDescription>O monitoramento confere estes dados contra novos vazamentos a cada 6 horas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {assets.map((asset) => {
            const { label, icon: Icon } = ASSET_META[asset.type];
            return (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-lg bg-ink px-3 py-2.5 ring-1 ring-white/[0.06]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="truncate font-mono text-sm">{asset.masked}</span>
                </div>
                {asset.verifiedAt ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success ring-1 ring-success/30 ring-inset"
                    title={`Verificado em ${formatDate(asset.verifiedAt)}`}
                  >
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Verificado
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-white/10 ring-inset">
                    <Clock className="size-3.5" aria-hidden />
                    Pendente
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
          {isDemo && (
            <li className="flex gap-2">
              <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <span>
                <span className="font-medium text-foreground">Na demo,</span> estes são dados da persona fictícia, já
                verificados para você ver o monitoramento funcionando.
              </span>
            </li>
          )}
          <li className="flex gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Guardamos só uma assinatura criptográfica (HMAC-SHA256) e a versão mascarada de cada dado, nunca o dado
              completo. Só monitoramos dados verificados como seus.
            </span>
          </li>
        </ul>

        <Link
          href="/painel/contas"
          className="group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-colors outline-none ring-inset hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex-1">Acompanhar os serviços que você usa</span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </Link>
      </CardContent>
    </Card>
  );
}
