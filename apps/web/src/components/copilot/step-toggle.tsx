"use client";

import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Caixa de seleção de um passo do plano. Cada clique é uma server action (sem JS extra no estado). */
export function StepToggle({
  action,
  done,
  title,
}: {
  action: () => Promise<void>;
  done: boolean;
  title: string;
}) {
  return (
    <form action={action} className="shrink-0">
      <ToggleButton done={done} title={title} />
    </form>
  );
}

function ToggleButton({ done, title }: { done: boolean; title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Desmarcar: ${title}` : `Marcar como feito: ${title}`}
      className={cn(
        "mt-px flex size-[22px] cursor-pointer items-center justify-center rounded-[6px] ring-1 transition-[background-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        done
          ? "bg-success text-background ring-success"
          : "bg-ink text-muted-foreground ring-white/25 hover:bg-muted hover:ring-foreground/50",
        pending && "cursor-wait opacity-70",
      )}
    >
      {pending ? (
        <Loader2 className={cn("size-3.5 animate-spin", done ? "text-background" : "text-foreground")} aria-hidden />
      ) : (
        done && <Check className="size-3.5" strokeWidth={3.25} aria-hidden />
      )}
    </button>
  );
}
