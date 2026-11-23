import Link from "next/link";
import { Radar, ShieldAlert, Scale, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PILLARS = [
  {
    icon: ShieldAlert,
    title: "Monitoramento contínuo",
    description:
      "Verificamos seu e-mail, CPF e telefone em vazamentos e avisamos só quando surge um risco novo. Guardamos apenas uma assinatura criptográfica dos seus dados, nunca o dado em si.",
  },
  {
    icon: Scale,
    title: "Plano de ação com LGPD",
    description:
      "Conte o que aconteceu ou abra um alerta: você recebe o que fazer em 15 minutos, 1 hora e 24 horas, e a notificação pronta para a empresa responsável.",
  },
  {
    icon: Wifi,
    title: "Auditoria da sua rede",
    description:
      "Um agente leve no seu computador mostra os aparelhos vulneráveis da sua casa e, em Wi-Fi público, o que o seu próprio computador está expondo.",
  },
];

export default async function Home() {
  const health = await getApiHealth();
  const apiOk = health.online && health.database === "ok";

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2 font-semibold">
          <Radar className="size-5" aria-hidden />
          Radar360
        </div>
        <Badge variant={apiOk ? "secondary" : "destructive"}>
          {apiOk ? "API online" : health.online ? "API sem banco" : "API offline"}
        </Badge>
      </header>

      <main className="flex flex-1 flex-col gap-12 py-12">
        <section className="flex max-w-2xl flex-col gap-5">
          <Badge variant="outline">Protótipo · Hack Brasil 2026</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Seus dados vazaram. Saiba o que fazer agora.
          </h1>
          <p className="text-lg text-muted-foreground">
            O Radar360 monitora vazamentos dos seus dados, monta um plano de ação com base na LGPD e
            mostra o que a sua rede e o seu computador deixam exposto.
          </p>
          <div className="flex flex-wrap gap-3">
            <span
              aria-disabled
              className={cn(buttonVariants({ size: "lg" }), "pointer-events-none opacity-60")}
            >
              Entrar como demo (em breve)
            </span>
            <Link href="#como-funciona" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Como funciona
            </Link>
          </div>
        </section>

        <section id="como-funciona" className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </section>
      </main>

      <footer className="py-6 text-sm text-muted-foreground">
        Os dados da demo são 100% fictícios. O Radar360 não oferece assessoria jurídica.
      </footer>
    </div>
  );
}
