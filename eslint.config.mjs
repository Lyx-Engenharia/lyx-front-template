import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

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
  ]),
  // ── Auditoria automatizada — Fase 1 (severidade warn, rollout) ──────────────
  // Regras codificam disciplina de qualidade: nenhum arquivo passa de 500 linhas,
  // nenhuma função passa de 80 linhas / CCN 12 / cognitive 15. Em Fase 1, são
  // warnings (não bloqueiam merge). Sobe pra error quando hotspots legacy forem
  // resolvidos. Como template, todo projeto que clonar herda essa baseline.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      complexity: ["warn", 12],
      "max-lines": [
        "warn",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { sonarjs },
    rules: {
      "sonarjs/cognitive-complexity": ["warn", 15],
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
  // Desliga as 2 regras built-in do Next.js que disparam nesses templates.
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
  // TODO(2026-06-15): refatorar theme toggle (dashboard/layout.tsx + theme-toggle.tsx)
  // pra ler localStorage via lazy initial state ao invés de setState dentro de useEffect.
  // Por enquanto warn (era error built-in do Next.js 16) — segue Fase 1 (não bloqueia merge).
  {
    files: [
      "src/app/dashboard/layout.tsx",
      "src/components/theme-toggle.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
