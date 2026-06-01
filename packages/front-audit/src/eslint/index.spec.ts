import { describe, it, expect } from 'vitest';
import config from './index';

describe('@lyxai/front-audit/eslint', () => {
  it('exporta um array de config não-vazio', () => {
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });

  it('tem complexity/max-lines/max-lines-per-function como error', () => {
    const block = config.find((c) => c.rules?.complexity);
    expect(block?.rules?.complexity).toEqual(['error', 12]);
    expect(block?.rules?.['max-lines']).toEqual(['error', { max: 500, skipBlankLines: true, skipComments: true }]);
    expect(block?.rules?.['max-lines-per-function']).toEqual(['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }]);
  });

  it('alveja **/*.{ts,tsx} (layout-agnostic — gateia src/ e app-router-na-raiz)', () => {
    const block = config.find((c) => c.rules?.complexity);
    expect(block?.files).toContain('**/*.{ts,tsx}');
  });

  it('globalIgnores exclui não-fonte (scripts, configs) p/ não surgir dívida falsa', () => {
    const ignoreBlock = config.find((c) => Array.isArray(c.ignores) && !c.files);
    expect(ignoreBlock?.ignores).toContain('scripts/**');
    expect(ignoreBlock?.ignores).toContain('**/*.config.{ts,js,cjs,mjs}');
  });

  it('tem sonarjs/cognitive-complexity e lyx/missing-spec como error', () => {
    const cog = config.find((c) => c.rules?.['sonarjs/cognitive-complexity']);
    expect(cog?.rules?.['sonarjs/cognitive-complexity']).toEqual(['error', 15]);
    const lyx = config.find((c) => c.rules?.['lyx/missing-spec']);
    expect(lyx?.rules?.['lyx/missing-spec']).toBe('error');
  });

  it('ignora _lyx-audit/** (band-aid transitório do clone no CI — remover na Fase 3)', () => {
    const ignoreBlock = config.find((c) => Array.isArray(c.ignores) && !c.files);
    expect(ignoreBlock?.ignores).toContain('_lyx-audit/**');
  });

  it('permite require em **/*.cjs (pro .dependency-cruiser.cjs reexportar o preset)', () => {
    const cjsBlock = config.find(
      (c) => Array.isArray(c.files) && c.files.includes('**/*.cjs'),
    );
    expect(cjsBlock?.rules?.['@typescript-eslint/no-require-imports']).toBe('off');
  });
});
