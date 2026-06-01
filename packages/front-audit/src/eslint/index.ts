import { globalIgnores } from 'eslint/config';
import sonarjs from 'eslint-plugin-sonarjs';
import type { Linter } from 'eslint';
import missingSpec from './missing-spec';

/**
 * Camada de auditoria Lyx (flat config). Consumidor faz:
 *   import nextVitals from 'eslint-config-next/core-web-vitals';
 *   import nextTs from 'eslint-config-next/typescript';
 *   import lyxAudit from '@lyxai/front-audit/eslint';
 *   export default [...nextVitals, ...nextTs, ...lyxAudit, ...overridesDoApp];
 */
const config: Linter.Config[] = [
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'audit/**',
    'node_modules/**',
    // Transitório (expand-contract): o reusable `lyx-audit.yml` clona o template
    // inteiro em `_lyx-audit/` durante o CI; o `eslint` da raiz não deve lintar
    // esse código vendorizado. REMOVER na Fase 3 (contract), quando o clone sumir.
    '_lyx-audit/**',
  ]),
  // Regras de auditoria — severidade error (bloqueia merge).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', 12],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: { 'sonarjs/cognitive-complexity': ['error', 15] },
  },
  // Regra custom Lyx: missing-spec.
  {
    files: ['src/**/*.{service,controller}.ts'],
    plugins: { lyx: { meta: { name: 'eslint-plugin-lyx' }, rules: { 'missing-spec': missingSpec } } },
    rules: { 'lyx/missing-spec': 'error' },
  },
  // Specs/fixtures/shadcn podem ser longos / gerados.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__fixtures__/**', 'src/components/ui/**'],
    rules: {
      complexity: 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },
  // shadcn gerado por CLI — desliga as 2 regras built-in do Next que disparam.
  {
    files: ['src/components/ui/**', 'src/hooks/use-mobile.ts'],
    rules: { 'react-hooks/purity': 'off', 'react-hooks/set-state-in-effect': 'off' },
  },
  // Arquivos de config CJS (ex.: `.dependency-cruiser.cjs` reexporta o preset via
  // `require('@lyxai/front-audit/dependency-cruiser')`). eslint-config-next/typescript
  // dispara `@typescript-eslint/no-require-imports` aí — mas require é legítimo em .cjs.
  // Centralizado aqui pra todo consumidor herdar (senão cada front precisa do override).
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];

export default config;
