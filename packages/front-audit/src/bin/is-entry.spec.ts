import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isEntryPoint } from './is-entry';

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'is-entry-'));
  dirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('isEntryPoint', () => {
  it('REGRESSÃO: true quando argv1 é o symlink .bin/lyx-coverage-gate → coverage-gate.js (bug do no-op silencioso)', () => {
    const dir = tmp();
    const realPath = join(dir, 'coverage-gate.js');
    writeFileSync(realPath, '// bin\n');
    const symlinkPath = join(dir, 'lyx-coverage-gate');
    symlinkSync(realPath, symlinkPath);

    // argv1 = nome do symlink (como o npm invoca via node_modules/.bin),
    // moduleUrl = url do arquivo real resolvido. O guard antigo `.endsWith(...)`
    // dava false aqui → main() nunca rodava.
    expect(isEntryPoint(symlinkPath, pathToFileURL(realPath).href)).toBe(true);
  });

  it('true quando argv1 é o próprio arquivo (invocação direta)', () => {
    const dir = tmp();
    const realPath = join(dir, 'report.js');
    writeFileSync(realPath, '// bin\n');
    expect(isEntryPoint(realPath, pathToFileURL(realPath).href)).toBe(true);
  });

  it('false quando argv1 aponta pra arquivo diferente do módulo', () => {
    const dir = tmp();
    const entry = join(dir, 'other-entry.js');
    const mod = join(dir, 'coverage-gate.js');
    writeFileSync(entry, '// other\n');
    writeFileSync(mod, '// module\n');
    expect(isEntryPoint(entry, pathToFileURL(mod).href)).toBe(false);
  });

  it('false quando argv1 é undefined', () => {
    expect(isEntryPoint(undefined, pathToFileURL(join(tmp(), 'x.js')).href)).toBe(false);
  });

  it('false quando argv1 não existe (realpathSync lança → catch)', () => {
    const dir = tmp();
    const mod = join(dir, 'coverage-gate.js');
    writeFileSync(mod, '// module\n');
    expect(isEntryPoint(join(dir, 'does-not-exist.js'), pathToFileURL(mod).href)).toBe(false);
  });
});
