# Fluxo de desenvolvimento — lyx-front-template

> **Público:** dev novo no time, dev voltando ao projeto, AI/agente lendo pra entender.
> Resumo: `feat/*` → PR contra `develop` → 1 approve + CI verde → merge. Quando estável, PR `develop → main` → baseline nova do template publicada.
>
> **Contexto:** este é um **repo template** (não tem deploy próprio). Devs clonam via `npx degit Lyx-Engenharia/lyx-front-template <novo-projeto>` pra começar um novo front que consome o monolito. Mudanças neste repo sobem a baseline pra próximos clones — fronts já clonados precisam pull manual se quiserem deltas.

---

## Visão geral em 30 segundos

Modelo de branches:

```
main      <--- baseline estável do template (devs clonam daqui via degit)
  ^
  | PR (precisa 1 approve + CI verde)
  |
develop   <--- branch de integração (default; novas PRs caem aqui)
  ^
  | PR (precisa 1 approve + CI verde)
  |
feat/*    <--- sua branch local de feature
```

Fluxo:

```
1. Cria branch local (feat/<nome>) a partir de develop  ->  você
2. Codifica + roda local                                 ->  você
3. Antes de pushar: npm run audit:all                    ->  você
4. Abre PR de feat/<nome> -> develop                     ->  você
5. CI valida (pr.yml: lint + typecheck + tests + deps)   ->  GitHub Actions
6. Bot posta relatório consolidado (audit-report.yml)    ->  GitHub Actions
7. Review aprova (1 approve obrigatório)                 ->  outra pessoa do time
8. Merge em develop                                       ->  você (ou auto-merge)
9. Quando estiver pronto pra publicar baseline: PR develop -> main -> você
10. Review aprova de novo                                 ->  outra pessoa
11. Merge em main                                         ->  baseline atualizada
```

---

## O ciclo passo-a-passo

### Passo 1 — Crie sua branch a partir de `develop`

```bash
git fetch origin
git checkout develop
git pull
git checkout -b feat/dashboard-filtros
```

Convenção de nome: `feat/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`.

**Importante:** sempre saia de `develop`, não de `main`. `main` representa o estado de prod; `develop` é integração ativa.

### Passo 2 — Suba o ambiente local

Se for a primeira vez no projeto:

```bash
cp .env.example .env.local  # ajuste NEXT_PUBLIC_API_URL se preciso
npm install
npm run dev
```

`npm run dev` faz `next dev -p 3001` (o monolito usa :3000, então o front fica em :3001 pra não colidir).

Default `NEXT_PUBLIC_API_URL` aponta pra `http://localhost:3000` (monolito local). Pra apontar pra monolito prod: `NEXT_PUBLIC_API_URL=https://api.lyxai.com.br`.

### Passo 3 — Codifique a feature

Edite o que precisar em `src/`. Convenções:

- **Pages do App Router:** `src/app/<rota>/page.tsx` (Server Component default)
- **Server Actions:** `src/app/<rota>/actions.ts` com `'use server'`
- **Componentes de feature:** `src/components/<feature>.tsx`
- **Helpers puros:** `src/lib/<nome>.ts`
- **Hooks:** `src/hooks/<nome>.ts`

### Passo 4 — Adicione testes (regra TDD pra código novo)

Todo helper novo em `src/lib/*` ou função pura em `src/app/**/actions.ts` deve ter `*.spec.ts` correspondente no mesmo PR.

Pattern de teste com Vitest:

```ts
import { describe, it, expect } from 'vitest';
import { meuHelper } from './meu-helper';

describe('meuHelper', () => {
  it('retorna X quando input é Y', () => {
    expect(meuHelper(input)).toBe(expected);
  });
});
```

Pra componentes que precisam de DOM, vitest já vem com jsdom. Pra hooks/components com efeitos colaterais, adicione `@testing-library/react` quando precisar (não vem por default neste setup).

### Passo 5 — Pré-PR check (auditoria local)

Antes de pushar, valide local com o mesmo conjunto de regras que o CI vai aplicar:

```bash
npm run audit:all
```

Roda em sequência (aborta se algo falhar):

- `lint` — complexity <= 12, cognitive <= 15, max-lines <= 500 (arquivo), max-lines-per-function <= 80
- `typecheck` — tsc --noEmit
- `deps:check` — ciclos de import
- `test:coverage` — vitest com lcov
- `coverage:gate` — gate global 50% (Fase 1: warn)
- `audit:report` — gera markdown idêntico ao comentário que o bot vai postar no PR

Se passa local, passa no CI. Detalhe das métricas: [`docs/AUDITORIA_AUTOMATIZADA.md`](AUDITORIA_AUTOMATIZADA.md).

### Passo 6 — Commit + push

```bash
git add .
git commit -m "feat(dashboard): adiciona filtros por status de validação"
git push -u origin feat/dashboard-filtros
```

### Passo 7 — Abra o PR contra `develop`

Pelo GitHub UI ou:

```bash
gh pr create --base develop --fill
```

(Como `develop` é a default branch, `--base develop` pode ser omitido — `gh pr create --fill` já cai aí.)

### Passo 8 — Espere o CI ficar verde

Quando você abre PR contra `main` ou `develop`, dois workflows disparam:

**`.github/workflows/pr.yml`:**

