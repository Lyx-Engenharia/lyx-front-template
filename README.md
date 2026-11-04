# lyx-front-template

CI compartilhado dos fronts da Lyx. O repo não é mais template de app: front novo não nasce daqui. O design system dos fronts é o [lume](https://github.com/joaodadas/lume), e o caminho para criar um front novo está no `docs/FRONTEND_LUME.md` do `lyx-monolith`.

O nome do repo ficou: renomear o repo ou mover o workflow quebraria o `uses:` de todos os consumidores.

## O que mora aqui

| Caminho | O que é |
|---|---|
| `.github/workflows/lyx-audit.yml` | o reusable que cada front chama no `pr.yml` |
| `.github/lyx-audit/` | a catraca: scripts `.mjs` que o reusable baixa por sparse checkout, com testes e fixtures |
| `packages/front-audit/` | o pacote `@lyxai/front-audit`: ESLint, preset do dependency-cruiser, exclude do vitest e os bins `lyx-coverage-gate` e `lyx-audit-report` |
| `.github/workflows/publish-front-audit.yml` | publica o `@lyxai/front-audit` no npm a cada tag `front-audit-v*` |
| `packages/sistema-admin/` | o pacote `@lyxai/sistema-admin` (painel Admin de Sistema), que fronts usam pelo npm |
| `consumidor/` | os arquivos que um front precisa ter para o CI passar |
| `docs/TESTING.md` | doc canônica de testes e da catraca |
| `docs/AUDITORIA_AUTOMATIZADA.md` | cada checagem do CI, com limite e severidade |

## Quem consome

Os fronts e os 3 repos do BI (29 repos da org na contagem de 04/11/2026) chamam:

```yaml
jobs:
  audit:
    uses: Lyx-Engenharia/lyx-front-template/.github/workflows/lyx-audit.yml@main
```

**Como é `@main`, todo merge aqui vale para os 29 no próximo run de cada um.** Nenhum deles fixa versão.

## Ligar um front

Siga o [`consumidor/README.md`](consumidor/README.md): cinco arquivos para copiar, as dependências e os quatro scripts que o CI chama (`lint`, `typecheck`, `test:coverage`, `deps:check`). No front que adotou o lume, o `lume-vendorizado.mjs` tira do lint e da cobertura o que veio da registry.

## O que o lyx-audit.yml checa

- **Lint:** complexidade ciclomática (12), cognitiva (15), arquivo (500 linhas), função (80 linhas) e `lyx/missing-spec`.
- **Typecheck:** `tsc --noEmit`.
- **Testes e cobertura:** 75% de linhas e 40% de branches no repo inteiro.
- **Ciclos de import:** dependency-cruiser, zero.
- **Catraca na PR (padrão):** lint e cobertura barram só o que a PR piora.
- **lume:** `npx -y @joaodadas/lume@^0 check`, só no repo que adotou o lume (`lume.json` na raiz, ou `components.json` com `joaodadas/lume` ou `lume-ashmont`).

Todos rodam até o fim, e o último passo decide o status. O relatório vira comentário na PR. Detalhe em [`docs/AUDITORIA_AUTOMATIZADA.md`](docs/AUDITORIA_AUTOMATIZADA.md) e [`docs/TESTING.md`](docs/TESTING.md).

## Mexer neste repo

```bash
npm ci
npm test                       # catraca (node --test) e @lyxai/front-audit (vitest)
npm run typecheck:front-audit
npm run sync-agents            # depois de editar o AGENTS.md
```

- PR contra `main`. O CI daqui (`pr.yml`) roda o sync do AGENTS.md, os testes da catraca e o typecheck, o build e os testes do `@lyxai/front-audit`.
- O `pr.yml` daqui não roda o reusable: o repo não tem front. Os testes da catraca rodam os passos do `lyx-audit.yml` de verdade e simulam o job inteiro. Para ver uma mudança no reusable rodando no GitHub antes do merge, abra uma PR de teste num front com `uses: ...lyx-audit.yml@<sua-branch>`.
- Release do `@lyxai/front-audit`: o passo a passo está no topo do `publish-front-audit.yml`.
