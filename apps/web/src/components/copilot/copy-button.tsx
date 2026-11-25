"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ text, label = "Copiar texto" }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2200);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="h-8 px-3">
      {state === "copied" ? (
        <Check className="text-success" aria-hidden />
      ) : state === "failed" ? (
        <X className="text-danger" aria-hidden />
      ) : (
        <Copy aria-hidden />
      )}
      <span aria-live="polite">
        {state === "copied" ? "Copiado" : state === "failed" ? "Não deu: selecione e copie" : label}
      </span>
    </Button>
  );
}
