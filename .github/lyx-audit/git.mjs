// Base da PR e o que a PR mudou, a partir do checkout do pull_request.
//
// O actions/checkout entrega refs/pull/N/merge: HEAD é o merge da PR na base e
// HEAD^1 é a base exata usada no merge. Com fetch-depth 2 os dois estão no clone,
// então o diff HEAD^1..HEAD é o que a PR muda, sem precisar de merge-base.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const VAZIO = () => ({ criados: [], modificados: [], renomeados: [], removidos: [] });

function rodarGit(cwd, args, env) {
  return execFileSync('git', args, { cwd, env, maxBuffer: 64 * 1024 * 1024 });
}

/** Lê `git diff --name-status -z -M`. Rename e cópia vêm como STATUS\0de\0para\0. */
export function parseNameStatusZ(saida) {
  const campos = Buffer.from(saida).toString('utf8').split('\0');
  const r = VAZIO();
  for (let i = 0; i < campos.length; i += 1) {
    const status = campos[i];
    if (!status) continue;
    const tipo = status[0];
    if (tipo === 'R' || tipo === 'C') {
      const de = campos[i + 1];
      const para = campos[i + 2];
      i += 2;
      if (tipo === 'R') r.renomeados.push({ de, para, similaridade: Number(status.slice(1)) || 0 });
      else r.criados.push(para);
      continue;
    }
    const caminho = campos[i + 1];
    i += 1;
    if (tipo === 'A') r.criados.push(caminho);
    else if (tipo === 'D') r.removidos.push(caminho);
    else r.modificados.push(caminho);
  }
  return r;
}

/**
 * Caminhos (no head) que a PR cria ou altera. Rename puro (100% igual) fica de
 * fora: mover arquivo não cria nem muda lógica.
 */
export function arquivosCriadosOuAlterados(alterados) {
  const renomeadosComMudanca = alterados.renomeados.filter((r) => r.similaridade < 100).map((r) => r.para);
  return [...new Set([...alterados.criados, ...alterados.modificados, ...renomeadosComMudanca])].sort();
}

/** Mapa caminho na base → caminho no head, para os arquivos renomeados. */
export function mapaDeRenomeados(alterados) {
  return new Map((alterados?.renomeados ?? []).map((r) => [r.de, r.para]));
}

// Na raiz do repo, o que decide o que o npm instala.
const ARQUIVOS_DE_DEPS = new Set(['package.json', 'package-lock.json', 'npm-shrinkwrap.json', '.npmrc']);

/**
 * Pastas do próprio repo que o npm liga no node_modules (workspaces e
 * dependências `file:`), lidas do package-lock (entradas com `link: true`).
 * Link para fora do repo fica de fora: a PR não muda o que está lá.
 */
