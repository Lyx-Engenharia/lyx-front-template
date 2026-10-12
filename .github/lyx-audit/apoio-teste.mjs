// Apoio dos testes: repositório git de verdade, com a PR mergeada na base do
// jeito que o actions/checkout entrega no pull_request (refs/pull/N/merge com
// fetch-depth 2: HEAD é o merge, HEAD^1 é a base, HEAD^2 é a PR).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Isola o git do teste da config da máquina (assinatura de commit, hooks, etc.).
export const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'teste',
  GIT_AUTHOR_EMAIL: 'teste@example.com',
  GIT_COMMITTER_NAME: 'teste',
  GIT_COMMITTER_EMAIL: 'teste@example.com',
};

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

/**
 * npm de verdade e offline: os testes só usam dependência `file:` do próprio repo
 * (o npm liga a pasta no node_modules, sem registry).
 */
export function npmOffline(cwd, ...args) {
  return execFileSync('npm', [...args, '--offline', '--no-audit', '--no-fund'], {
    cwd,
    env: { ...GIT_ENV, npm_config_update_notifier: 'false' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function escrever(raiz, arquivos) {
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    const destino = join(raiz, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
}

export function pastaTemporaria(prefixo) {
  return mkdtempSync(join(tmpdir(), `lyx-catraca-${prefixo}-`));
}

const recuo = (linha) => linha.length - linha.trimStart().length;

function blocoDoRun(linhas, i, recuoDoRun, estilo) {
  const bloco = [];
  let j = i + 1;
  for (; j < linhas.length; j += 1) {
    if (linhas[j].trim() !== '' && recuo(linhas[j]) <= recuoDoRun) break;
    bloco.push(linhas[j]);
  }
  const menor = Math.min(...bloco.filter((l) => l.trim() !== '').map(recuo));
  const corpo = bloco.map((l) => l.slice(menor));
  const texto = estilo.startsWith('>') ? corpo.join(' ').replace(/\s+/g, ' ').trim() : corpo.join('\n');
  return { texto, fim: j - 1 };
}

/**
 * Passos do workflow ({ nome, run }) lidos do YAML, sem dependência. Cobre o que o
 * lyx-audit.yml usa: `- name:` abrindo o passo e `run:` inline, `|` ou `>-`.
 */
export function passosDoWorkflow(texto) {
  const linhas = texto.split('\n');
  const passos = [];
  let atual = null;
  for (let i = 0; i < linhas.length; i += 1) {
    const item = /^\s+- (name|uses|run|id): ?(.*)$/.exec(linhas[i]);
    if (item) {
      atual = { nome: item[1] === 'name' ? item[2].replace(/^'(.*)'$/, '$1') : null, run: null };
      passos.push(atual);
      if (item[1] !== 'run') continue;
    }
    const run = /^(\s*)(?:- )?run: ?(.*)$/.exec(linhas[i]);
    if (!atual || !run) continue;
    if (['|', '|-', '>', '>-'].includes(run[2])) {
      const { texto: script, fim } = blocoDoRun(linhas, i, recuo(linhas[i]), run[2]);
      atual.run = script;
      i = fim;
    } else {
      atual.run = run[2];
    }
  }
  return passos;
}

/**
 * Cria origem com `main` (base) e a branch da PR, faz o merge --no-ff (o que o
 * GitHub faz em refs/pull/N/merge) e devolve um clone raso de 2 commits do merge.
 * `base` são os arquivos da main (ou uma função que os escreve na raiz).
 * `pr(raiz)` aplica as mudanças da PR (pode usar git mv).
 */
export function repoComPrMergeada({ base, pr }) {
  const pasta = pastaTemporaria('repo');
  const origem = join(pasta, 'origem');
  mkdirSync(origem);
  git(origem, 'init', '-q', '-b', 'main');
  if (typeof base === 'function') base(origem);
  else escrever(origem, base);
  git(origem, 'add', '-A');
  git(origem, 'commit', '-q', '-m', 'base');
  const shaBase = git(origem, 'rev-parse', 'HEAD');
  git(origem, 'checkout', '-q', '-b', 'pr');
  pr(origem);
  git(origem, 'add', '-A');
  git(origem, 'commit', '-q', '--allow-empty', '-m', 'pr');
  git(origem, 'checkout', '-q', 'main');
  git(origem, 'merge', '-q', '--no-ff', '-m', 'merge da pr', 'pr');
  const clone = join(pasta, 'clone');
  git(pasta, 'clone', '-q', '--depth', '2', `file://${origem}`, clone);
  return { pasta, clone, shaBase, limpar: () => rmSync(pasta, { recursive: true, force: true }) };
}

/**
 * Front de mentira para a catraca do lint, com um plugin de ESLint em duas
 * versões (o que um upgrade de eslint-config-next, sonarjs ou @lyxai/front-audit
 * faz): a 2.0.0 reescreve a mensagem da regra fake/proibido e liga no-console.
 * O `eslint` do front é um calço que chama o ESLint de verdade do template
 * (`binDoEslint`), então o npm instala tudo offline, por `file:`.
 */
export function frontComPluginDeLint({ binDoEslint, versao, codigo }) {
  const plugin = (v) => {
    const mensagem = v === 2 ? 'não use proibido (texto novo da 2.0.0)' : 'uso de proibido (1.0.0)';
    const extra = v === 2 ? ", 'no-console': 'error'" : '';
    return {
      [`vendor/fake-v${v}/package.json`]: JSON.stringify({ name: 'eslint-plugin-fake', version: `${v}.0.0`, main: 'index.js' }),
      [`vendor/fake-v${v}/index.js`]: [
        'const plugin = { rules: { proibido: { meta: { type: "problem", schema: [] }, create(context) {',
        `  return { Identifier(node) { if (node.name === 'proibido') context.report({ node, message: ${JSON.stringify(mensagem)} }); } };`,
        '} } } };',
        `plugin.configs = { recommended: [{ plugins: { fake: plugin }, rules: { 'fake/proibido': 'error'${extra} } }] };`,
        'module.exports = plugin;',
        '',
      ].join('\n'),
    };
  };
  return {
    ...plugin(1),
    ...plugin(2),
    'vendor/eslint/package.json': JSON.stringify({ name: 'eslint', version: '9.0.0', bin: { eslint: 'bin.cjs' } }),
    'vendor/eslint/bin.cjs': `#!/usr/bin/env node\nrequire(${JSON.stringify(binDoEslint)});\n`,
    'package.json': pacoteDoFront(versao),
    'eslint.config.mjs': "import fake from 'eslint-plugin-fake';\nexport default [{ ignores: ['vendor/**'] }, ...fake.configs.recommended];\n",
    ...codigo,
  };
}

/** package.json do front de mentira, com o plugin na versão pedida. */
export function pacoteDoFront(versao) {
  const devDependencies = { eslint: 'file:./vendor/eslint', 'eslint-plugin-fake': `file:./vendor/fake-v${versao}` };
  return `${JSON.stringify({ name: 'front-de-mentira', private: true, devDependencies }, null, 2)}\n`;
}
