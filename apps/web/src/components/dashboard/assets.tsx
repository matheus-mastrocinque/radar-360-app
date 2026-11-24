import { BadgeCheck, Fingerprint, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { ASSET_META } from "./breaches";

export function AssetsCard({ assets }: { assets: Dashboard["assets"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados monitorados</CardTitle>
        <CardDescription>Verificamos estes dados em novos vazamentos a cada 6 horas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {assets.map((asset) => {
            const { label, icon: Icon } = ASSET_META[asset.type];
            return (
              <li key={asset.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-border ring-inset">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4 text-foreground/70" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="truncate font-mono text-sm">{asset.masked}</span>
                </div>
                {asset.verifiedAt ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset"
                    title={`Verificado em ${formatDate(asset.verifiedAt)}`}
                  >
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Verificado
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    Pendente
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2.5 rounded-lg bg-accent/70 p-3 text-xs leading-relaxed text-accent-foreground">
          <Fingerprint className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Guardamos só uma assinatura criptográfica (HMAC-SHA256) de cada dado, nunca o dado em texto. Só monitoramos
            dados verificados como seus.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          <Plus aria-hidden />
          Adicionar dado (em breve)
        </Button>
      </CardContent>
    </Card>
  );
}
