"use client";

import { markArrival, type ArrivalTarget } from "./arrival";

/**
 * Formulário que abre um plano (server action com redirect) e marca para onde rolar ao chegar.
 * Use em qualquer tela que leve ao plano: sem a marca, o plano abre na rolagem da página anterior.
 */
export function ArrivalForm({
  action,
  target = "top",
  className,
  children,
}: {
  action: () => Promise<void>;
  target?: ArrivalTarget;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} onSubmit={() => markArrival(target)} className={className}>
      {children}
    </form>
  );
}
