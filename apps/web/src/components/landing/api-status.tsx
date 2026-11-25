import { AlertTriangle, CircleAlert } from "lucide-react";
import type { ApiHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Indicador discreto de saúde da API, em linguagem de telemetria. Estado sempre com ícone ou ponto + palavra. */
export function ApiStatus({ health, className }: { health: ApiHealth; className?: string }) {
  const ok = health.online && health.database === "ok";

  if (ok) {
    return (
      <p className={cn("flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase", className)}>
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
        <span>
          Sistemas operacionais <span aria-hidden>·</span> <span className="text-success">API online</span>
        </span>
      </p>
    );
  }

  const noDatabase = health.online;
  const Icon = noDatabase ? CircleAlert : AlertTriangle;
  return (
    <p
      className={cn(
        "flex items-start gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase",
        className,
      )}
    >
      <Icon className={cn("mt-px size-3.5 shrink-0", noDatabase ? "text-warning" : "text-danger")} aria-hidden />
      <span>
        <span className={noDatabase ? "text-warning" : "text-danger"}>
          {noDatabase ? "API sem banco" : "API offline"}
        </span>{" "}
        <span aria-hidden>·</span> a demo pode demorar a abrir
      </span>
    </p>
  );
}
