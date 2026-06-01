import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import rule from './missing-spec';

// Wire vitest's describe/it into RuleTester so it uses vitest as the test runner.
RuleTester.describe = describe;
RuleTester.it = it;

// cria um dir temp com um arquivo principal + (opcional) seu spec sibling
function fixture(withSpec: boolean, filename = 'users.service.ts'): { serviceFile: string } {
  const dir = mkdtempSync(join(tmpdir(), 'lyx-missing-spec-'));
  const serviceFile = join(dir, filename);
  writeFileSync(serviceFile, 'export class UsersService {}\n');
  if (withSpec) {
    const specName = filename.replace(/\.ts$/, '.spec.ts');
    writeFileSync(join(dir, specName), '');
  }
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

tester.run('lyx/missing-spec — reporta quando falta o spec sibling do controller', rule, {
  valid: [],
  invalid: [
    {
      code: 'export class FooController {}',
      filename: fixture(false, 'foo.controller.ts').serviceFile,
      errors: [{ messageId: 'missingSpec' }],
    },
  ],
});

tester.run('lyx/missing-spec — ignora o próprio arquivo spec (.service.spec.ts)', rule, {
  valid: [
    {
      code: 'import {} from "./users.service";',
      filename: fixture(false, 'users.service.spec.ts').serviceFile,
    },
  ],
  invalid: [],
});
