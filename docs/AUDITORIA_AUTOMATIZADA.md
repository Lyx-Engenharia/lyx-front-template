# Auditoria automatizada de qualidade

Documento humano explicando as checagens automáticas que o `lyx-audit.yml` roda em toda PR dos fronts contra `main`. Pra resumo curto, ver o [`README.md`](../README.md). As regras de ESLint e o gate de cobertura vêm do pacote [`@lyxai/front-audit`](../packages/front-audit/).

## Pilares

### 1. Complexidade ciclomática (`complexity`)

Conta caminhos lógicos independentes numa função: cada `if`, `else if`, `case`, `&&`, `||`, `?:`, `catch`, loop adiciona +1. Função com CCN alta = difícil de testar (precisa cobrir N caminhos), difícil de revisar.

- **Threshold:** <= 12 (severidade `error`, bloqueia merge)
- **Ferramenta:** regra built-in do ESLint
- **Fix típico:** extrair sub-função pra ramo do `if`; substituir nested if por early return; usar table lookup ao invés de switch gigante

### 2. Complexidade cognitiva (`sonarjs/cognitive-complexity`)

Variante moderna da CCN proposta pela SonarSource. Penaliza nesting (cada nível de aninhamento aumenta o score), ignora switch flat largo. Mais fiel à "dificuldade real de ler".

- **Threshold:** <= 15 (severidade `error`, bloqueia merge)
- **Ferramenta:** `eslint-plugin-sonarjs`
- **Fix:** mesmas técnicas da CCN, com foco extra em achatar nesting

### 3. Tamanho de arquivo (`max-lines`)

- **Threshold:** <= 500 linhas (skipBlankLines, skipComments). Severidade `error`, bloqueia merge.
- **Excluídos:** `**/*.spec.{ts,tsx}`, `**/*.test.{ts,tsx}`, `**/__fixtures__/**`, `src/components/ui/**` (shadcn gerado)
- **Fix:** quebrar em domínio (`<feature>.actions.ts` + `<feature>-form.tsx` + `<feature>-list.tsx`)

### 4. Tamanho de função (`max-lines-per-function`)

- **Threshold:** <= 80 linhas (severidade `error`, bloqueia merge)
- **Fix:** extrair helpers privados; mover validação pra schema Zod; usar early returns; quebrar componentes grandes em sub-componentes

### 5. Cobertura global (`lyx-coverage-gate`)

Lê `coverage/lcov.info` (gerado por `vitest run --coverage`), agrega tudo em um único totals global, compara com thresholds.

**Por que GLOBAL (não per-module) aqui:**

O front tem segmentação fraca por bounded context — a maior parte do código é UI (componentes, pages, layouts) e helpers. Per-module só faria sentido se houvesse pastas bem isoladas tipo `src/modules/<dominio>/`. Sem isso, gate global dá sinal mais limpo.

**Thresholds:**

- **Lines:** >= 75% (input `coverage-lines` do reusable, env `AUDIT_LINES_MIN`)
- **Branches:** >= 40% (input `coverage-branches`, env `AUDIT_BRANCHES_MIN`)
- **Mode:** `AUDIT_GATE_MODE`: `error` (padrão) sai 1 se violar; `warn` sai 0 mesmo violando

**Arquivos excluídos do cálculo** (sem lógica testável):

- Specs/tests: `*.spec.{ts,tsx}`, `*.test.{ts,tsx}`
- Tipos puros: `*.d.ts`, `src/**/types.ts`
- Componentes UI gerados: `src/components/ui/**`
- Next.js App Router convention files: `layout.tsx`, `page.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`
- Fixtures: `**/__fixtures__/**`, `**/__mocks__/**`

Lista base: `lyxCoverageExclude`, do `@lyxai/front-audit`, espalhada no `coverage.exclude` do `vitest.config.ts` do front (modelo em [`consumidor/vitest.config.ts`](../consumidor/vitest.config.ts)).

**Na PR (catraca, padrão do `lyx-audit.yml`):** este gate do repo inteiro vira informativo, e quem barra a PR é a catraca: global que sai do mínimo (ou, em repo com dívida, cai mais de 0,1 ponto) e erro de lint novo. O arquivo que a PR cria ou altera abaixo do mínimo aparece como aviso; barra só com `coverage-files-gate: error`. Detalhe em [`TESTING.md`](TESTING.md#catraca-na-pr-padrão).

**Fix típico pra coverage abaixo do threshold:**

- Identificar funções puras em `src/lib/*` e `src/app/**/actions.ts` (lógica de validação Zod, transforms) sem `*.spec.ts`
- Mover regra de negócio de componentes pra helpers puros e testar lá
- Pra Server Actions: extrair lógica pura, testar a função pura, não a action

**Nota sobre branches:** Vitest v8 coverage emite BRF/BRH normalmente. Se a suíte ainda for pequena, o número pode oscilar.

### 6. Ciclos de import (`dependency-cruiser` `no-circular`)

Detecta A→B→A. Bug latente: arquivos não podem ser carregados na ordem natural, ESM/bundler resolve com `undefined` em runtime.

- **Threshold:** zero ciclos
- **Severidade:** error desde dia 1 (sem cinza)
- **Fix:** extrair a peça compartilhada pra um terceiro arquivo

### 7. Orphans (`dependency-cruiser` `no-orphans`)

Arquivos sem importadores — código morto provável.

- **Severidade:** warn (informativo)
- **Exceções:** convention files do App Router (`page.tsx`, `layout.tsx`, etc.), configs no root, scripts standalone, fixtures, specs

### 8. Conferência do lume (só repo que adotou o lume)

O lume é o design system dos fronts (registry do shadcn em `joaodadas/lume`). O passo `lume: conferência` roda só quando o front tem `lume.json` na raiz ou um `components.json` que contém `joaodadas/lume` ou `lume-ashmont`. Sem o marcador, o passo diz que pulou e passa.

- **Comando:** `npx -y @joaodadas/lume@^0 check`. Sai 0 com tudo certo e 1 com violação, e o relatório por regra fica no log do passo.
- **Severidade:** entra no status final como `lume` (`Falhas: lume`), como os outros checks: barra em `gate-mode: error` e é informativa em `warn`.

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

A Fase 1 (regras em `warn`) e a Fase 2 (tudo em `error`) já passaram. Hoje complexity, cognitive, max-lines, max-lines-per-function e `lyx/missing-spec` estão em `error` no `@lyxai/front-audit`, o gate de cobertura sai com `gate-mode: error` por padrão e ciclos de import bloqueiam. Na PR vale a catraca ([`TESTING.md`](TESTING.md#catraca-na-pr-padrão)). A camada do `@lyxai/front-audit` não liga regras de acessibilidade (`jsx-a11y`), que eram a Fase 3 da tabela antiga.

## Out of scope

- **Mutation testing (Stryker):** out of scope nesta fase. Reabrir como Fase 3 pra módulos críticos rodando weekly/manual.
- **SaaS de qualidade (SonarCloud, Code Climate):** descartado por custo. `lcov.info` é compatível com Codecov free se quiserem ligar depois.
- **Testes E2E (Playwright):** fora deste setup. Quando precisar, adicionar como workflow separado.

## Referências

- Cognitive Complexity (SonarSource paper): https://www.sonarsource.com/resources/cognitive-complexity/
- Vitest docs: https://vitest.dev
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
