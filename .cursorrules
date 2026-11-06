# AGENTS.md: lyx-front-template

> Fonte única de regras pra agentes de IA (Claude Code, Cursor, Copilot, Aider).
> **Não edite os arquivos copiados** (CLAUDE.md, .cursorrules, .github/copilot-instructions.md).
> Edite ESTE arquivo e rode `npm run sync-agents`.

## TL;DR

Repo **só de CI compartilhado** dos fronts da Lyx. Tem o reusable `lyx-audit.yml`, a catraca (`.github/lyx-audit/`), o pacote `@lyxai/front-audit` e os modelos de arquivo do front em `consumidor/`. Não é template de app: front novo não nasce daqui (o design system é o lume; o caminho está no `docs/FRONTEND_LUME.md` do `lyx-monolith`).

29 repos da org (fronts e os 3 do BI, contagem de 04/11/2026) chamam `Lyx-Engenharia/lyx-front-template/.github/workflows/lyx-audit.yml@main`. **Mudança no `lyx-audit.yml` ou na catraca vale para todos eles no próximo run, sem PR nos fronts.**

## Mapa

| Caminho | O que é | Quem lê |
|---|---|---|
| `.github/workflows/lyx-audit.yml` | o reusable | o `pr.yml` de cada front |
| `.github/lyx-audit/*.mjs` | scripts da catraca | o reusable, por sparse checkout no `job.workflow_sha` |
| `.github/lyx-audit/*.test.mjs`, `fixtures/` | testes (node:test) da catraca e do próprio YAML | o `pr.yml` daqui |
| `packages/front-audit/` | `@lyxai/front-audit`, publicado no npm | `eslint.config.mjs`, `vitest.config.ts` e `.dependency-cruiser.cjs` dos fronts; o reusable usa os bins por `npx -p @lyxai/front-audit@^0` |
| `.github/workflows/publish-front-audit.yml` | publica o pacote na tag `front-audit-v*` (OIDC) | GitHub |
| `packages/sistema-admin/` | `@lyxai/sistema-admin`, publicado no npm | fronts que importam `SistemaAdminPanel` e `ChangePasswordCard` |
| `consumidor/` | modelo do `pr.yml`, ESLint, dependency-cruiser e vitest de um front, e o `lume-vendorizado.mjs` (no front com o lume, a registry fica fora do lint e da cobertura) | quem liga um front ao CI |
| `docs/TESTING.md`, `docs/AUDITORIA_AUTOMATIZADA.md` | regras de teste, catraca e checagens | os `pr.yml` dos fronts apontam para o `TESTING.md` |

## Regras invioláveis

- 🔒 **Não renomeie o repo nem mova o `lyx-audit.yml`.** O caminho é o `uses:` de 29 repos.
- 🔒 **Input existente do reusable não muda nem sai.** Input novo nasce opcional e com padrão que mantém o comportamento de hoje. O teste "os inputs de antes continuam lá" (`workflow.test.mjs`) cobra a lista.
- 🔒 **Os scripts da catraca ficam em `.github/lyx-audit/*.mjs`.** O reusable faz sparse checkout desse padrão no mesmo commit do workflow.
- 🔒 **Check novo segue o desenho do reusable:** `continue-on-error: true` no passo e o resultado no "Avaliar status final", que é quem barra. Assim o dev recebe tudo o que falhou, não só o primeiro.
- 🔒 **A linha `::error::Falhas: <partes>` do último passo é contrato.** O `lyx-pr-agent` lê essa anotação (`src/divida-da-base.ts`) para comparar a PR com a base: partes em minúsculas, separadas por espaço. Anotação de outro passo não começa com `Falhas:`.
- 🔒 **O YAML do reusable fica no subconjunto que o simulador lê** (`apoio-workflow.mjs`): mapas e listas por recuo, escalar simples ou entre aspas simples, blocos `|` e `>-`, comentário de linha inteira. Sem âncora e sem coleção inline. Nome de passo com `:` vai entre aspas simples.
- 🔒 **Mudança no reusable vem com teste em `workflow.test.mjs`.** Passo que só usa bash, node e git roda de verdade no job simulado (lista `EXECUTAR`); o que chama npm, npx do pacote, gh ou `uses:` é simulado pelo cenário.
- 🔒 **Exclude de cobertura sem padrão com `!`.** No `coverage.exclude` do vitest 4 ele não devolve o arquivo: tira tudo (lcov vazio, testado em 04/11/2026). O `consumidor/lume-vendorizado.mjs` usa só padrões positivos por isso.
- 🔒 **`packages/sistema-admin/` fica enquanto houver front consumindo.** Em 04/11/2026 o `lyx-analise-credito-front` e o `lyx-contratos-front` dependem de `@lyxai/sistema-admin@^0.2.0`. A `main` tem o código da 0.1.0: a 0.2.0 saiu da branch `feat/sistema-admin-package`, que não entrou na `main`, e não há workflow de publicação desse pacote.

