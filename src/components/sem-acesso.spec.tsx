import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SemAcesso } from "./sem-acesso";

describe("sem-acesso", () => {
  describe("SemAcesso", () => {
    it("explica que o login vale mas falta membership, com link pro Hub", () => {
      const html = renderToStaticMarkup(
        <SemAcesso motivo="sem-acesso" hubUrl="https://hub.lyxai.com.br" />,
      );
      expect(html).toContain("não é membro deste sistema");
      expect(html).toContain('href="https://hub.lyxai.com.br"');
    });

    it("em erro de verificação não afirma que falta acesso", () => {
      const html = renderToStaticMarkup(<SemAcesso motivo="erro" hubUrl="http://localhost:3002" />);
      expect(html).toContain("Não foi possível verificar seu acesso");
      expect(html).not.toContain("não é membro");
      expect(html).toContain('href="http://localhost:3002"');
    });
  });
});
