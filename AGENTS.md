# AGENTS.md — lyx-front-template

> Fonte única de regras pra agentes de IA (Claude Code, Cursor, Copilot, Aider).
> **Não edite os arquivos copiados** (CLAUDE.md, .cursorrules, .github/copilot-instructions.md).
> Edite ESTE arquivo e rode `npm run sync-agents`.

## TL;DR

**Template Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn/ui** pra criar novos fronts CRUD que consomem o monolito `lyx-monolith`. Better Auth client (cookie cross-subdomain) já wireado. TanStack Query 5 + React Hook Form + Zod 4 + Sonner. Layout dashboard + login já prontos. Cloná-lo via `npx degit Lyx-Engenharia/lyx-front-template <novo-projeto>` e renomear pacote/rotas pro domínio do novo front.

**O que vem pronto:**

- Layout `dashboard` com sidebar/topbar (Lyx Design System v2)
- `login/page.tsx` integrado com Better Auth
- `lib/auth-client.ts` — Better Auth + `organizationClient()`
- `lib/api.ts` — fetch wrapper com `credentials: 'include'` + Origin header
- `lib/queries.ts` — exemplos de hooks TanStack Query (CRUD)
- `components/providers.tsx` — `QueryClientProvider` + `Toaster`
- 15 componentes shadcn/ui em `src/components/ui/*`

**Stack confirmada:**

- Next.js 16.2.x, React 19.2, Tailwind 4
- Better Auth client 1.6.x (cookies cross-subdomain pra `*.lyxai.com.br`)
- Zod 4.x + React Hook Form 7 pra forms
- @tanstack/react-query 5
- shadcn/ui (Radix UI primitives) + Lucide
- Vitest + @vitest/coverage-v8 (env node por enquanto — jsdom quando 1º spec de componente entrar)

## Setup local (zero pra rodar)

```bash
# Clonando o template pra criar um novo front:
npx degit Lyx-Engenharia/lyx-front-template meu-novo-front
cd meu-novo-front
cp .env.example .env.local  # ajuste NEXT_PUBLIC_API_URL
npm install
npm run dev                  # next dev em :3001
```

Default `NEXT_PUBLIC_API_URL` aponta pra `http://localhost:3000` (monolito local). Pra apontar pra monolito de prod: `NEXT_PUBLIC_API_URL=https://api.lyxai.com.br`.

> **Pra trabalhar diretamente NESTE repo** (mudar o template em si — adicionar feature, fix de bug, melhorar audit): siga o workflow abaixo.

## Workflow

Modelo de branches: **`feat/*` → PR → `develop` → PR → `main` → publicação do template**.

1. Sai de `develop`: `git checkout develop && git pull && git checkout -b feat/<nome>`
2. Codifica, roda local (`npm run dev`)
3. **Antes de pushar:** `npm run audit:all` (lint + typecheck + deps:check + test:coverage + coverage:gate + audit:report)
4. **Abre PR contra `develop`** → CI valida (`pr.yml`: lint + typecheck + tests + deps:check + sync-agents) → 1 approve obrigatório → merge
5. **Quando pronto pra publicar baseline nova do template**: abre PR `develop` → `main` → 1 approve obrigatório → merge

> Como esse é um repo **template** (não tem deploy próprio), `main` representa a baseline estável que devs vão clonar via `degit`. Fronts já clonados não são atualizados automaticamente — quem cuida disso é o owner do front clonado (pode pegar deltas via `git remote add template ...` se quiser).

## Regras invioláveis

- 🔒 **Server Components não podem importar Better Auth client.** O client é `'use client'`-only. Server Actions chamam o monolito direto via `fetch` com `Origin` header (Better Auth exige Origin no CSRF).
- 🔒 **Toda chamada `fetch` server-side pra `/api/auth/*` precisa de `Origin: https://<seu-front>.lyxai.com.br`** (ou o origin canônico do front clonado).
- 🔒 **`NEXT_PUBLIC_*` vars são inlinadas em build.** Sempre use `||` (não `??`) pra cobrir caso `""` quando ARG não é passado no build. Pra URLs canônicas, hardcoded > env var.
- 🔒 **Zod nos forms e nos response handlers.** Resposta do monolito é shape conhecido, mas valide na borda — protege contra drift entre front e back.
- 🔒 **Sem testes mockando `fetch` ou Better Auth.** Quando precisar testar lógica que consome o monolito, isole a função pura e teste ela. Integração HTTP fica fora de teste.

## Convenções de código

- **Imports absolutos** via alias `@/*` → `./src/*` (config em `tsconfig.json`).
- **shadcn/ui** em `src/components/ui/` é gerado pela CLI; não editar manualmente — re-gerar via `npx shadcn add <component>`.
- **Server Actions** em `src/app/<rota>/actions.ts` com `'use server'`. Validam input com Zod, chamam monolito, retornam DTO tipado.
- **Hooks customizados** em `src/hooks/`.
- **Helpers de domínio** em `src/lib/` (ex: `auth-client.ts`, `api.ts`, `queries.ts`).
- **Componentes de feature** em `src/components/` (não em `src/components/ui/`).

## DON'T

