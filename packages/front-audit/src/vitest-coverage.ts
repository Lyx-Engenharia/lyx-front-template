/** Lista de coverage.exclude compartilhada pros fronts Lyx. Spread:
 *   coverage: { exclude: [...lyxCoverageExclude, ...excludesDoApp] } */
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

export default lyxCoverageExclude;
