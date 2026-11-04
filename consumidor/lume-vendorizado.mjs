// Arquivos que a CLI do shadcn instala da registry do lume, num front que
// adotou o lume: o mesmo marcador do passo "lume: conferência" do
// lyx-audit.yml (lume.json na raiz, ou components.json com joaodadas/lume ou
// lume-ashmont). São da registry e não se editam à mão (atualiza com
// `add --overwrite`), então ficam fora do lint (eslint.config.mjs) e da
// cobertura (vitest.config.ts). Front sem o marcador: lista vazia, nada muda.
//
// A divisão é a do FRONTEND.md do lume: o código do app fica em
// src/components/app/, e o resto de src/components/ é da registry, assim como
// os helpers de src/lib e os hooks de src/hooks listados abaixo.
//
// Sem padrão com "!": no coverage.exclude do vitest 4 ele não devolve o
// arquivo, tira tudo da cobertura. Os três primeiros padrões cobrem
// src/components/ menos src/components/app/. O `!(app)` do vitest (picomatch)
// também recusa pasta que começa com "app" (app-shell/), e `app?*` pega essas.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const daRaiz = (nome) => fileURLToPath(new URL(nome, import.meta.url));

function adotouLume() {
  if (existsSync(daRaiz('lume.json'))) return true;
  const componentes = daRaiz('components.json');
  return existsSync(componentes) && /joaodadas\/lume|lume-ashmont/.test(readFileSync(componentes, 'utf8'));
}

/** @type {string[]} */
export const lumeVendorizado = adotouLume()
  ? [
      'src/components/*.{ts,tsx}',
      'src/components/!(app)/**',
      'src/components/app?*/**',
      'src/lib/{utils,format,motion,range}.ts',
      'src/hooks/{use-mobile,use-delayed-loading,use-entrance-once,use-debounced-value,use-copied}.ts',
    ]
  : [];
