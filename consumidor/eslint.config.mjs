import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import lyxAudit from "@lyxai/front-audit/eslint";

// Presets do Next (eslint-config-next na mesma versão do next do front) e, por
// cima, a camada de auditoria da Lyx: complexidade, tamanho de arquivo e de
// função, sonarjs, lyx/missing-spec e os ignores de build, coverage e config.
// Regra própria do front entra no fim da lista.
export default [...nextVitals, ...nextTs, ...lyxAudit];
