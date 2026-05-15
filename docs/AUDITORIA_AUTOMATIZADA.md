# Auditoria automatizada de qualidade

Documento humano explicando as checagens automáticas que rodam em toda PR contra `develop`/`main`. Pra resumo curto, ver `AGENTS.md` seção "Auditoria automatizada (CI)".

## Pilares

### 1. Complexidade ciclomática (`complexity`)

Conta caminhos lógicos independentes numa função: cada `if`, `else if`, `case`, `&&`, `||`, `?:`, `catch`, loop adiciona +1. Função com CCN alta = difícil de testar (precisa cobrir N caminhos), difícil de revisar.

- **Threshold:** <= 12 (severidade `warn` em Fase 1; `error` em Fase 2)
- **Ferramenta:** regra built-in do ESLint
- **Fix típico:** extrair sub-função pra ramo do `if`; substituir nested if por early return; usar table lookup ao invés de switch gigante

### 2. Complexidade cognitiva (`sonarjs/cognitive-complexity`)

Variante moderna da CCN proposta pela SonarSource. Penaliza nesting (cada nível de aninhamento aumenta o score), ignora switch flat largo. Mais fiel à "dificuldade real de ler".

- **Threshold:** <= 15 (severidade `warn` em Fase 1; `error` em Fase 2)
- **Ferramenta:** `eslint-plugin-sonarjs`
- **Fix:** mesmas técnicas da CCN, com foco extra em achatar nesting

### 3. Tamanho de arquivo (`max-lines`)

- **Threshold:** <= 500 linhas (skipBlankLines, skipComments). Severidade `warn` em Fase 1; `error` em Fase 2.
- **Excluídos:** `**/*.spec.{ts,tsx}`, `**/*.test.{ts,tsx}`, `**/__fixtures__/**`, `src/components/ui/**` (shadcn gerado)
- **Fix:** quebrar em domínio (`<feature>.actions.ts` + `<feature>-form.tsx` + `<feature>-list.tsx`)

### 4. Tamanho de função (`max-lines-per-function`)

- **Threshold:** <= 80 linhas (severidade `warn` em Fase 1; `error` em Fase 2)
- **Fix:** extrair helpers privados; mover validação pra schema Zod; usar early returns; quebrar componentes grandes em sub-componentes

### 5. Cobertura global (`coverage-gate.ts`)

Lê `coverage/lcov.info` (gerado por `vitest run --coverage`), agrega tudo em um único totals global, compara com thresholds.

**Por que GLOBAL (não per-module) aqui:**

O front tem segmentação fraca por bounded context — a maior parte do código é UI (componentes, pages, layouts) e helpers. Per-module só faria sentido se houvesse pastas bem isoladas tipo `src/modules/<dominio>/`. Sem isso, gate global dá sinal mais limpo.

**Thresholds:**

- **Lines:** >= 50% (default — `AUDIT_LINES_MIN`)
- **Branches:** >= 40% (default — `AUDIT_BRANCHES_MIN`)
- **Mode:** `AUDIT_GATE_MODE` (`warn` default — exit 0 mesmo violando; `error` — exit 1 se violar)

**Arquivos excluídos do cálculo** (sem lógica testável):

- Specs/tests: `*.spec.{ts,tsx}`, `*.test.{ts,tsx}`
- Tipos puros: `*.d.ts`, `src/**/types.ts`
- Componentes UI gerados: `src/components/ui/**`
- Next.js App Router convention files: `layout.tsx`, `page.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`
- Fixtures: `**/__fixtures__/**`, `**/__mocks__/**`

Lista mantida em `vitest.config.ts` (`coverage.exclude`).

**Fix típico pra coverage abaixo do threshold:**

- Identificar funções puras em `src/lib/*` e `src/app/**/actions.ts` (lógica de validação Zod, transforms) sem `*.spec.ts`
- Mover regra de negócio de componentes pra helpers puros e testar lá
- Pra Server Actions: extrair lógica pura, testar a função pura, não a action

**Nota sobre branches:** Vitest v8 coverage emite BRF/BRH normalmente. Se a suíte ainda for pequena, o número pode oscilar — daí o mode `warn` na Fase 1.

### 6. Ciclos de import (`dependency-cruiser` `no-circular`)

Detecta A→B→A. Bug latente: arquivos não podem ser carregados na ordem natural, ESM/bundler resolve com `undefined` em runtime.

- **Threshold:** zero ciclos
- **Severidade:** error desde dia 1 (sem cinza)
- **Fix:** extrair a peça compartilhada pra um terceiro arquivo

### 7. Orphans (`dependency-cruiser` `no-orphans`)

Arquivos sem importadores — código morto provável.

- **Severidade:** warn (informativo)
- **Exceções:** convention files do App Router (`page.tsx`, `layout.tsx`, etc.), configs no root, scripts standalone, fixtures, specs

## Política pra exceções

Casos raros podem precisar de exceção. Use `// eslint-disable-next-line <regra>` ou `/* eslint-disable */` **com TODO datado obrigatório**:

```ts
// TODO(2026-06-01): refatorar pra extrair helpers e remover este disable
// eslint-disable-next-line max-lines-per-function
function bigFunction() { ... }
```

PRs com `eslint-disable` sem TODO datado podem ser rejeitadas em review.

## Reproduzir localmente

### Pipeline completo num único comando (pré-PR check)

```bash
npm run audit:all
```

Roda em sequência (aborta se algo falhar): `lint → typecheck → deps:check → test:coverage → coverage:gate → audit:report`. Se passa local, passa no CI. **Faça isso antes de `git push`.**

### Comandos individuais (debug)

```bash
# Lint completo (inclui novas regras)
npm run lint

# Só checagem de deps
npm run deps:check

# Cobertura + gate
npm run test:coverage
npm run coverage:gate

# Relatório consolidado (igual ao que o bot posta no PR)
npm run audit:report
```

O bot do PR atualiza o comentário marcado com `<!-- audit-report -->` a cada push (não cria duplicados).

## Fases

| Fase | Status | ESLint (complexity/max-lines/cognitive) | coverage-gate | deps:check |
|---|---|---|---|---|
| Fase 1 | **ATUAL** (rollout) | severidade `warn` (não bloqueia merge) | `AUDIT_GATE_MODE=warn` (continue-on-error) | `error` (bloqueante) |
| Fase 2 | futura | severidades sobem pra `error` (bloqueante) | `AUDIT_GATE_MODE=error` (bloqueante) | `error` |
| Fase 3 (futuro) | — | + accessibility rules (`jsx-a11y`) | — | — |

> **Observação:** template está em Fase 1 com ESLint em `warn`, alinhado com os fronts da org (`lyx-contratos-front`, `lyx-bi-principal`, etc.). Como template, cada novo clone nasce com essas regras como `warn` — o owner do front clonado decide quando subir pra `error` (Fase 2) baseado em quanto código legacy acumulou. Ciclos de import já bloqueiam (regra `no-circular` do dependency-cruiser) desde o dia 1.

## Out of scope

- **Mutation testing (Stryker):** out of scope nesta fase. Reabrir como Fase 3 pra módulos críticos rodando weekly/manual.
- **SaaS de qualidade (SonarCloud, Code Climate):** descartado por custo. `lcov.info` é compatível com Codecov free se quiserem ligar depois.
- **Testes E2E (Playwright):** fora deste setup. Quando precisar, adicionar como workflow separado.

## Referências

- Cognitive Complexity (SonarSource paper): https://www.sonarsource.com/resources/cognitive-complexity/
- Vitest docs: https://vitest.dev
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
