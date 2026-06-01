import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'eslint/index': 'src/eslint/index.ts',
    'vitest-coverage': 'src/vitest-coverage.ts',
    'bin/coverage-gate': 'src/bin/coverage-gate.ts',
    'bin/report': 'src/bin/report.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  // tsup preserva o shebang `#!/usr/bin/env node` dos entries de bin e marca +x.
});
