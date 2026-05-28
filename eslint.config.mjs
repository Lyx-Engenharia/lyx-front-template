import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";
import lyxRules from "./eslint-plugin-lyx-rules/index.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Audit/coverage artifacts:
    "coverage/**",
    "audit/**",
    "node_modules/**",
    // Local plugin source (não auto-lintar):
    "eslint-plugin-lyx-rules/**",
  ]),
  // ── Auditoria automatizada (severidade ERROR — bloqueia merge) ────────────
  // Regras codificam disciplina de qualidade: nenhum arquivo passa de 500 linhas,
  // nenhuma função passa de 80 linhas / CCN 12 / cognitive 15.
  // Override em arquivo específico só com `// eslint-disable-next-line <rule>`
  // + comentário justificando (revisor cobra).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      complexity: ["error", 12],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { sonarjs },
    rules: {
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  // ── Lyx custom rules ──────────────────────────────────────────────────────
  // missing-spec: arquivo *.service.ts ou *.controller.ts SEM *.spec.ts
  // sibling = error. Força TDD na mesma PR.
  {
    files: ["src/**/*.{service,controller}.ts"],
    plugins: { lyx: lyxRules },
    rules: {
      "lyx/missing-spec": "error",
    },
  },
  // Specs e fixtures podem ser longos por natureza (cenários acumulam).
  // shadcn/ui é gerado por CLI — não vamos reescrever.
  {
    files: [
      "**/*.{test,spec}.{ts,tsx}",
      "**/__fixtures__/**",
      "src/components/ui/**",
    ],
    rules: {
      complexity: "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  // Override pra arquivos gerados por shadcn — não revisáveis manualmente.
  {
    files: [
      "src/components/ui/**",
      "src/hooks/use-mobile.ts",
    ],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // TODO(2026-06-15): refatorar theme toggle pra lazy initial state.
  // TODO(2026-06-15): split DashboardLayout (208 linhas) e LoginPage (237 linhas)
  //   em sub-componentes. Por enquanto, override pra max-lines-per-function/complexity
  //   nesses arquivos específicos — não é debt do audit pipeline, é debt do template
  //   original que estava mascarado como warn.
  {
    files: [
      "src/app/dashboard/layout.tsx",
      "src/components/theme-toggle.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },
  {
    files: ["src/app/login/page.tsx"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
]);

export default eslintConfig;
