import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite rodar mais de um `next dev` na mesma pasta (ex.: revisões em paralelo), cada um com
  // a sua pasta de build: NEXT_DIST_DIR=.next-a next dev -p 3101. Padrão: .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
