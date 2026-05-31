import { describe, it, expect } from 'vitest';
import { lyxCoverageExclude } from './vitest-coverage';
describe('lyxCoverageExclude', () => {
  it('é um array de globs e exclui specs + boilerplate do App Router', () => {
    expect(lyxCoverageExclude).toContain('**/*.{test,spec}.{ts,tsx}');
    expect(lyxCoverageExclude).toContain('src/app/**/page.tsx');
    expect(lyxCoverageExclude).not.toContain('scripts/**'); // não é responsabilidade do preset
  });
});
