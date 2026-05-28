/**
 * UNIT TEST exemplo (calc.service.spec.ts).
 *
 * Características:
 * - Roda contra função pura — sem I/O, sem mocks pesados
 * - Rápido (< 100ms)
 * - Cobre regras de negócio: cenários nominais + edge cases
 *
 * Padrão recomendado:
 * - `describe('<arquivo>')` no topo
 * - `describe('<função>')` por função
 * - `it('cenário concreto')` — cenário descritivo, NÃO "works"
 *
 * Doc: docs/TESTING.md
 */
import { describe, it, expect } from "vitest";
import { calculateTotal, type Item } from "./calc.service";

describe("calc.service", () => {
  describe("calculateTotal", () => {
    it("retorna 0 pra carrinho vazio", () => {
      expect(calculateTotal([])).toBe(0);
    });

    it("calcula subtotal sem desconto", () => {
      const items: Item[] = [
        { id: "a", price: 100, quantity: 2 },
        { id: "b", price: 50, quantity: 1 },
      ];
      expect(calculateTotal(items)).toBe(250);
    });

    it("aplica 20% de desconto VIP", () => {
      const items: Item[] = [{ id: "a", price: 100, quantity: 1 }];
      expect(calculateTotal(items, "vip")).toBe(80);
    });

    it("aplica 10% de desconto bulk (qty >= 10)", () => {
      const items: Item[] = [{ id: "a", price: 10, quantity: 10 }];
      expect(calculateTotal(items, "none")).toBe(90);
    });

    it("VIP + bulk = 28% combinado (multiplicativo, NÃO 30%)", () => {
      const items: Item[] = [{ id: "a", price: 100, quantity: 10 }];
      // subtotal=1000 * 0.8 (vip) * 0.9 (bulk) = 720
      expect(calculateTotal(items, "vip")).toBe(720);
    });

    it("arredonda pra 2 casas decimais", () => {
      const items: Item[] = [{ id: "a", price: 33.33, quantity: 3 }];
      expect(calculateTotal(items)).toBe(99.99);
    });
  });
});
