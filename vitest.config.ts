import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config — lyx-front-template
 *
 * - Coverage via v8 (nativo do Node 20+).
 * - Reporter `lcov` pra alimentar scripts/audit/coverage-gate.ts.
 * - Exclude de arquivos sem lógica testável: tipos, configs, RSC pages puras,
 *   componentes UI gerados (shadcn), schema, etc. Mantém o gate justo.
 * - `node` como ambiente default por enquanto (sem specs ainda). Quando o
 *   primeiro `*.spec.tsx` de componente React for adicionado: `npm install -D jsdom`
 *   e mudar `environment` pra `'jsdom'` aqui. Specs server-only podem sobrescrever
 *   por arquivo via `// @vitest-environment node`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'scripts/audit/**/*.ts'],
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
      ],
    },
  },
});