1. Faz checkout do código
2. Instala Node + dependências (`npm ci`)
3. Roda `npm run lint` (ESLint) — qualquer erro de estilo trava o PR
4. Roda `npm run typecheck` (TypeScript strict) — qualquer erro de tipo trava o PR
5. Roda `npm run test:coverage` (Vitest)
6. Roda `npm run coverage:gate` (warn — não trava em Fase 1)
7. Roda `npm run deps:check` (error — ciclos travam)
8. Sobe `coverage/` como artifact
9. Roda `npm run sync-agents` e checa se `CLAUDE.md`/`.cursorrules`/`.github/copilot-instructions.md` estão sincronizados com `AGENTS.md`

**`.github/workflows/audit-report.yml`:**

1. Gera `audit/eslint.json` e `audit/depcruise.json`
2. Roda coverage gate
3. Gera `audit/report.md` consolidado
4. Posta/atualiza um único comentário no PR (marker `<!-- audit-report -->`)

Tudo verde -> PR pronto pra review.
Algum step vermelho -> você corrige local, push de novo, CI roda novamente.

### Passo 9 — Review

Outra pessoa revisa código. Comentários inline, mudanças solicitadas, etc.

### Passo 10 — Merge em `develop`

Quando aprovada (1 approve mínimo) e CI verde, mergeie. Padrão recomendado: **Squash and merge** (1 commit limpo em develop por feature).

Aqui sua feature está em `develop` mas **ainda NÃO virou baseline pública do template**. Develop é integração — pra ir pra `main` (de onde clones vão pegar) precisa de mais um PR.

### Passo 11 — Promova `develop` → `main`

Quando develop estiver estável (sua feature + outras que mergearam) e quiser publicar como nova baseline do template:

```bash
gh pr create --base main --head develop --title "release: <descrição do batch>" --body "PRs incluídas: ..."
```

Esse PR também precisa **1 approve + CI verde**.

### Passo 12 — Baseline publicada

Merge em `main` atualiza a baseline. Novos clones via `npx degit Lyx-Engenharia/lyx-front-template` vão pegar essa versão. Fronts já clonados não são atualizados automaticamente — quem cuida disso é o owner do front clonado.

---

## Workflow de testes

```bash
npm test                          # Roda toda a suite
npm run test:watch                # Watch mode (re-roda no save)
npm run test:coverage             # Com coverage report
npx vitest path/to/file.spec.ts   # Roda 1 arquivo
```

**Onde escrever testes:**

- Co-located: `src/lib/api.spec.ts` (ao lado de `api.ts`).
- Fixtures por feature: `src/<area>/__fixtures__/`.

**Regra de ouro pra código novo:** todo helper puro novo em `src/lib/*` precisa de `*.spec.ts` no mesmo PR. Reviewer cobra.

**Convenção de mock:** evitar mocks. Mockar SÓ APIs externas ao processo (fetch direto pra outro host). Pra Server Actions: extraia a lógica pura pra `src/lib/*` e teste ela.

## Cheat sheet

### Comandos de dev

| Quando | Comando | O que faz |
|---|---|---|
| Primeira vez no projeto | `cp .env.local.example .env.local && npm install` | Setup |
| Começar a trabalhar | `npm run dev` | next dev em :3000 |
| Antes de commit | `npm run audit:all` | Pré-PR check completo |
| Editou AGENTS.md | `npm run sync-agents` | Propaga pros 3 alvos (CLAUDE/cursor/copilot) |
| Quero ver hot spots | `npm run audit:report` | Gera markdown igual ao bot do PR |

### Convenções de PR

- **Título:** `<tipo>(<escopo>): <resumo curto>` — ex.: `feat(dashboard): adiciona filtro por status`
- **Tipos:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `ci`
- **Escopos comuns:** `auth`, `dashboard`, `ui`, `lib`, `ci`, `audit`, `template`
- **PR pequeno > PR grande.** Se uma PR ficou com mais de 400 linhas modificadas, pense se dá pra dividir.

## FAQ

**P: Por que tenho que rodar `audit:all` antes de push?**
R: Pra não descobrir no CI um problema que o lint pega em 5s. Pré-PR check é fricção barata; CI vermelho é fricção cara (espera, push de novo).

**P: Posso ignorar uma regra ESLint pontualmente?**
R: Pode, com TODO datado obrigatório no comentário. Ver [`docs/AUDITORIA_AUTOMATIZADA.md`](AUDITORIA_AUTOMATIZADA.md) §"Política pra exceções".

**P: O CI tá vermelho mas no meu local passa.**
R: Geralmente é falta de `npm ci` (dependência travada por lockfile). No CI rodamos `npm ci` (que ignora cache local e instala exato o que tá em `package-lock.json`). Localmente, rode `npm ci` ou `rm -rf node_modules && npm install`.

**P: Coverage gate tá em `warn` mas eu quero ele em `error` pra testar localmente.**
R: `AUDIT_GATE_MODE=error npm run coverage:gate`. Útil pra validar antes de mergear PRs grandes.

**P: Posso editar `src/components/ui/*`?**
R: Não diretamente. São arquivos gerados pelo CLI do shadcn (`npx shadcn add <component>`). Pra customizar, ou recustomize via CLI ou crie um componente wrapper em `src/components/<feature>/*`.

---

## Referências

- [`AGENTS.md`](../AGENTS.md) — regras invioláveis pra agentes/AI
- [`AUDITORIA_AUTOMATIZADA.md`](AUDITORIA_AUTOMATIZADA.md) — detalhe das checagens do CI
- `lyx-monolith` — backend que serve auth + API (api.lyxai.com.br)
