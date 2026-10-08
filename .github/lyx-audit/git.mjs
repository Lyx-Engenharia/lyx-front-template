// Base da PR e o que a PR mudou, a partir do checkout do pull_request.
//
// O actions/checkout entrega refs/pull/N/merge: HEAD é o merge da PR na base e
// HEAD^1 é a base exata usada no merge. Com fetch-depth 2 os dois estão no clone,
// então o diff HEAD^1..HEAD é o que a PR muda, sem precisar de merge-base.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

/** A suíte da base só reinstala dependências quando a PR mexeu nelas. */
export function precisaInstalarDeps(alterados) {
  const deps = new Set(['package.json', 'package-lock.json']);
  return arquivosCriadosOuAlterados(alterados).some((c) => deps.has(c)) || alterados.removidos.some((c) => deps.has(c));
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

function instalarDeps(dir, env) {
  const temLock = existsSync(join(dir, 'package-lock.json'));
  const args = temLock ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund'];
  const r = spawnSync('npm', args, { cwd: dir, env, stdio: 'inherit' });
  if (r.status !== 0 && temLock) {
    const r2 = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, env, stdio: 'inherit' });
    if (r2.status !== 0) throw new Error('npm install falhou na base');
  } else if (r.status !== 0) {
    throw new Error('npm install falhou na base');
  }
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
 * Worktree da base em `dir` (fora do workspace do consumidor, para o eslint, o
 * tsc e o vitest do head não enxergarem). Idempotente.
 * deps: 'link' usa o node_modules do head (barato, serve para o lint);
 *       'auto' faz npm ci na base só quando a PR mudou package.json ou lock.
 */
export function prepararBase({ cwd, sha, dir, deps = 'link', env = process.env }) {
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(dirname(dir), { recursive: true });
    rodarGit(cwd, ['worktree', 'add', '--detach', '--force', dir, sha], env);
  }
  if (deps === 'auto' && precisaInstalarDeps(parseNameStatusZ(listarAlterados({ cwd, sha, env })))) {
    if (isLink(join(dir, 'node_modules'))) rmSync(join(dir, 'node_modules'));
    if (!existsSync(join(dir, 'node_modules'))) instalarDeps(dir, env);
    return { dir, deps: 'instalado' };
  }
  linkarDeps(cwd, dir);
  return { dir, deps: 'link' };
}
