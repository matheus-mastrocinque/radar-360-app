"use client";

import { useEffect } from "react";
import { takeArrival } from "./arrival";

/** Ao chegar de um formulário do copiloto: vai para o topo do plano ou para a notificação LGPD (#lgpd). */
export function PlanArrival() {
  useEffect(() => {
    // A marca é consumida dentro do frame: se o efeito for desmontado antes (modo estrito), ela continua lá.
    const frame = requestAnimationFrame(() => {
      const target = takeArrival();
      if (!target) return;
      const lgpd = target === "lgpd" ? document.getElementById("lgpd") : null;
      if (lgpd) {
        lgpd.scrollIntoView({ block: "start", behavior: "instant" });
        window.history.replaceState(window.history.state, "", "#lgpd");
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
