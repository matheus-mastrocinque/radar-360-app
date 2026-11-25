import { ArrowRight } from "lucide-react";
import { enterDemo } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

/**
 * "Entrar como demo": abre uma sessão curta na persona fictícia (server action `enterDemo`).
 * - `hero`: o botão principal da tela, com o brilho carmesim.
 * - `plain`: botão principal sem brilho, para o fim da página.
 * - `compact`: versão discreta do cabeçalho.
 */
export function DemoButton({
  variant = "hero",
  className,
}: {
  variant?: "hero" | "plain" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <form action={enterDemo} className={className}>
        <SubmitButton variant="outline" size="sm" pendingText="Abrindo..." className="h-8 px-3">
          Entrar como demo
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={enterDemo} className={className}>
      <SubmitButton
        size="lg"
        pendingText="Abrindo a demo..."
        className={cn(
          "h-12 w-full rounded-xl px-6 text-[15px] font-semibold sm:w-auto",
          "has-data-[icon=inline-end]:pr-5",
          variant === "hero" && "glow-crimson",
        )}
      >
        Entrar como demo
        <ArrowRight data-icon="inline-end" aria-hidden className="transition-transform group-hover/button:translate-x-0.5" />
      </SubmitButton>
    </form>
  );
}
