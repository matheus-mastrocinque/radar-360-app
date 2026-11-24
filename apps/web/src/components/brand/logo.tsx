import { cn } from "@/lib/utils";

/** Marca do Radar360: anéis do radar, a varredura e um ponto detectado. */
export function LogoMark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "signal" }) {
  const tile = tone === "ink" ? "var(--color-ink)" : "var(--color-signal)";
  const line = tone === "ink" ? "var(--color-signal)" : "var(--color-ink)";
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="9" fill={tile} />
      <circle cx="16" cy="16" r="10" fill="none" stroke={line} strokeOpacity=".35" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke={line} strokeOpacity=".6" strokeWidth="1.4" />
      <path d="M16 16 16 6a10 10 0 0 1 9.51 6.91Z" fill={line} fillOpacity=".85" />
      <circle cx="16" cy="16" r="1.9" fill={line} />
      <circle cx="22.2" cy="20.6" r="1.5" fill={line} />
    </svg>
  );
}

export function Logo({
  className,
  tone = "light",
  hideWordmarkOnMobile = false,
}: {
  className?: string;
  /** "light": fundo claro. "dark": fundo escuro (hero). */
  tone?: "light" | "dark";
  hideWordmarkOnMobile?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark tone={tone === "light" ? "ink" : "signal"} />
      <span
        className={cn(
          "text-[15px] font-semibold tracking-tight",
          tone === "dark" ? "text-white" : "text-foreground",
          hideWordmarkOnMobile && "hidden sm:inline",
        )}
      >
        Radar
        <span className={tone === "dark" ? "text-signal" : "text-brand"}>360</span>
      </span>
    </span>
  );
}