- ❌ Importar Better Auth client em Server Component (use Server Action ou Route Handler)
- ❌ Fetch server-side a `/api/auth/*` sem `Origin` header
- ❌ `??` em `NEXT_PUBLIC_*` (use `||`)
- ❌ Editar `src/components/ui/*` manualmente
- ❌ Editar `CLAUDE.md`/`.cursorrules`/`.github/copilot-instructions.md` direto (edite `AGENTS.md` e rode `npm run sync-agents`)
- ❌ Commitar `.env.local`
- ❌ Criar arquivo > 500 linhas ou função > 80 linhas (lint **bloqueia merge** — quebra em helpers / sub-componentes)
- ❌ Função com cyclomatic > 12 ou cognitive > 15 (lint **bloqueia merge**)
- ❌ Criar `*.service.ts` ou `*.controller.ts` sem `*.spec.ts` sibling (regra `lyx/missing-spec` **bloqueia merge**)
- ❌ Coverage abaixo de 75% lines / 40% branches (gate **bloqueia merge**)
- ❌ Mockar `fetch`/Better Auth/dep externa em `*.spec.ts` unit — isso é integration test, vai em `*.integration.spec.ts`

## Disciplina de testes

**Doc canônica:** [`docs/TESTING.md`](docs/TESTING.md). Leitura obrigatória pra qualquer dev/AI.

**Stack:** Vitest + @vitest/coverage-v8 + vitest workspaces (unit + integration).

**3 tipos de teste:**
- **Unit** (`*.spec.ts`) — função pura, sem I/O. Cobre lógica/regras.
- **Integration** (`*.integration.spec.ts`) — função + dep externa mockada (fetch, auth). Cobre contrato.
- **Smoke** (workflow separado pós-deploy) — não bloqueia PR.

**Regras invioláveis (lint quebra):**

- 🔒 Todo `*.service.ts` e `*.controller.ts` precisa de `*.spec.ts` sibling (regra ESLint `lyx/missing-spec`).
- 🔒 Coverage gate: `lines >= 75%`, `branches >= 40%`. **Modo `error`** — bloqueia merge se violar.
- 🔒 Tests co-located: spec ao lado do arquivo testado, mesmo nome + `.spec.ts`.
- 🔒 Naming: `describe('<arquivo>', () => describe('<função>', () => it('cenário concreto')))`. **NÃO** `it('works')`.

**Exemplo canônico:** [`src/lib/example/calc.service.{ts,spec.ts,integration.spec.ts}`](src/lib/example/) — leia antes de criar testes novos.

## Auditoria automatizada (CI)

CI roda via [reusable workflow `lyx-audit.yml`](.github/workflows/lyx-audit.yml). Outros repos importam:

```yaml
jobs:
  audit:
    uses: Lyx-Engenharia/lyx-front-template/.github/workflows/lyx-audit.yml@main
    with:
      coverage-lines: 75       # default
      coverage-branches: 40    # default
      gate-mode: error         # default
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

Checks (todos **error** — bloqueia merge):

- **Complexidade ciclomática** (`complexity` <= 12 por função)
- **Complexidade cognitiva** (`sonarjs/cognitive-complexity` <= 15)
- **Tamanho de arquivo** (`max-lines` <= 500; specs e `__fixtures__/` excluídos)
- **Tamanho de função** (`max-lines-per-function` <= 80)
- **Missing spec** (`lyx/missing-spec`) — `*.service.ts`/`*.controller.ts` sem `*.spec.ts`
- **Cobertura** (lines >= 75%, branches >= 40%)
- **Ciclos de import** (`dependency-cruiser` rule `no-circular`)

Bot posta relatório consolidado em cada PR (marker `<!-- audit-report -->`). Reproduz local com `npm run audit:report`.

**Antes de abrir PR:**

```bash
npm run audit:all
```

Pipeline completo: lint → typecheck → deps:check → test:coverage → coverage:gate → audit:report. Se passa local, passa no CI.

> Como template, qualquer front novo nasce com pipeline ativo — basta importar o reusable workflow.

Doc detalhada: [`docs/TESTING.md`](docs/TESTING.md) (didática) + [`docs/AUDITORIA_AUTOMATIZADA.md`](docs/AUDITORIA_AUTOMATIZADA.md) (referência).

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | next dev em :3001 |
| `npm run build` | next build |
| `npm run start` | next start |
| `npm run lint` | ESLint (Next + audit rules) |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | vitest run (unit + integration) |
| `npm run test:unit` | só unit (rápido) |
| `npm run test:integration` | só integration |
| `npm run test:watch` | vitest (watch mode) |
| `npm run test:coverage` | vitest com lcov |
| `npm run deps:check` | dependency-cruiser: ciclos de import |
| `npm run coverage:gate` | gate global de cobertura (lê coverage/lcov.info) |
| `npm run audit:report` | gera markdown do relatório consolidado |
| `npm run audit:all` | pipeline completo local: lint + typecheck + deps:check + test:coverage + coverage:gate + audit:report |
| `npm run sync-agents` | copia AGENTS.md pros 3 alvos (CLAUDE/cursor/copilot) |

## Branching tier (escope do repo)

Este repo é **sandbox** (categoria 4 do branching tier Lyx) — sem rulesets, sem CODEOWNERS forçado. Veja `lyx-monolith/docs/adr/0004-branching-tier-system.md` pra contexto completo.

> Apesar de sandbox, este template é **fonte canônica do CI/audit** dos fronts/BIs Lyx. Mudanças aqui propagam (via reusable workflow) pra todos os repos consumidores no próximo PR deles.

## Referências

- [`docs/TESTING.md`](docs/TESTING.md) — **doc canônica de testes** (leitura obrigatória)
- [`docs/AUDITORIA_AUTOMATIZADA.md`](docs/AUDITORIA_AUTOMATIZADA.md) — detalhe técnico das checagens do CI
- [`.github/workflows/lyx-audit.yml`](.github/workflows/lyx-audit.yml) — reusable workflow consumido por outros repos
- `lyx-monolith` — backend que serve auth + API (`api.lyxai.com.br`)
- `lyx-monolith/docs/adr/0004-branching-tier-system.md` — governança org-wide
