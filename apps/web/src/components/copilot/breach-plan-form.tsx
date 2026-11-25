"use client";

import { ChevronRight } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { markArrival } from "./arrival";

/** "Gerar plano" de um vazamento detectado. A action vem do servidor já com o id do vazamento. */
export function BreachPlanForm({ action, company }: { action: () => Promise<void>; company: string }) {
  return (
    <form action={action} onSubmit={() => markArrival("top")} className="shrink-0">
      <SubmitButton
        size="sm"
        variant="outline"
        pendingText="Abrindo..."
        className="h-8 px-3"
        aria-label={`Gerar plano: ${company}`}
      >
        Gerar plano
        <ChevronRight data-icon="inline-end" aria-hidden />
      </SubmitButton>
    </form>
  );
}
