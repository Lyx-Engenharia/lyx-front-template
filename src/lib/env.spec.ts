import { describe, it, expect } from "vitest";
import { API_URL, HUB_URL, ORG_SLUG, valorPublico } from "./env";

const padrao = { prod: "https://api.lyxai.com.br", dev: "http://localhost:3000" };

describe("env", () => {
  describe("valorPublico", () => {
    it("usa o valor da variável quando ela veio no build", () => {
      expect(valorPublico("https://outra.api", padrao, true)).toBe("https://outra.api");
    });

    it("string vazia (ARG ausente no Docker) cai no fallback de produção", () => {
      expect(valorPublico("", padrao, true)).toBe("https://api.lyxai.com.br");
    });

    it("variável ausente em produção cai na URL canônica, nunca no localhost", () => {
      expect(valorPublico(undefined, padrao, true)).toBe("https://api.lyxai.com.br");
    });

    it("variável ausente fora de produção cai no default de dev", () => {
      expect(valorPublico(undefined, padrao, false)).toBe("http://localhost:3000");
    });
  });

  describe("constantes", () => {
    it("resolvem sempre pra string não vazia", () => {
      expect(API_URL).not.toBe("");
      expect(HUB_URL).not.toBe("");
      expect(ORG_SLUG).not.toBe("");
    });
  });
});
