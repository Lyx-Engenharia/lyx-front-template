/** Lista de coverage.exclude compartilhada pros fronts Lyx. Spread:
 *   coverage: { exclude: [...lyxCoverageExclude, ...excludesDoApp] }
 *
 * Mantida pra back-compat (fronts que só importam o array). Pra o gate HONESTO,
 * prefira spread de `lyxCoverageConfig` (abaixo) — ele carrega `all: true`. */
export const lyxCoverageExclude: string[] = [
  '**/*.d.ts',
  '**/*.{test,spec}.{ts,tsx}',
  '**/__fixtures__/**',
  '**/__mocks__/**',
  'src/**/types.ts',
  'src/components/ui/**',
  'src/app/**/layout.tsx',
  'src/app/**/loading.tsx',
  'src/app/**/error.tsx',
  'src/app/**/not-found.tsx',
  'src/app/**/page.tsx',
  'src/app/globals.css',
  'src/app/favicon.ico',
];

/**
 * Config de coverage compartilhada (v8 + **`all: true`**) pros fronts Lyx.
 *
 * `all: true` é o ponto central do gate honesto: sem ele, o provider v8 só
 * instrumenta os arquivos que os testes IMPORTAM — arquivos sem teste somem do
 * denominador e o gate passa vacuamente (dívida de cobertura escondida). Com
 * `all: true`, todo arquivo que casa o `include` é instrumentado; o que não tem
 * teste conta 0%. (Verificado: em vitest 4, `coverageConfigDefaults.all` é
 * `undefined` → comportamento vacuum por padrão.)
 *
 * Uso no `vitest.config.ts` do front — defina o `include` apontando pro universo
 * de código-fonte do front (`src/` OU `app/`+`lib/`+`components/` em App-Router-
 * na-raiz) e estenda o `exclude` com os específicos do front:
 *
 *   import { lyxCoverageConfig, lyxCoverageExclude } from '@lyxai/front-audit/vitest-coverage';
 *   // ...
 *   coverage: {
 *     ...lyxCoverageConfig,
 *     include: ['src/**\/*.{ts,tsx}'],
 *     exclude: [...lyxCoverageExclude, 'src/lib/algo-trivial.ts'],
 *   }
 */
export const lyxCoverageConfig = {
  provider: 'v8' as const,
  all: true,
  reporter: ['text', 'lcov', 'html'],
  reportsDirectory: './coverage',
  exclude: [...lyxCoverageExclude],
};

export default lyxCoverageExclude;