export function pacotesLocaisDoLock(conteudo) {
  let lock;
  try {
    lock = JSON.parse(conteudo);
  } catch {
    return [];
  }
  const pastas = new Set();
  for (const entrada of Object.values(lock?.packages ?? {})) {
    if (entrada?.link !== true || typeof entrada.resolved !== 'string') continue;
    const pasta = entrada.resolved.split('\\').join('/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (pasta && pasta !== '..' && !pasta.startsWith('../') && !isAbsolute(pasta)) pastas.add(pasta);
  }
  return [...pastas].sort();
}

function pacotesLocais(...raizes) {
  const pastas = new Set();
  for (const raiz of raizes) {
    const lock = join(raiz, 'package-lock.json');
    if (existsSync(lock)) for (const p of pacotesLocaisDoLock(readFileSync(lock, 'utf8'))) pastas.add(p);
  }
  return [...pastas];
}

/**
 * A base precisa das próprias dependências quando a PR mexeu no que o npm
 * instala: package.json, lock ou .npmrc da raiz, ou um pacote local ligado no
 * node_modules (`locais`, de pacotesLocaisDoLock). Fora disso, o node_modules
 * do head é o mesmo que a base instalaria.
 */
export function precisaInstalarDeps(alterados, locais = []) {
  const caminhos = [
    ...alterados.criados,
    ...alterados.modificados,
    ...alterados.removidos,
    ...alterados.renomeados.flatMap((r) => [r.de, r.para]),
  ];
  return caminhos.some((c) => ARQUIVOS_DE_DEPS.has(c) || locais.some((p) => c.startsWith(`${p}/`)));
}

/** Base da PR: HEAD^1 quando HEAD é o commit de merge do pull_request. */
export function resolverBase({ cwd, env = process.env }) {
  const pais = rodarGit(cwd, ['rev-list', '--parents', '-n', '1', 'HEAD'], env).toString().trim().split(/\s+/);
  if (pais.length !== 3) {
    return { disponivel: false, sha: '', motivo: 'HEAD não é commit de merge (o checkout não veio de refs/pull/N/merge)' };
  }
  return { disponivel: true, sha: pais[1] };
}

/** Saída crua de `git diff --name-status -z -M <base> HEAD`. */
export function listarAlterados({ cwd, sha, env = process.env }) {
  return rodarGit(cwd, ['diff', '--name-status', '-z', '-M', sha, 'HEAD'], env);
}

/**
 * npm ci na base. --prefer-offline usa o cache do npm que o setup-node restaurou
 * e que o npm ci do head acabou de encher: só baixa o que a PR trocou.
 * Instalação que falha não deixa node_modules pela metade para o passo seguinte.
 */
function instalarDeps(dir, env) {
  const temLock = existsSync(join(dir, 'package-lock.json'));
  const extras = ['--prefer-offline', '--no-audit', '--no-fund'];
  const npm = (comando) => spawnSync('npm', [comando, ...extras], { cwd: dir, env, stdio: 'inherit' }).status === 0;
  if (npm(temLock ? 'ci' : 'install') || (temLock && npm('install'))) return;
  rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
  throw new Error('npm install falhou na base');
}

function linkarDeps(cwd, dir) {
  const destino = join(dir, 'node_modules');
  if (existsSync(destino) || isLink(destino)) return;
  symlinkSync(resolve(cwd, 'node_modules'), destino, 'dir');
}

function isLink(caminho) {
  try {
    return lstatSync(caminho).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Como a base ficou: 'link' (node_modules do head, mesmo toolchain do head),
 * 'instalado' (as dependências da própria base) ou 'ausente'.
 */
export function depsDaBase(dir) {
  const destino = join(dir, 'node_modules');
  if (isLink(destino)) return 'link';
  return existsSync(destino) ? 'instalado' : 'ausente';
}

/**
 * Worktree da base em `dir` (fora do workspace do consumidor, para o eslint, o
 * tsc e o vitest do head não enxergarem). Idempotente.
 * deps: 'link' usa o node_modules do head;
 *       'auto' faz npm ci na base quando a PR mexeu nas dependências
 *       (precisaInstalarDeps) e liga o node_modules do head no resto.
 * O lint e a suíte da base usam 'auto': com 'link', um upgrade de plugin que
 * liga regra nova apareceria também na base e passaria como erro antigo.
 */
export function prepararBase({ cwd, sha, dir, deps = 'link', env = process.env }) {
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(dirname(dir), { recursive: true });
    rodarGit(cwd, ['worktree', 'add', '--detach', '--force', dir, sha], env);
  }
  const alterados = deps === 'auto' ? parseNameStatusZ(listarAlterados({ cwd, sha, env })) : null;
  if (alterados && precisaInstalarDeps(alterados, pacotesLocais(cwd, dir))) {
    // unlinkSync, não rmSync: no Node 23 o rmSync de link para pasta lança ERR_FS_EISDIR.
    if (isLink(join(dir, 'node_modules'))) unlinkSync(join(dir, 'node_modules'));
    if (!existsSync(join(dir, 'node_modules'))) instalarDeps(dir, env);
    return { dir, deps: 'instalado' };
  }
  linkarDeps(cwd, dir);
  return { dir, deps: 'link' };
}
