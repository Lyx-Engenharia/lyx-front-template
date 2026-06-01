import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import lyxAudit from "@lyxai/front-audit/eslint";

// A camada de auditoria compartilhada (complexity/max-lines/sonarjs/missing-spec +
// ignores de coverage/node_modules + overrides de spec/shadcn) vem de
// @lyxai/front-audit/eslint. Aqui ficam só os presets do Next (casados com a
// versão de Next deste repo), os ignores específicos do template (workspace do
// pacote + arquivos de config + o plugin local transitório), e os overrides
// app-specific do TEMPLATE — debt do app exemplo, não da camada compartilhada
// (não copiar pros consumidores).
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  ...lyxAudit,
  // Ignores específicos do TEMPLATE — o lint da app não cobre:
  // - packages/** : o workspace @lyxai/front-audit tem build/test próprios (tsup + vitest).
  // - eslint-plugin-lyx-rules/** : cópia local transitória (expand-contract; some na Fase 3).
  // - *.cjs : arquivos de config CJS (ex.: .dependency-cruiser.cjs reexporta o preset via require).
  globalIgnores([
    "packages/**",
    "eslint-plugin-lyx-rules/**",
    "**/*.cjs",
  ]),
  // ── Overrides app-specific do TEMPLATE ────────────────────────────────────
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
];

export default eslintConfig;
