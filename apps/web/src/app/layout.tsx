import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Serifada só para os títulos de destaque da landing. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Radar360",
  description:
    "Monitoramento de vazamentos, plano de ação com base na LGPD e auditoria da sua rede, em linguagem simples.",
};

export const viewport: Viewport = {
  themeColor: "#0d1424",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // As variáveis da fonte ficam no <html> porque o Tailwind aplica font-sans nele.
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
