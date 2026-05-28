/**
 * Exemplo de módulo testável. Use este padrão pra criar novos services no front.
 *
 * - Nome do arquivo: `<feature>.service.ts`
 * - Spec sibling obrigatória: `<feature>.service.spec.ts` (regra lyx/missing-spec)
 * - Para teste de integração (consumindo API externa, DB, etc.):
 *   `<feature>.service.integration.spec.ts`
 *
 * Doc: docs/TESTING.md
 */

export type Item = {
  id: string;
  price: number;
  quantity: number;
};

export type Discount = "vip" | "bulk" | "none";

/**
 * Calcula o total de um pedido aplicando descontos.
 *
 * Regras:
 * - VIP: 20% de desconto no total
 * - Bulk (>= 10 unidades): 10% de desconto no total
 * - Combinação VIP + bulk: 28% (não soma 30 — multiplicativo)
 * - Vazio: retorna 0
 */
export function calculateTotal(items: Item[], discount: Discount = "none"): number {
  if (items.length === 0) return 0;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  let multiplier = 1;
  if (discount === "vip") multiplier *= 0.8;
  if (totalQty >= 10) multiplier *= 0.9;
  return Math.round(subtotal * multiplier * 100) / 100;
}

/**
 * Busca cotação de moeda via API externa. Usado pra demonstrar integration test.
 * Em prod, fetcher injetado por DI; em teste, mockado.
 */
export async function fetchExchangeRate(
  from: string,
  to: string,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const res = await fetcher(`https://api.exchangerate.host/convert?from=${from}&to=${to}`);
  if (!res.ok) throw new Error(`exchange rate fetch failed: ${res.status}`);
  const data = (await res.json()) as { result: number };
  return data.result;
}
