"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

const FOCAVEIS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab e Shift+Tab circulam entre o primeiro e o último elemento focável do diálogo. */
function prenderTab(e: KeyboardEvent, el: HTMLElement) {
  const focaveis = Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS));
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  const ativo = document.activeElement;
  if (!primeiro || !ultimo) {
    e.preventDefault();
  } else if (e.shiftKey && (ativo === primeiro || ativo === el)) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && (ativo === ultimo || !el.contains(ativo))) {
    e.preventDefault();
    primeiro.focus();
  }
}

function focoAtual(): HTMLElement | null {
  return typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null);
}

/**
 * Onde estava o foco quando o diálogo abriu. É lido no render em que `open` vira
 * `true`, antes de um `autoFocus` de dentro do diálogo mover o foco (num efeito,
 * já seria tarde). Vale para os dois jeitos de usar: montado sempre, com `open`
 * alternando, ou montado já aberto (`{aberto && <LyxModal open ... />}`).
 */
function useFocoDeAntes(open: boolean): HTMLElement | null {
  const [estavaAberto, setEstavaAberto] = useState(false);
  const [foco, setFoco] = useState<HTMLElement | null>(null);
  if (open !== estavaAberto) {
    setEstavaAberto(open);
    if (open) setFoco(focoAtual());
  }
  return foco;
}

/**
 * O foco do diálogo aberto: entra no elemento marcado com `data-foco-inicial`
 * (ou no próprio diálogo), fica preso no Tab, o Esc fecha, e ao fechar volta
 * para onde estava. É o que o `aria-modal` promete ao leitor de tela.
 *
 * O `onClose` das telas costuma mudar a cada render: ele vai por ref, senão o
 * efeito devolveria o foco para fora a cada tecla digitada dentro do diálogo.
 */
function useFocoPreso(open: boolean, caixa: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const fechar = useRef(onClose);
  const focoAnterior = useFocoDeAntes(open);

  useEffect(() => {
    fechar.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const el = caixa.current;
    const inicial = el?.querySelector<HTMLElement>("[data-foco-inicial]");
    if (inicial) inicial.focus();
    else if (el && !el.contains(document.activeElement)) el.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar.current();
      else if (e.key === "Tab" && el) prenderTab(e, el);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      focoAnterior?.focus?.();
    };
  }, [open, caixa, focoAnterior]);
}

export function LyxModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}) {
  const idDoTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  useFocoPreso(open, caixa, onClose);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div className="lyx-modal-overlay" onClick={onClose}>
      <div
        ref={caixa}
        className="lyx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        tabIndex={-1}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lyx-modal-header">
          <h3 id={idDoTitulo} className="lyx-modal-title">{title}</h3>
          <button
            className="theme-toggle-minimal"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="lyx-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
