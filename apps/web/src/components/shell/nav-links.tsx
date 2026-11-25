"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LayoutDashboard, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, match: (path: string) => path === "/painel" },
  {
    href: "/painel/contas",
    label: "Minhas contas",
    short: "Contas",
    icon: KeyRound,
    match: (path: string) => path.startsWith("/painel/contas"),
  },
  {
    href: "/painel/copiloto",
    label: "Copiloto",
    icon: LifeBuoy,
    match: (path: string) => path.startsWith("/painel/copiloto"),
  },
];

/** Abas do cabeçalho do painel. A aba ativa recebe aria-current e um traço embaixo. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex h-full items-stretch gap-1 sm:gap-2">
      {LINKS.map(({ href, label, short, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors outline-none sm:px-3",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors sm:after:inset-x-3",
              active
                ? "text-foreground after:bg-foreground"
                : "text-muted-foreground after:bg-transparent hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {short ? (
              <>
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            ) : (
              label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
