import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  arquivosCriadosOuAlterados,
  depsDaBase,
  listarAlterados,
  pacotesLocaisDoLock,
  parseNameStatusZ,
  prepararBase,
  precisaInstalarDeps,
  resolverBase,
} from './git.mjs';
import { GIT_ENV, escrever, git, npmOffline, repoComPrMergeada } from './apoio-teste.mjs';

// Fixture sintético: o formato do git diff --name-status -z -M, com caminhos inventados.
const FIX = new URL('./fixtures/front-sintetico/', import.meta.url);
const LOCK_DO_TEMPLATE = new URL('../../package-lock.json', import.meta.url);

describe('git', () => {
  describe('parseNameStatusZ', () => {
    it('lê a saída do git diff --name-status -z -M de uma PR (colchetes e rename)', () => {
      const a = parseNameStatusZ(readFileSync(new URL('pr-ruim.alterados.z', FIX)));
      assert.deepEqual(a.criados, [
        'src/app/painel/[equipeId]/resumo/resumo.helpers.ts',
        'src/lib/soma.spec.ts',
        'src/lib/soma.ts',
      ]);
      assert.deepEqual(a.modificados, [
        'src/app/painel/[equipeId]/metas/page.tsx',
        'src/lib/consultas.ts',
        'src/lib/formato.ts',
        'src/stores/useQuadroStore.ts',
      ]);
      assert.deepEqual(a.renomeados, [
        { de: 'src/components/metas/metas-pagina.tsx', para: 'src/components/metas/pagina-metas.tsx', similaridade: 100 },
      ]);
      assert.deepEqual(a.removidos, []);
    });

    it('espaço no nome, remoção, troca de tipo e rename com mudança', () => {
      const z = ['M', 'src/com espaço.ts', 'D', 'src/velho.ts', 'T', 'src/link.ts', 'R087', 'src/a.ts', 'src/b.ts', ''].join('\0');
      const a = parseNameStatusZ(Buffer.from(z));
      assert.deepEqual(a.modificados, ['src/com espaço.ts', 'src/link.ts']);
      assert.deepEqual(a.removidos, ['src/velho.ts']);
      assert.deepEqual(a.renomeados, [{ de: 'src/a.ts', para: 'src/b.ts', similaridade: 87 }]);
      assert.deepEqual(arquivosCriadosOuAlterados(a), ['src/b.ts', 'src/com espaço.ts', 'src/link.ts']);
    });

    it('saída vazia (PR sem diff) não quebra', () => {
      assert.deepEqual(parseNameStatusZ(Buffer.alloc(0)), { criados: [], modificados: [], renomeados: [], removidos: [] });
    });
  });

  describe('precisaInstalarDeps', () => {
    const vazio = { criados: [], modificados: [], removidos: [], renomeados: [] };

    it('instala na base só quando package.json ou lock mudaram na PR', () => {
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['src/a.ts'] }), false);
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['package-lock.json'] }), true);
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['package.json'] }), true);
    });

    it('.npmrc e npm-shrinkwrap.json também mudam o que o npm instala; package.json de outra pasta, não', () => {
      assert.equal(precisaInstalarDeps({ ...vazio, criados: ['.npmrc'] }), true);
      assert.equal(precisaInstalarDeps({ ...vazio, removidos: ['npm-shrinkwrap.json'] }), true);
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['src/fixtures/package.json'] }), false);
    });

    it('pacote do próprio repo ligado no node_modules (workspace, file:): mexer nele muda as dependências', () => {
      const locais = ['packages/front-audit'];
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['packages/front-audit/src/eslint/index.ts'] }, locais), true);
      assert.equal(
        precisaInstalarDeps({ ...vazio, renomeados: [{ de: 'packages/front-audit/src/a.ts', para: 'packages/front-audit/src/b.ts', similaridade: 100 }] }, locais),
        true,
      );
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['packages/front-audit-docs/x.md'] }, locais), false);
      assert.equal(precisaInstalarDeps({ ...vazio, modificados: ['src/a.ts'] }, locais), false);
    });
  });

  describe('pacotesLocaisDoLock', () => {
    it('lê do package-lock real do template os workspaces ligados no node_modules', () => {
      assert.deepEqual(pacotesLocaisDoLock(readFileSync(LOCK_DO_TEMPLATE, 'utf8')), ['packages/front-audit', 'packages/sistema-admin']);
    });

    it('ignora link para fora do repo, entrada sem link e lock ilegível', () => {
      const lock = {
        packages: {
          '': { name: 'x' },
          'node_modules/a': { resolved: 'vendor/a/', link: true },
          'node_modules/fora': { resolved: '../outro-repo', link: true },
          'node_modules/b': { version: '1.0.0', resolved: 'https://registry.npmjs.org/b/-/b-1.0.0.tgz' },
        },
      };
      assert.deepEqual(pacotesLocaisDoLock(JSON.stringify(lock)), ['vendor/a']);
      assert.deepEqual(pacotesLocaisDoLock('{ quebrado'), []);
    });
  });

  describe('com o checkout do pull_request (merge, fetch-depth 2)', () => {
    it('acha a base no HEAD^1, lista o que a PR mudou e monta a worktree da base', () => {
      const repo = repoComPrMergeada({
        base: { 'src/app/[id]/pagina.js': 'export const a = 1;\n', 'src/velho.js': 'export const v = 1;\n' },
        pr: (raiz) => {
          git(raiz, 'mv', 'src/velho.js', 'src/novo.js');
          git(raiz, 'rm', '-q', 'src/app/[id]/pagina.js');
        },
      });
      try {
        const base = resolverBase({ cwd: repo.clone, env: GIT_ENV });
        assert.deepEqual(base, { disponivel: true, sha: repo.shaBase });

        const alterados = parseNameStatusZ(listarAlterados({ cwd: repo.clone, sha: base.sha, env: GIT_ENV }));
        assert.deepEqual(alterados.removidos, ['src/app/[id]/pagina.js']);
        assert.deepEqual(alterados.renomeados, [{ de: 'src/velho.js', para: 'src/novo.js', similaridade: 100 }]);

        mkdirSync(join(repo.clone, 'node_modules'));
        const dir = join(repo.pasta, 'base');
        prepararBase({ cwd: repo.clone, sha: base.sha, dir, deps: 'link', env: GIT_ENV });
        assert.ok(existsSync(join(dir, 'src/app/[id]/pagina.js')), 'arquivo da base, que a PR apagou');
        assert.ok(existsSync(join(dir, 'src/velho.js')));
        assert.ok(lstatSync(join(dir, 'node_modules')).isSymbolicLink());
        assert.equal(realpathSync(join(dir, 'node_modules')), realpathSync(join(repo.clone, 'node_modules')));

        // Idempotente: a segunda chamada (lint e depois cobertura) reaproveita a worktree.
        prepararBase({ cwd: repo.clone, sha: base.sha, dir, deps: 'link', env: GIT_ENV });
      } finally {
        repo.limpar();
      }
    });

    it('PR que mexe no package.json: a base troca o link do node_modules do head pelas dependências dela (npm ci)', () => {
      const repo = repoComPrMergeada({
        base: (raiz) => {
          escrever(raiz, {
            'package.json': JSON.stringify({ name: 'x', private: true, devDependencies: { 'dep-local': 'file:./vendor/dep' } }),
            'vendor/dep/package.json': JSON.stringify({ name: 'dep-local', version: '1.0.0' }),
            'vendor/dep/index.js': 'module.exports = 1;\n',
          });
          npmOffline(raiz, 'install', '--package-lock-only');
        },
        pr: (raiz) => {
          const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
          escrever(raiz, { 'package.json': JSON.stringify({ ...pacote, scripts: { lint: 'eslint' } }) });
        },
      });
      try {
        mkdirSync(join(repo.clone, 'node_modules'));
        escrever(repo.clone, { 'node_modules/marca-do-head.txt': 'head\n' });
        const dir = join(repo.pasta, 'base');
        // Primeiro o link (o que uma chamada com deps link deixa), depois auto: o link sai e a base instala.
        prepararBase({ cwd: repo.clone, sha: repo.shaBase, dir, deps: 'link', env: GIT_ENV });
        assert.equal(depsDaBase(dir), 'link');
        const r = prepararBase({ cwd: repo.clone, sha: repo.shaBase, dir, deps: 'auto', env: GIT_ENV });
        assert.equal(r.deps, 'instalado');
        assert.equal(depsDaBase(dir), 'instalado');
        assert.equal(lstatSync(join(dir, 'node_modules')).isSymbolicLink(), false);
        assert.ok(existsSync(join(dir, 'node_modules/dep-local/package.json')), 'dependência da base instalada');
        assert.ok(existsSync(join(repo.clone, 'node_modules/marca-do-head.txt')), 'o node_modules do head fica intacto');
      } finally {
        repo.limpar();
      }
    });

    it('sem dependência que mudou, auto liga o node_modules do head (nada de npm ci)', () => {
      const repo = repoComPrMergeada({ base: { 'package.json': '{}', 'src/a.js': '1\n' }, pr: (raiz) => escrever(raiz, { 'src/a.js': '2\n' }) });
      try {
        mkdirSync(join(repo.clone, 'node_modules'));
        const dir = join(repo.pasta, 'base');
        assert.equal(prepararBase({ cwd: repo.clone, sha: repo.shaBase, dir, deps: 'auto', env: GIT_ENV }).deps, 'link');
        assert.equal(depsDaBase(dir), 'link');
        assert.equal(depsDaBase(join(repo.pasta, 'nao-existe')), 'ausente');
      } finally {
        repo.limpar();
      }
    });

    it('sem commit de merge no HEAD, a base fica indisponível (a catraca não chuta o diff)', () => {
      const repo = repoComPrMergeada({ base: { 'a.js': '1\n' }, pr: (raiz) => escrever(raiz, { 'b.js': '2\n' }) });
      try {
        git(repo.clone, 'checkout', '-q', 'HEAD^2');
        const base = resolverBase({ cwd: repo.clone, env: GIT_ENV });
        assert.equal(base.disponivel, false);
        assert.match(base.motivo, /merge/);
      } finally {
        repo.limpar();
      }
    });
  });
});
