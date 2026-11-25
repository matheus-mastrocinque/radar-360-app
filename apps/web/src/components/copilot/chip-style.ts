/**
 * Chip de seleção com radio/checkbox `sr-only` dentro do label (design system, seção 4).
 * Marcado: carmesim translúcido; desmarcado: tinta. O foco do teclado aparece no label (ciano).
 */
export const CHOICE_CHIP =
  "group/chip flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors select-none " +
  "bg-ink text-foreground/90 ring-white/10 hover:bg-muted hover:text-foreground " +
  "has-checked:bg-crimson/15 has-checked:text-foreground has-checked:ring-crimson/50 " +
  "has-focus-visible:ring-3 has-focus-visible:ring-ring/60";

/** Campo de texto escuro (design system, seção 4). */
export const FIELD =
  "rounded-md border border-input bg-ink px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-white/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
