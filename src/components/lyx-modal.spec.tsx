// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LyxModal } from "./lyx-modal";

function abrir(onClose = vi.fn()) {
  const tela = render(
    <LyxModal open onClose={onClose} title="Diálogo de teste" footer={<button type="button">Ok</button>}>
      <input aria-label="primeiro campo" data-foco-inicial />
    </LyxModal>,
  );
  return { onClose, ...tela };
}

const botoesDeFora: HTMLElement[] = [];

/** Um botão fora do diálogo, com o foco: é quem "abriu" o diálogo. */
function focarBotaoDeFora() {
  const botao = document.createElement("button");
  document.body.appendChild(botao);
  botao.focus();
  botoesDeFora.push(botao);
  return botao;
}

// Só o que o spec criou: o resto do body é do testing-library, que desmonta sozinho.
afterEach(() => {
  for (const botao of botoesDeFora.splice(0)) botao.remove();
});

describe("LyxModal", () => {
  it("fechado não aparece", () => {
    render(
      <LyxModal open={false} onClose={vi.fn()} title="Fechado">
        <p>conteúdo</p>
      </LyxModal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc, o X e o clique no fundo fecham; o clique dentro não", () => {
    const { onClose } = abrir();
    expect(screen.getByRole("dialog", { name: "Diálogo de teste" })).toBeTruthy();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("o foco entra no campo marcado, o Tab fica preso no diálogo e o foco volta ao fechar", () => {
    const antes = focarBotaoDeFora();

    const { unmount } = abrir();
    expect(document.activeElement).toBe(screen.getByLabelText("primeiro campo"));
    expect(document.body.style.overflow).toBe("hidden");

    screen.getByRole("button", { name: "Ok" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ok" }));

    unmount();
    expect(document.activeElement).toBe(antes);
    expect(document.body.style.overflow).toBe("");
  });

  it("sem campo marcado, o foco vai para o próprio diálogo", () => {
    render(
      <LyxModal open onClose={vi.fn()} title="Sem marca">
        <p>só texto</p>
      </LyxModal>,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("montado sempre, com open alternando: o foco volta a quem abriu, mesmo com autoFocus dentro", () => {
    const tela = (open: boolean) => (
      <LyxModal open={open} onClose={vi.fn()} title="Alternado">
        <input aria-label="campo" autoFocus />
      </LyxModal>
    );
    const { rerender } = render(tela(false));
    const quemAbriu = focarBotaoDeFora();

    rerender(tela(true));
    expect(document.activeElement).toBe(screen.getByLabelText("campo"));

    rerender(tela(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(quemAbriu);
    expect(document.body.style.overflow).toBe("");
  });

  it("o onClose novo de cada render é o que o Esc chama, sem roubar o foco de quem digita", () => {
    const primeiro = vi.fn();
    const segundo = vi.fn();
    const tela = (onClose: () => void) => (
      <LyxModal open onClose={onClose} title="Troca">
        <input aria-label="campo" data-foco-inicial />
      </LyxModal>
    );
    const { rerender } = render(tela(primeiro));
    const campo = screen.getByLabelText("campo");

    rerender(tela(segundo));
    expect(document.activeElement).toBe(campo);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(primeiro).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});
