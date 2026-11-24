import { AppFooter, AppHeader, DemoBanner } from "@/components/shell/app-shell";
import { fetchDashboardOnce } from "@/lib/dashboard";
import { getSessionToken } from "@/lib/session";

/**
 * Moldura comum do painel e do copiloto: cabeçalho com navegação, aviso de demo e rodapé.
 * A autenticação continua em cada página (elas redirecionam se a sessão faltar ou expirar).
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const token = await getSessionToken();
  const result = token ? await fetchDashboardOnce(token) : null;
  const viewer = result?.ok ? result.data.user : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader userName={viewer?.name ?? null} />
      {viewer?.isDemo && <DemoBanner />}
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
