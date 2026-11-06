import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import lyxAudit from "@lyxai/front-audit/eslint";
import { lumeVendorizado } from "./lume-vendorizado.mjs";

// Presets do Next (eslint-config-next na mesma versão do next do front) e, por
// cima, a camada de auditoria da Lyx: complexidade, tamanho de arquivo e de
// função, sonarjs, lyx/missing-spec e os ignores de build, coverage e config.
// Regra própria do front entra no fim da lista.
//
// O último objeto tira do lint o que veio da registry do lume, no front que
// adotou o lume (ver lume-vendorizado.mjs). Objeto só com `ignores` vale como
// ignore global; com a lista vazia (front sem o lume) não faz nada. Não troque
// por globalIgnores(): ele recusa lista vazia e quebraria o front sem o lume.
export default [...nextVitals, ...nextTs, ...lyxAudit, { ignores: lumeVendorizado }];
