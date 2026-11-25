"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Gaveta de detalhes da central de comando. Os painéis são renderizados no servidor e chegam aqui por
 * chave; qualquer item clicável do painel (nó do mapa, ação da fila, evento da linha do tempo) abre a
 * gaveta com `InspectTrigger`. Dentro da gaveta, abrir outro painel empilha e mostra "Voltar".
 *
 * Usa o <dialog> nativo em modo modal: prende o foco, fecha com Esc e devolve o foco a quem abriu.
 */

export interface InspectorPanel {
  eyebrow: string;
  title: string;
  content: React.ReactNode;
}

interface InspectorApi {
  open: (key: string) => void;
}

const InspectorContext = createContext<InspectorApi | null>(null);

export function InspectorProvider({
  panels,
  children,
}: {
  panels: Record<string, InspectorPanel>;
  children: React.ReactNode;
}) {
  const [stack, setStack] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const current = stack.length > 0 ? stack[stack.length - 1] : null;
  const panel = current ? panels[current] : undefined;

  const open = useCallback(
    (key: string) => {
      if (!panels[key]) return;
      if (dialogRef.current?.open) {
        setStack((previous) => (previous[previous.length - 1] === key ? previous : [...previous, key]));
        return;
      }
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setStack([key]);
    },
    [panels],
  );

  const close = useCallback(() => dialogRef.current?.close(), []);
  const back = useCallback(() => setStack((previous) => previous.slice(0, -1)), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (current && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!current && dialog.open) {
      dialog.close();
    }
    bodyRef.current?.scrollTo({ top: 0 });
  }, [current]);

  // Se a página sair com a gaveta aberta (o botão do plano navega), a rolagem volta ao normal.
  useEffect(() => () => void (document.documentElement.style.overflow = ""), []);

  function handleClose() {
    document.documentElement.style.overflow = "";
    setStack([]);
    returnFocus.current?.focus({ preventScroll: true });
    returnFocus.current = null;
  }

  const api = useMemo(() => ({ open }), [open]);

  return (
    <InspectorContext.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="inspetor-titulo"
        onClose={handleClose}
        onClick={(event) => {
          // Clique fora da gaveta (no fundo escurecido) fecha.
          if (event.target === event.currentTarget) close();
        }}
        className={cn(
          "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[600px] overflow-hidden bg-background p-0 text-foreground",
          "border-l border-white/10 shadow-[-24px_0_64px_-24px_rgb(0_0_0/0.9)]",
          "backdrop:bg-black/65 backdrop:backdrop-blur-[2px] open:motion-safe:animate-drawer-in",
        )}
      >
        {panel && (
          <div className="relative flex h-full flex-col">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(500px_160px_at_30%_0%,color-mix(in_oklab,var(--crimson)_14%,transparent),transparent)]"
              aria-hidden
            />
            <header className="relative flex items-start gap-3 border-b border-white/[0.07] px-5 py-4">
              {stack.length > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-1 ring-white/10 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  <span className="sr-only">Voltar</span>
                </button>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="eyebrow text-rubi">{panel.eyebrow}</span>
                <h2 id="inspetor-titulo" className="text-lg leading-snug font-semibold tracking-tight">
                  {panel.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-1 ring-white/10 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Fechar</span>
              </button>
            </header>
            <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {panel.content}
            </div>
          </div>
        )}
      </dialog>
    </InspectorContext.Provider>
  );
}

/** Botão que abre um painel da gaveta. Sem o provider (não deveria acontecer), não faz nada. */
export function InspectTrigger({
  target,
  label,
  className,
  style,
  children,
}: {
  target: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const inspector = useContext(InspectorContext);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={() => inspector?.open(target)}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
