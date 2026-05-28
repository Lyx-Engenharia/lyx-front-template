import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config — lyx-front-template
 *
 * - Coverage via v8 (nativo do Node 20+).
 * - Reporter `lcov` pra alimentar scripts/audit/coverage-gate.ts.
 * - Workspaces via `projects[]` (Vitest 4+ API): separa unit e integration.
 *   - unit: `*.spec.ts(x)` — exceto `*.integration.spec.ts(x)`
 *   - integration: `*.integration.spec.ts(x)` — testTimeout maior, pool forks
 * - Roda `npm run test:unit`, `npm run test:integration` ou `npm test` (tudo).
 * - `node` como ambiente default. Quando o primeiro `*.spec.tsx` de componente
 *   React entrar: `npm install -D jsdom` e mudar `environment` pra `'jsdom'`.
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
      exclude: [
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
        // ── Excludes específicos do TEMPLATE (não copie pros repos consumidores!) ──
        // Esses arquivos são referência (devs copiam pra novo front e testam lá).
        // No template, ficam fora do gate. Em repo consumidor REMOVER estes excludes.
        'src/lib/api.ts',
        'src/lib/auth-client.ts',
        'src/lib/queries.ts',
        'src/lib/utils.ts',
        'src/components/providers.tsx',
        'src/components/lyx-modal.tsx',
        'src/components/theme-toggle.tsx',
        // scripts/audit ficam excluídos no template (são utilitários) — repos
        // consumidores não importam isso (vem do checkout do template no workflow).
        'scripts/**',
      ],
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
