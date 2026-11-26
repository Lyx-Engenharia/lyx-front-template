# consumidor: o que um front precisa para o CI passar

O CI dos fronts é o reusable [`lyx-audit.yml`](../.github/workflows/lyx-audit.yml) deste repo. Para ligar um front a ele:

## 1. Copie os arquivos

| Daqui | Para o front |
|---|---|
| `consumidor/pr.yml` | `.github/workflows/pr.yml` |
| `consumidor/eslint.config.mjs` | `eslint.config.mjs` |
| `consumidor/.dependency-cruiser.cjs` | `.dependency-cruiser.cjs` |
| `consumidor/vitest.config.ts` | `vitest.config.ts` |
| `consumidor/lume-vendorizado.mjs` | `lume-vendorizado.mjs` (copie sempre: no front sem o lume, a lista sai vazia) |

## 2. Instale as dependências de desenvolvimento

```bash
npm install -D @lyxai/front-audit@^0.3.0 eslint@^9 eslint-config-next@<versão do next do front> \
  dependency-cruiser@^17.4.0 vitest@^4.1.6 @vitest/coverage-v8@^4.1.6 typescript@^5
```

O `eslint-config-next` usa o parser que vem no `next`, então o front precisa ter o `next` instalado.

## 3. Ponha os scripts no package.json

O CI chama estes quatro, com estes nomes:

```json
{
  "scripts": {
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "deps:check": "depcruise src --config .dependency-cruiser.cjs"
  }
}
```

Para rodar o mesmo gate e o mesmo relatório na sua máquina (o CI não usa estes três, chama os bins direto):

```json
{
  "scripts": {
    "coverage:gate": "lyx-coverage-gate",
    "audit:report": "lyx-audit-report",
    "audit:all": "npm run lint && npm run typecheck && npm run deps:check && npm run test:coverage && npm run coverage:gate && npm run audit:report"
  }
}
```

## 4. Commite o package-lock.json

O CI instala com `npm ci`. Lock fora de sincronia com o `package.json` cai no `npm install`, com aviso.

## O que o CI espera do front

- Código em `src/`. O `deps:check` e o JSON do dependency-cruiser do CI olham `src`, e a cobertura inclui `src/**/*.{ts,tsx}`.
- `tsconfig.json` na raiz: o `tsc --noEmit` e o preset do dependency-cruiser leem ele.
- `coverage/lcov.info` depois do `test:coverage`: o gate de cobertura e a catraca leem esse arquivo. O `vitest.config.ts` daqui já grava ele.
- jsdom 30 pede Node 22.22.2 ou mais novo, e o padrão do reusable é o Node 20. O `pr.yml` daqui já traz `node-version: '24'` no `with:`.

## Front com o lume

O marcador é `lume.json` na raiz ou um `components.json` que contém `joaodadas/lume` ou `lume-ashmont`. Com ele:

- O reusable roda `npx -y @joao.dadas/lume@^0 check`. Sem o marcador, o passo pula.
- O `lume-vendorizado.mjs` tira do lint e da cobertura o que veio da registry, que não se edita à mão. A divisão é a do `FRONTEND.md` do lume: o código do app fica em `src/components/app/`, e o resto de `src/components/` é da registry, assim como `src/lib/{utils,format,motion,range}.ts` e os hooks do lume em `src/hooks/`. Componente do app fora de `src/components/app/` sai da conta da cobertura: mova para lá.
- No `coverage.exclude` do vitest 4, padrão com `!` não devolve o arquivo: tira tudo da cobertura (lcov vazio). Por isso a lista só tem padrões positivos.

O `lyx-controladoria-front` e o `lyx-medicoes-front` já têm um `lume-vendorizado.mjs` próprio, com a lista explícita do que instalaram e o mesmo nome de export. Podem ficar com ele.

## Inputs do reusable

Os do `pr.yml` daqui (`coverage-lines`, `coverage-branches`, `gate-mode`, `runs-on`) são os que a maioria dos fronts usa. A lista completa, com o padrão de cada um, está no topo do [`lyx-audit.yml`](../.github/workflows/lyx-audit.yml), e a catraca está explicada em [`docs/TESTING.md`](../docs/TESTING.md).
