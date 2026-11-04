import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { lyxCoverageExclude } from '@lyxai/front-audit/vitest-coverage';
import { lumeVendorizado } from './lume-vendorizado.mjs';

/**
 * Vitest de um front, no formato que o lyx-audit.yml lê.
 *
 * - `npm run test:coverage` grava coverage/lcov.info: é o arquivo que o gate
 *   de cobertura e a catraca leem. O reporter text imprime a linha "All files"
 *   no log do CI.
 * - `include` em src/: arquivo de src sem teste entra na conta, com 0%.
 * - `lyxCoverageExclude`: specs, fixtures, tipos, ui gerada e os arquivos de
 *   convenção do App Router. Exclude próprio do front vem depois dele.
 * - `lumeVendorizado`: no front que adotou o lume, o que veio da registry
 *   (src/components/ menos src/components/app/, e os helpers e hooks do lume).
 *   No front sem o lume é vazio. Ver lume-vendorizado.mjs, e nada de padrão
 *   com "!" no exclude: no vitest 4 ele tira tudo da cobertura.
 * - Dois projects, como no docs/TESTING.md: unit (`*.spec.ts`) e integration
 *   (`*.integration.spec.ts`).
 * - Ambiente node. Spec de componente que precisa de DOM: `npm install -D jsdom`
 *   e `// @vitest-environment jsdom` na primeira linha do arquivo.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [...lyxCoverageExclude, ...lumeVendorizado],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.spec.{ts,tsx}'],
          exclude: ['src/**/*.integration.spec.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.spec.{ts,tsx}'],
          exclude: ['**/node_modules/**'],
          testTimeout: 30_000,
          pool: 'forks',
        },
      },
    ],
  },
});
