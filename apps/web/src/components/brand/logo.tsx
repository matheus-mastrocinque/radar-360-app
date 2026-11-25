import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marca do Olharium (identidade HUD Neon). Os arquivos oficiais estão em public/brand e têm o
 * wordmark convertido em curvas: não redesenhe a marca com texto.
 *  - /brand/icon.svg: ícone de app (legível a partir de 32 px)
 *  - /brand/favicon.svg: versão mínima (16 a 32 px)
 *  - /brand/logo-dark.svg e /brand/logo-light.svg: símbolo + wordmark, proporção 1173 × 280
 *  - /brand/hero.svg: marca completa com brilho, para destaques em fundo escuro
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  const src = size < 32 ? "/brand/favicon.svg" : "/brand/icon.svg";
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}

export function Logo({
  className,
  tone = "dark",
  hideWordmarkOnMobile = false,
  height = 28,
}: {
  className?: string;
  /** "dark": fundo escuro (padrão do app). "light": fundo claro. */
  tone?: "light" | "dark";
  hideWordmarkOnMobile?: boolean;
  /** Altura do lockup em px. */
  height?: number;
}) {
  const width = Math.round((height * 1173) / 280);
  return (
    <span className={cn("flex items-center", className)}>
      {hideWordmarkOnMobile && <LogoMark size={height} className="sm:hidden" />}
      <Image
        src={tone === "light" ? "/brand/logo-light.svg" : "/brand/logo-dark.svg"}
        alt="Olharium"
        width={width}
        height={height}
        unoptimized
        priority
        className={cn("h-auto max-w-none", hideWordmarkOnMobile && "hidden sm:block")}
        style={{ width, height }}
      />
    </span>
  );
}
