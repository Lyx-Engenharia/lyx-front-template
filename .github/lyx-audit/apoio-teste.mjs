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
 * `pr(raiz)` aplica as mudanças da PR (pode usar git mv).
 */
export function repoComPrMergeada({ base, pr }) {
  const pasta = pastaTemporaria('repo');
  const origem = join(pasta, 'origem');
  mkdirSync(origem);
  git(origem, 'init', '-q', '-b', 'main');
  escrever(origem, base);
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
