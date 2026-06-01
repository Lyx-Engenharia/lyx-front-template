import { describe, it, expect } from 'vitest';
import { lyxCoverageExclude, lyxCoverageConfig } from './vitest-coverage';

describe('lyxCoverageExclude', () => {
  it('é um array de globs e exclui specs + boilerplate do App Router', () => {
    expect(lyxCoverageExclude).toContain('**/*.{test,spec}.{ts,tsx}');
    expect(lyxCoverageExclude).toContain('src/app/**/page.tsx');
    expect(lyxCoverageExclude).not.toContain('scripts/**'); // não é responsabilidade do preset
  });
});

describe('lyxCoverageConfig', () => {
  it('liga all:true (gate honesto: arquivo sem teste conta 0%)', () => {
    expect(lyxCoverageConfig.all).toBe(true);
  });
  it('usa provider v8 e emite lcov pro bin do gate', () => {
    expect(lyxCoverageConfig.provider).toBe('v8');
    expect(lyxCoverageConfig.reporter).toContain('lcov');
  });
  it('carrega o exclude compartilhado como default', () => {
    expect(lyxCoverageConfig.exclude).toEqual(expect.arrayContaining(lyxCoverageExclude));
  });
});
