import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

/** Tela de falha da API dentro do painel, com um caminho para tentar de novo. */
export function ErrorState({ title, retryHref }: { title: string; retryHref: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <LogoMark size={48} className="opacity-90" />
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">A API não respondeu. Tente de novo em alguns segundos.</p>
      <Link href={retryHref} className={buttonVariants({ variant: "outline" })}>
        <RefreshCw aria-hidden />
        Tentar de novo
      </Link>
    </main>
  );
}
