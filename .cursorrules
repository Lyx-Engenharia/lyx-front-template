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
- ❌ Criar arquivo > 500 linhas ou função > 80 linhas (lint avisa — quebra em helpers / sub-componentes; vai virar bloqueante em Fase 2)
- ❌ Função com cyclomatic > 12 ou cognitive > 15 (lint avisa; vai virar bloqueante em Fase 2)

## Disciplina de testes

**Stack:** Vitest + @vitest/coverage-v8.

**Convenção:**

- Tests co-located: `*.spec.ts` (ou `.tsx`) ao lado da implementação.
- Naming: `describe('Função/Componente', () => describe('caso', () => it('cenário concreto')))`.
- Componentes UI gerados (`src/components/ui/**`) ficam fora do gate de coverage.
- Server Actions: extrair lógica pura pra `src/lib/*` e testar ela. Não testar `'use server'` direto (precisa de Next runtime — fora de escopo).
- Para hooks/components com efeitos colaterais, use `@testing-library/react` (adicionar quando precisar).

> **Quando adicionar o primeiro `*.spec.tsx` de componente React**, instale `jsdom` como devDep (`npm install -D jsdom`) e mude `test.environment` de `'node'` pra `'jsdom'` no `vitest.config.ts`. Sem isso, tests de componentes vão falhar.
> Atualmente os scripts rodam com `--passWithNoTests` e `environment: 'node'` (sem dep de jsdom) — permite CI verde mesmo sem tests, mas será removido quando o repo tiver primeira suíte estável.

**Coverage gate:**

- **Modo:** `warn` (Fase 1) — não bloqueia PR; só informa no relatório.
- **Threshold global:** lines >= 50% (default). Adjust via env var `AUDIT_LINES_MIN`.
- **Excluídos** (sem lógica testável): `src/components/ui/**`, pages/layouts/error/loading do App Router, `*.d.ts`, fixtures, types.

## Auditoria automatizada (CI)

Toda PR contra `develop`/`main` passa por checagens além de lint/typecheck/test:

- **Complexidade ciclomática** (`complexity` <= 12 por função, severidade warn em Fase 1)
- **Complexidade cognitiva** (`sonarjs/cognitive-complexity` <= 15 por função, severidade warn em Fase 1)
- **Tamanho de arquivo** (`max-lines` <= 500 linhas; specs e `__fixtures__/` excluídos; warn em Fase 1)
- **Tamanho de função** (`max-lines-per-function` <= 80 linhas; warn em Fase 1)
- **Cobertura global** (lines >= 50%, branches >= 40%). Fase 1: modo warn (não bloqueia).
- **Ciclos de import** (zero — `dependency-cruiser` rule `no-circular`, severidade error — bloqueia desde dia 1)

Bot do GitHub posta relatório consolidado em cada PR (marker `<!-- audit-report -->`). Reproduz local com `npm run audit:report`.

**Antes de abrir PR, valide local:**

```bash
npm run audit:all
```

Roda em sequência (abortando se algo falhar): `lint → typecheck → deps:check → test:coverage → coverage:gate → audit:report`. Se passa local, passa no CI.

**Fases (atual: Fase 1):**

- **Fase 1 (ATUAL — rollout):** complexity/max-lines/cognitive/coverage como `warn`. Não bloqueia merge — sobe baseline antes de virar bloqueante. Ciclos de import já bloqueiam (error).
- **Fase 2 (futura):** quando hotspots legacy forem resolvidos, sobe severidades pra `error`.

> Como template, essa baseline vai junto com o clone — qualquer front novo nasce com Fase 1 ativa.

Doc detalhada: [`docs/AUDITORIA_AUTOMATIZADA.md`](docs/AUDITORIA_AUTOMATIZADA.md).

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | next dev em :3001 |
| `npm run build` | next build |
| `npm run start` | next start |
| `npm run lint` | ESLint (Next + audit rules) |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | vitest run |
| `npm run test:watch` | vitest (watch mode) |
| `npm run test:coverage` | vitest com lcov |
| `npm run deps:check` | dependency-cruiser: ciclos de import |
| `npm run coverage:gate` | gate global de cobertura (lê coverage/lcov.info) |
| `npm run audit:report` | gera markdown do relatório consolidado |
| `npm run audit:all` | pipeline completo local: lint + typecheck + deps:check + test:coverage + coverage:gate + audit:report |
| `npm run sync-agents` | copia AGENTS.md pros 3 alvos (CLAUDE/cursor/copilot) |

## Pré-requisitos manuais (admin do repo)

- **Branch protection** em `main` E `develop`: PR obrigatório, 1 approve, status check `validate` (do `pr.yml`) tem que passar, sem force push
- **Default branch:** `develop` (PRs novas caem aqui automaticamente)
- **Vars de build (no front clonado):** `NEXT_PUBLIC_API_URL` apontando pro monolito de prod

## Referências

- [`docs/DEV_WORKFLOW.md`](docs/DEV_WORKFLOW.md) — fluxo PR → review → merge
- [`docs/AUDITORIA_AUTOMATIZADA.md`](docs/AUDITORIA_AUTOMATIZADA.md) — detalhe das checagens do CI
- `lyx-monolith` — backend que serve auth + API (`api.lyxai.com.br`)
- `lyx-contratos-front` — primeiro front a usar esse template (referência de uso real)
