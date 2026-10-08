import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  arquivosCriadosOuAlterados,
  listarAlterados,
  parseNameStatusZ,
  prepararBase,
  precisaInstalarDeps,
  resolverBase,
} from './git.mjs';
import { GIT_ENV, escrever, git, repoComPrMergeada } from './apoio-teste.mjs';

const FIX = new URL('./fixtures/taskbuilder/', import.meta.url);

describe('git', () => {
  describe('parseNameStatusZ', () => {
    it('lê a saída real do git diff --name-status -z -M da PR do taskbuilder (colchetes e rename)', () => {
      const a = parseNameStatusZ(readFileSync(new URL('pr-ruim.alterados.z', FIX)));
      assert.deepEqual(a.criados, [
        'src/app/dashboard/[sectorId]/painel/painel.helpers.ts',
        'src/lib/soma.spec.ts',
        'src/lib/soma.ts',
      ]);
      assert.deepEqual(a.modificados, [
        'src/app/dashboard/[sectorId]/bonus/page.tsx',
        'src/lib/format.ts',
        'src/lib/queries.ts',
        'src/stores/useMindMapStore.ts',
      ]);
      assert.deepEqual(a.renomeados, [
        { de: 'src/components/bonus/bonus-page.tsx', para: 'src/components/bonus/pagina-bonus.tsx', similaridade: 100 },
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
    it('instala na base só quando package.json ou lock mudaram na PR', () => {
      const base = { criados: [], removidos: [], renomeados: [] };
      assert.equal(precisaInstalarDeps({ ...base, modificados: ['src/a.ts'] }), false);
      assert.equal(precisaInstalarDeps({ ...base, modificados: ['package-lock.json'] }), true);
      assert.equal(precisaInstalarDeps({ ...base, modificados: ['package.json'] }), true);
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
