/**
 * INTEGRATION TEST exemplo (calc.service.integration.spec.ts).
 *
 * Características:
 * - Roda contra dependência externa SIMULADA (mock de fetch, MSW, etc.)
 * - Mais lento que unit (< 1s)
 * - Testa o CONTRATO com sistema externo (formato da resposta, error handling)
 *
 * Diferença de unit:
 * - Unit testa LÓGICA local (sem I/O)
 * - Integration testa FLUXO completo do consumidor + adapter
 *
 * Roda separado: `npm run test:integration`
 *
 * Doc: docs/TESTING.md
 */
import { describe, it, expect, vi } from "vitest";
import { fetchExchangeRate } from "./calc.service";

describe("calc.service [integration]", () => {
  describe("fetchExchangeRate", () => {
    it("retorna result da API quando 200 OK", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 5.42 }),
      });
      const rate = await fetchExchangeRate("USD", "BRL", mockFetch as unknown as typeof fetch);
      expect(rate).toBe(5.42);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exchangerate.host/convert?from=USD&to=BRL",
      );
    });

    it("lança erro quando API responde non-2xx", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      });
      await expect(
        fetchExchangeRate("USD", "BRL", mockFetch as unknown as typeof fetch),
      ).rejects.toThrow("exchange rate fetch failed: 503");
    });

    it("propaga erro de rede (timeout, DNS)", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(
        fetchExchangeRate("USD", "BRL", mockFetch as unknown as typeof fetch),
      ).rejects.toThrow("ECONNREFUSED");
    });
  });
});
