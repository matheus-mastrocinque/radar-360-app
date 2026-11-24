import Link from "next/link";
import { FlaskConical, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { SubmitButton } from "@/components/submit-button";
import { NavLinks } from "./nav-links";

function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export function AppHeader({ userName }: { userName: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-2 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/painel"
          aria-label="Radar360: ir para o painel"
          className="flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo hideWordmarkOnMobile />
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-3">
          {userName && (
            <span className="hidden items-center gap-2 text-sm md:flex">
              <span
                className="flex size-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground ring-1 ring-brand/15"
                aria-hidden
              >
                {initials(userName)}
              </span>
              <span className="max-w-48 truncate text-muted-foreground">{userName}</span>
            </span>
          )}
          <form action={logout}>
            <SubmitButton variant="outline" size="sm" pendingText="Saindo...">
              <LogOut aria-hidden />
              <span className="sr-only sm:not-sr-only">Sair</span>
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-amber-200/80 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-6xl items-start gap-2.5 px-4 py-2 text-[13px] sm:items-center sm:px-6">
        <span className="mt-px flex shrink-0 items-center gap-1 rounded-full bg-amber-200/70 px-2 py-px text-[11px] font-semibold text-amber-900 sm:mt-0">
          <FlaskConical className="size-3" aria-hidden />
          Demo
        </span>
        <span>
          <span className="font-medium">Você está na demo.</span> A persona, os vazamentos e as redes são fictícios:
          nada aqui é dado real.
        </span>
      </div>
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Radar360 · Hack Brasil 2026</span>
        <span>As orientações são informativas e não são assessoria jurídica.</span>
      </div>
    </footer>
  );
}
