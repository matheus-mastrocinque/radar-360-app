import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Michroma } from "next/font/google";
import "./globals.css";

/** Texto e interface: legível, acentuação completa, tom neutro e confiável. */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Telemetria, prazos (T+15MIN · T+1H · T+24H), códigos e rótulos. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/** Marca: títulos curtos em caixa alta. O wordmark oficial é o SVG em curvas (public/brand). */
const michroma = Michroma({
  variable: "--font-michroma",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Olharium · Vigia por você. Responde com você.",
  description:
    "Vazamentos reais dos serviços que você usa, plano de resposta em 15 min, 1 h e 24 h com a notificação LGPD pronta, e um agente que audita e corrige a sua rede com o seu OK.",
};

export const viewport: Viewport = {
  themeColor: "#07060a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // A classe "dark" ativa as variantes dark: dos componentes; os tokens já são escuros (HUD Neon).
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`dark ${plexSans.variable} ${plexMono.variable} ${michroma.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
