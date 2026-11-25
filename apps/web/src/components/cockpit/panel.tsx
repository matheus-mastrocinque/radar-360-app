import { cn } from "@/lib/utils";
import type { Tone } from "./model";

/*
 * Moldura dos módulos da central de comando: barra de título técnica (índice + rótulo em mono),
 * corpo denso e, à direita, um indicador curto. Substitui o cartão genérico com ícone e descrição.
 */
export function Panel({
  id,
  index,
  label,
  aside,
  className,
  bodyClassName,
  children,
}: {
  id: string;
  index: string;
  label: string;
  aside?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-card/75 ring-1 ring-white/[0.07]",
        "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_18px_44px_-28px_rgb(0_0_0/0.95)]",
        className,
      )}
    >
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.012] px-4">
        <h2 id={id} className="eyebrow flex min-w-0 items-center gap-2 text-[10.5px] text-muted-foreground">
          <span className="text-rubi">{index}</span>
          <span className="h-3 w-px bg-white/15" aria-hidden />
          <span className="truncate text-foreground/90">{label}</span>
        </h2>
        {aside}
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </section>
  );
}

export const TONE_TEXT: Record<Tone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  neutral: "text-foreground/85",
  success: "text-success",
  muted: "text-muted-foreground",
};

export const TONE_DOT: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  neutral: "bg-foreground/60",
  success: "bg-success",
  muted: "bg-muted-foreground/60",
};

export const TONE_RAIL: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  neutral: "bg-foreground/35",
  success: "bg-success",
  muted: "bg-white/15",
};

/** Ponto de "ao vivo" com pulso (para com "reduzir movimento"). */
export function LiveDot({ tone = "success", className }: { tone?: Tone; className?: string }) {
  return (
    <span className={cn("relative flex size-2 shrink-0", className)} aria-hidden>
      <span className={cn("absolute inset-0 rounded-full opacity-70 motion-safe:animate-ping", TONE_DOT[tone])} />
      <span className={cn("relative size-2 rounded-full", TONE_DOT[tone])} />
    </span>
  );
}
