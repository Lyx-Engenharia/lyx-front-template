import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import rule from './missing-spec';

// Wire vitest's describe/it into RuleTester so it uses vitest as the test runner.
RuleTester.describe = describe;
RuleTester.it = it;

// cria um dir temp com um service + (opcional) seu spec sibling
function fixture(withSpec: boolean): { serviceFile: string } {
  const dir = mkdtempSync(join(tmpdir(), 'lyx-missing-spec-'));
  const serviceFile = join(dir, 'users.service.ts');
  writeFileSync(serviceFile, 'export class UsersService {}\n');
  if (withSpec) writeFileSync(join(dir, 'users.service.spec.ts'), '');
  return { serviceFile };
}

const tester = new RuleTester();

// RuleTester.run calls describe/it at top level — vitest picks them up directly.

tester.run('lyx/missing-spec — passa quando existe o spec sibling', rule, {
  valid: [{ code: 'export class UsersService {}', filename: fixture(true).serviceFile }],
  invalid: [],
});

tester.run('lyx/missing-spec — reporta quando falta o spec sibling', rule, {
  valid: [],
  invalid: [
    {
      code: 'export class UsersService {}',
      filename: fixture(false).serviceFile,
      errors: [{ messageId: 'missingSpec' }],
    },
  ],
});

tester.run('lyx/missing-spec — ignora arquivos que não são service/controller', rule, (() => {
  const { serviceFile } = fixture(false);
  const other = serviceFile.replace('users.service.ts', 'helpers.ts');
  writeFileSync(other, 'export const x = 1;\n');
  return {
    valid: [{ code: 'export const x = 1;', filename: other }],
    invalid: [],
  };
})());
