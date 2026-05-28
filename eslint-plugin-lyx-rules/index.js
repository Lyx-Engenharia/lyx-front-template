/**
 * eslint-plugin-lyx-rules
 *
 * Custom ESLint rules específicas da Lyx. Distribuído inline com cada repo
 * (via `lyx-front-template` checkout) — não publicado em npm.
 *
 * Regras:
 *   - missing-spec: arquivo *.service.ts ou *.controller.ts sem *.spec.ts sibling = error
 */

import missingSpec from "./missing-spec.js";

export default {
  rules: {
    "missing-spec": missingSpec,
  },
};
