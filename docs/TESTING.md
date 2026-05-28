# Como escrever testes na Lyx

> Doc canônica de testes. Vale pra **todos os repos Lyx** (monolito, fronts, BIs). Cada repo importa o reusable workflow `lyx-audit.yml` que aplica as regras descritas aqui.

## Por que testar

Tu vai escrever código que **outras pessoas vão mexer**. Sem teste, qualquer alteração futura pode quebrar comportamento que tu garantiu. Teste = documentação executável do que o código DEVE fazer.

Na Lyx, **teste é obrigatório**:
- Coverage gate de **75% lines / 40% branches** por repo (regra `error` — bloqueia merge se violar)
- Todo `*.service.ts` e `*.controller.ts` precisa de `*.spec.ts` sibling (regra ESLint `lyx/missing-spec`)
- CI roda em cada PR (`pr.yml` importa `lyx-audit.yml` do template)

## Os 3 tipos de teste

Cada tipo cobre um nível diferente. Pensa em camadas:

```
┌─────────────────────────┐
│  SMOKE (pós-deploy)     │  ← curl/Playwright contra app real em prod/preview
├─────────────────────────┤
│  INTEGRATION (PR)       │  ← function + dep externa (fetch mock, DB, etc)
├─────────────────────────┤
│  UNIT (PR)              │  ← function pura, mocks pesados
└─────────────────────────┘
```

### 1. Unit test (`*.spec.ts`)

**O que testa:** lógica pura. Função recebe X, retorna Y. Zero I/O.

**Quando escrever:** sempre que houver decisão (if/switch), cálculo, transformação. Cada caminho da função = 1 caso de teste.

**Como roda:** `npm run test:unit` (ou `npm test` que roda tudo).

**Exemplo canônico:** [`src/lib/example/calc.service.spec.ts`](../src/lib/example/calc.service.spec.ts)

```ts
import { describe, it, expect } from "vitest";
import { calculateTotal } from "./calc.service";

describe("calc.service", () => {
  describe("calculateTotal", () => {
    it("retorna 0 pra carrinho vazio", () => {
      expect(calculateTotal([])).toBe(0);
    });

    it("VIP + bulk = 28% combinado (multiplicativo, NÃO 30%)", () => {
      const items = [{ id: "a", price: 100, quantity: 10 }];
      expect(calculateTotal(items, "vip")).toBe(720);
    });
  });
});
```

**Regras:**
- `describe('<arquivo>')` no topo, `describe('<função>')` por função
- `it('cenário descritivo')` — NÃO `it('works')`
- 1 `expect` central por teste (vários OK se exercitam o mesmo cenário)
- Sem mock de fetch/DB/network — se precisar, é integration

### 2. Integration test (`*.integration.spec.ts`)

**O que testa:** fluxo do consumidor com dependência EXTERNA simulada.

**Quando escrever:**
- Função chama `fetch` → testa que envia URL/headers corretos + parsea response certo
- Função chama auth client → testa que envia cookie + lida com 401
- Hook usa TanStack Query → testa que cachéia resposta corretamente

**Como roda:** `npm run test:integration` (ou `npm test`).

**Como roda separado do unit:** `vitest.workspace.ts` define 2 projects (`unit` + `integration`) baseado no sufixo do nome do arquivo (`.spec.ts` vs `.integration.spec.ts`).

**Exemplo canônico:** [`src/lib/example/calc.service.integration.spec.ts`](../src/lib/example/calc.service.integration.spec.ts)

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchExchangeRate } from "./calc.service";

describe("calc.service [integration]", () => {
  it("retorna result da API quando 200 OK", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 5.42 }),
    });
    const rate = await fetchExchangeRate("USD", "BRL", mockFetch);
    expect(rate).toBe(5.42);
  });

  it("lança erro quando API responde non-2xx", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchExchangeRate("USD", "BRL", mockFetch))
      .rejects.toThrow("exchange rate fetch failed: 503");
  });
});
```

**Regras:**
- Inject the dependency (recebe `fetcher = fetch` como param). Permite mockar sem `vi.spyOn(global, 'fetch')`.
- Mock **só do que sai do processo** (fetch, db, smtp). Lógica interna NÃO mocka.
- Testa contrato (formato URL, formato response, error codes).

### 3. Smoke test (pós-deploy)

**O que testa:** o app está vivo e fluxo crítico funciona em ambiente real.

**Quando escrever:** rota crítica de cada repo. Login, dashboard principal, fluxo de pagamento.

**Como roda:** workflow separado (`smoke-after-deploy.yml`) — roda DEPOIS do deploy via `workflow_run`. NÃO bloqueia PR.

**Exemplo (sketch — fica pra task separada):**
```yaml
on:
  workflow_run:
    workflows: ["Deploy"]
    types: [completed]
