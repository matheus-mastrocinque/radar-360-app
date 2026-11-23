"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/** Botão de formulário que mostra o estado de envio (server actions). */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: Omit<ButtonProps, "type"> & { pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