## O que o reusable faz, em ordem

1. Checkout do front (fetch-depth 2) e os scripts da catraca.
2. Node, `npm ci` (cai no `npm install` com aviso se o lock não bate).
3. **lume:** com `lume.json` na raiz, ou `components.json` com `joaodadas/lume` ou `lume-ashmont`, roda `npx -y @joaodadas/lume@^0.4 check` (minor do 0.x fixa; 0 = ok, 1 = violação, relatório por regra no log; teto de 5 minutos). Sem o marcador, pula. `lume-check: false` no `with:` desliga o passo (saída de emergência). A falha do lume não aparece no comentário do bot: o status final aponta o log do passo.
4. Lint, typecheck, testes com cobertura, gate de cobertura (`lyx-coverage-gate`), dependency-cruiser.
5. Catraca na PR: lint e cobertura contam só o que a PR piora.
6. Relatório (`lyx-audit-report` e a catraca) como comentário `<!-- audit-report -->` na PR e no resumo da run.
7. "Avaliar status final": `gate-mode: error` barra com `Falhas: <partes>`; `warn` deixa verde.

## Workflow deste repo

- PR contra `main`. Na `main`: merge só por `lyx-admins` e pelo agente, e PR com 1 aprovação (rulesets da org). O `lyx-pr-agent` não revisa este repo (fica na lista `SEMPRE_FORA` dele).
- `npm ci` e `npm test` antes do push. `npm test` roda a catraca (`node --test .github/lyx-audit/*.test.mjs`) e os testes do `@lyxai/front-audit` e do `@lyxai/sistema-admin`; o CI roda também `npm run typecheck:front-audit` e o build do pacote.
- O `pr.yml` daqui não roda o reusable (não há front aqui). Para ver uma mudança do reusable rodando no GitHub antes do merge: PR de teste num front com `uses: ...lyx-audit.yml@<branch>`, fechada sem merge.
- Release do `@lyxai/front-audit`: bump numa PR com `npm version <patch|minor> -w @lyxai/front-audit --no-git-tag-version`, depois a tag `front-audit-vX.Y.Z` e o push da tag (passo a passo no topo do `publish-front-audit.yml`). Os bins (gate e relatório) o reusable roda por `npx -p @lyxai/front-audit@^0`: versão nova 0.x vale nos fronts sem PR neles. A config de ESLint, vitest e dependency-cruiser vem do lock de cada front.

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | catraca, `@lyxai/front-audit` e `@lyxai/sistema-admin` |
| `npm run test:catraca` | `node --test .github/lyx-audit/*.test.mjs` |
| `npm run test:front-audit` | vitest do `@lyxai/front-audit` |
| `npm run test:sistema-admin` | vitest do `@lyxai/sistema-admin` |
| `npm run typecheck:front-audit` | `tsc -p packages/front-audit --noEmit` |
| `npm run build:front-audit` | tsup do `@lyxai/front-audit` |
| `npm run sync-agents` | copia AGENTS.md pros 3 alvos (CLAUDE/cursor/copilot) |

`LYX_AUDIT_WORKFLOW=<caminho> node --test .github/lyx-audit/workflow.test.mjs` roda os testes do YAML contra outro arquivo (a versão da `main`, por exemplo).

## DON'T

- ❌ Renomear o repo, mover o `lyx-audit.yml` ou mudar input existente
- ❌ Passo novo no reusable sem `continue-on-error: true` e sem entrar no "Avaliar status final"
- ❌ Mudar o formato da linha `::error::Falhas:` ou anotar `Falhas:` em outro passo
- ❌ Recriar app de exemplo, `src/` ou `Dockerfile` aqui: front novo segue o `docs/FRONTEND_LUME.md` do `lyx-monolith`
- ❌ Apagar `packages/sistema-admin/` enquanto houver front no `@lyxai/sistema-admin`
- ❌ Editar `CLAUDE.md`/`.cursorrules`/`.github/copilot-instructions.md` direto (edite `AGENTS.md` e rode `npm run sync-agents`)

## Referências

- [`consumidor/README.md`](consumidor/README.md): como ligar um front ao CI
- [`docs/TESTING.md`](docs/TESTING.md): doc canônica de testes e da catraca
- [`docs/AUDITORIA_AUTOMATIZADA.md`](docs/AUDITORIA_AUTOMATIZADA.md): cada checagem do CI
- `lyx-monolith/docs/adr/0004-branching-tier-system.md` e `0005-audit-pipeline-via-template.md`: governança e a decisão do pipeline via este repo
