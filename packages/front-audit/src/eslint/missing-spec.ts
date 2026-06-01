import { existsSync } from 'node:fs';
import { dirname, basename, join, relative } from 'node:path';
import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Exige arquivo *.spec.ts ao lado de *.service.ts ou *.controller.ts',
      recommended: true,
    },
    schema: [],
    messages: {
      missingSpec:
        'Faltando spec sibling: {{specPath}}. Toda *.{service,controller}.ts precisa de *.spec.ts no mesmo diretório (regra TDD, ver docs/TESTING.md).',
    },
  },
  create(context) {
    return {
      Program(node) {
        // ESLint 9: context.filename. Fallback ESLint 8: getFilename().
        const filePath =
          (context as { filename?: string }).filename ?? context.getFilename();
        if (!/\.(service|controller)\.ts$/.test(filePath)) return;
        if (/\.spec\.ts$/.test(filePath)) return;
        const dir = dirname(filePath);
        const base = basename(filePath, '.ts');
        const specPath = join(dir, `${base}.spec.ts`);
        if (!existsSync(specPath)) {
          context.report({
            node,
            messageId: 'missingSpec',
            data: { specPath: relative(process.cwd(), specPath) },
          });
        }
      },
    };
  },
};

export default rule;
