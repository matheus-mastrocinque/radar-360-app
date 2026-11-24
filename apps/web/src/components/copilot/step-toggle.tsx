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
        "mt-px flex size-5 cursor-pointer items-center justify-center rounded-md ring-1 transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        done
          ? "bg-emerald-600 text-white shadow-[0_1px_6px_-1px_oklch(0.6_0.15_160/0.6)] ring-emerald-600"
          : "bg-background shadow-xs ring-input hover:ring-foreground/40",
        pending && "opacity-60",
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        done && <Check className="size-3.5" strokeWidth={3} aria-hidden />
      )}
    </button>
  );
}
