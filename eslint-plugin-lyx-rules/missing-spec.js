/**
 * lyx/missing-spec
 *
 * Para cada arquivo `*.service.ts` ou `*.controller.ts`, exige existência
 * de `*.spec.ts` sibling (mesmo diretório, mesmo nome).
 *
 * Exemplo válido:
 *   src/services/users.service.ts
 *   src/services/users.service.spec.ts   ← obrigatório
 *
 * Exemplo inválido (lint error):
 *   src/services/users.service.ts        ← sem spec sibling
 *
 * Justificativa: força TDD na mesma PR. Reviewer humano pode esquecer.
 * Doc: docs/TESTING.md no template.
 */

import { existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Exige arquivo *.spec.ts ao lado de *.service.ts ou *.controller.ts",
      recommended: true,
    },
    schema: [],
    messages: {
      missingSpec:
        "Faltando spec sibling: {{specPath}}. Toda *.{service,controller}.ts precisa de *.spec.ts no mesmo diretório (regra TDD, ver docs/TESTING.md).",
    },
  },
  create(context) {
    return {
      Program(node) {
        const filePath = context.filename;
        // Só roda em service.ts e controller.ts.
        if (!/\.(service|controller)\.ts$/.test(filePath)) return;
        // Se o próprio arquivo já é spec, ignora.
        if (/\.spec\.ts$/.test(filePath)) return;
        // Calcula path esperado da spec.
        const dir = dirname(filePath);
        const base = basename(filePath, ".ts");
        const specPath = join(dir, `${base}.spec.ts`);
        if (!existsSync(specPath)) {
          context.report({
            node,
            messageId: "missingSpec",
            data: { specPath: specPath.replace(`${process.cwd()}/`, "") },
          });
        }
      },
    };
  },
};