jobs:
  smoke:
    steps:
      - run: curl -fsS https://distribuidor.lyxai.com.br/api/health
      - run: npx playwright test --grep @smoke
```

Smoke test **NÃO entra no coverage gate** — é signal complementar, não substitui unit/integration.

## Estrutura de pastas

Sempre **co-locate** o spec com o código testado:

```
src/lib/example/
  calc.service.ts                       ← código
  calc.service.spec.ts                  ← unit (mesma pasta)
  calc.service.integration.spec.ts      ← integration (mesma pasta)
```

Justificativa: mover arquivo = mover spec junto. Sem orfanizar.

Fixtures compartilhadas (se houver):
```
src/lib/example/__fixtures__/items.ts
```

## Regra ESLint `lyx/missing-spec`

Todo `*.service.ts` e `*.controller.ts` precisa de `*.spec.ts` sibling. ESLint quebra o build se faltar:

```
error: Faltando spec sibling: src/services/users.service.spec.ts
```

**Por quê?** Reviewer humano esquece. Lint não.

**Como justificar exceção:** raro. Se for genuinamente desnecessário (ex: file só com `export const X = 1`), renomeia pra `users.constants.ts` ao invés de `users.service.ts`.

## Coverage gate

CI roda `npm run test:coverage` → gera `coverage/lcov.info` → `coverage-gate.ts` valida:

- **Lines ≥ 75%** (mínimo)
- **Branches ≥ 40%** (mínimo)
- **Mode: error** (bloqueia merge)

Ajustável por repo via `with:` no `pr.yml`:

```yaml
uses: Lyx-Engenharia/lyx-front-template/.github/workflows/lyx-audit.yml@main
with:
  coverage-lines: 75       # default
  coverage-branches: 40    # default
  gate-mode: error         # default
```

Arquivos **excluídos** do coverage (não contam pro denominator):
- `*.d.ts`, `*.spec.ts`, `__fixtures__/**`, `__mocks__/**`
- `src/components/ui/**` (shadcn — gerado por CLI)
- `src/app/**/{layout,loading,error,not-found,page}.tsx` (Server Components — testar via integration ou e2e)
- `src/**/types.ts`

Ver `vitest.config.ts` pra lista completa.

## Comandos canônicos

| Comando | O que faz |
|---|---|
| `npm test` | Roda unit + integration |
| `npm run test:unit` | Só unit (rápido) |
| `npm run test:integration` | Só integration |
| `npm run test:watch` | Watch mode (dev) |
| `npm run test:coverage` | Roda tudo + gera coverage |
| `npm run coverage:gate` | Valida thresholds (após `test:coverage`) |
| `npm run audit:all` | Pipeline completo (lint + typecheck + deps + tests + coverage + report) |

## Anti-patterns que o CI vai pegar

1. **`it('works', ...)`** — descrição genérica. Use cenário concreto.
2. **Função sem teste correspondente** — lint `lyx/missing-spec` quebra.
3. **Mock de função interna do mesmo módulo** — testa o mock, não o código.
4. **Spec gigante (>500 linhas)** — split por cenário (`describe`).
5. **Coverage de teste de UI quando podia ser unit** — testa lógica em util/hook puro, não no componente.

## Como me convencer que cobertura está OK

Não está. Coverage de 75% lines com asserts ruins (`expect(x).toBeDefined()`) é **pior** que 50% com asserts bons (`expect(x).toEqual({ id: '...', ... })`). O gate é mínimo necessário — não é o teto.

## Quando perguntar

- "Tem que testar render?" — só se tiver lógica (state, effect). Componente puro só recebe props → não precisa.
- "Posso mockar service interno?" — não em service spec. Pode em controller spec (raso, 1-2 linhas) pra testar wiring.
- "Spec do hook precisa?" — sim se o hook tem lógica (não é só re-export). Use `@testing-library/react-hooks`.

## Referência

- [`src/lib/example/calc.service.ts`](../src/lib/example/calc.service.ts) — código
- [`src/lib/example/calc.service.spec.ts`](../src/lib/example/calc.service.spec.ts) — unit
- [`src/lib/example/calc.service.integration.spec.ts`](../src/lib/example/calc.service.integration.spec.ts) — integration
- [`vitest.workspace.ts`](../vitest.workspace.ts) — config dos projects
- [`eslint-plugin-lyx-rules/missing-spec.js`](../eslint-plugin-lyx-rules/missing-spec.js) — regra
- [`scripts/audit/coverage-gate.ts`](../scripts/audit/coverage-gate.ts) — gate
- [`.github/workflows/lyx-audit.yml`](../.github/workflows/lyx-audit.yml) — reusable workflow
