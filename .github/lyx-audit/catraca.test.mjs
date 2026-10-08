// Testes de ponta a ponta da CLI que o workflow lyx-audit.yml chama.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GIT_ENV, escrever, git, pastaTemporaria, repoComPrMergeada } from './apoio-teste.mjs';

const CLI = fileURLToPath(new URL('./catraca.mjs', import.meta.url));
const FIX = fileURLToPath(new URL('./fixtures/taskbuilder/', import.meta.url));
const RAIZ_TB = '/home/runner/work/lyx-taskbuilder-front/lyx-taskbuilder-front';

function catraca(cwd, args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: { ...GIT_ENV, AUDIT_LINES_MIN: '75', AUDIT_BRANCHES_MIN: '40', ...env },
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// node_modules do template (tem o eslint 9). Sem ele o teste do lint de ponta a ponta é pulado.
function nodeModulesComEslint() {
  try {
    const pacote = createRequire(import.meta.url).resolve('eslint/package.json');
    return dirname(dirname(pacote));
  } catch {
    return null;
  }
}

const CONFIG_ESLINT = `export default [{ files: ['**/*.js'], rules: { complexity: ['error', 2] } }];\n`;
const complexa = (nome) => `export function ${nome}(a, b) {\n  if (a) return 1;\n  if (b) return 2;\n  return 3;\n}\n`;

describe('catraca (CLI)', () => {
  describe('cobertura', () => {
    it('taskbuilder, PR ruim: sai 1 e grava o motivo', () => {
      const pasta = pastaTemporaria('cob');
      try {
        const saida = join(pasta, 'catraca-cobertura.json');
        const r = catraca(pasta, [
          'cobertura',
          '--resumo-head', join(FIX, 'pr-ruim.coverage-summary.json'),
          '--base-resumo', join(FIX, 'main.coverage-summary.json'),
          '--raiz', RAIZ_TB,
          '--alterados', join(FIX, 'pr-ruim.alterados.z'),
          '--saida', saida,
        ]);
        assert.equal(r.status, 1, r.stderr);
        const json = JSON.parse(readFileSync(saida, 'utf8'));
        assert.equal(json.passou, false);
        assert.equal(json.global.linhas.status, 'queda');
        assert.equal(json.arquivos.filter((a) => !a.passou).length, 4);
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });

    it('taskbuilder, PR boa: sai 0 mesmo com o repo a 14% de cobertura', () => {
      const pasta = pastaTemporaria('cob');
      try {
        const r = catraca(pasta, [
          'cobertura',
          '--resumo-head', join(FIX, 'pr-boa.coverage-summary.json'),
          '--base-resumo', join(FIX, 'main.coverage-summary.json'),
          '--raiz', RAIZ_TB,
          '--alterados', join(FIX, 'pr-boa.alterados.z'),
          '--saida', join(pasta, 'c.json'),
        ]);
        assert.equal(r.status, 0, r.stderr + r.stdout);
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });

    it('base sem arquivo de cobertura: barra se o head está abaixo do mínimo', () => {
      const pasta = pastaTemporaria('cob');
      try {
        const r = catraca(pasta, [
          'cobertura',
          '--resumo-head', join(FIX, 'pr-boa.coverage-summary.json'),
          '--base-resumo', join(pasta, 'nao-existe.json'),
          '--raiz', RAIZ_TB,
          '--alterados', join(FIX, 'pr-boa.alterados.z'),
          '--saida', join(pasta, 'c.json'),
        ]);
        assert.equal(r.status, 1);
        assert.equal(JSON.parse(readFileSync(join(pasta, 'c.json'), 'utf8')).global.linhas.status, 'sem-base');
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });
  });

  describe('precisa-base e resumo', () => {
    it('lcov abaixo do mínimo pede a base; o resumo publicado volta com os mesmos números', () => {
      const pasta = pastaTemporaria('lcov');
      try {
        const lcov = join(FIX, 'pr-ruim.lcov-trecho.info');
        assert.equal(catraca(pasta, ['precisa-base', '--lcov', lcov]).stdout.trim(), 'precisa=true');
        const resumo = join(pasta, 'publicado', 'coverage-summary.json');
        assert.equal(catraca(pasta, ['resumo', '--lcov', lcov, '--saida', resumo]).status, 0);
        const json = JSON.parse(readFileSync(resumo, 'utf8'));
        assert.deepEqual(Object.keys(json.total), ['lines', 'branches', 'functions']);
        assert.equal(json['src/lib/soma.ts'].lines.pct, 100);
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });

    it('lcov acima do mínimo não pede a base', () => {
      const pasta = pastaTemporaria('lcov');
      try {
        writeFileSync(join(pasta, 'lcov.info'), 'SF:src/a.ts\nLF:10\nLH:9\nBRF:4\nBRH:2\nend_of_record\n');
        assert.equal(catraca(pasta, ['precisa-base', '--lcov', join(pasta, 'lcov.info')]).stdout.trim(), 'precisa=false');
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });
  });

  describe('base e cobertura-base', () => {
    it('acha a base, roda a suíte nela e grava o resumo', () => {
      const geraLcov = "require('fs').mkdirSync('coverage',{recursive:true});require('fs').writeFileSync('coverage/lcov.info','SF:src/a.js\\nLF:4\\nLH:1\\nBRF:0\\nBRH:0\\nend_of_record\\n');";
      const repo = repoComPrMergeada({
        base: {
          'package.json': JSON.stringify({ name: 'x', private: true, scripts: { 'test:coverage': 'node gera.cjs' } }),
          'gera.cjs': geraLcov,
          'src/a.js': 'export const a = 1;\n',
        },
        pr: (raiz) => escrever(raiz, { 'src/b.js': 'export const b = 2;\n' }),
      });
      try {
        mkdirSync(join(repo.clone, 'node_modules'));
        const alterados = join(repo.pasta, 'alterados.z');
        const base = catraca(repo.clone, ['base', '--alterados', alterados]);
        assert.equal(base.status, 0, base.stderr);
        assert.match(base.stdout, new RegExp(`^sha=${repo.shaBase}$`, 'm'));
        assert.match(base.stdout, /^disponivel=true$/m);
        assert.equal(readFileSync(alterados, 'latin1'), 'A\0src/b.js\0');

        const dir = join(repo.pasta, 'base');
        const prep = catraca(repo.clone, ['preparar-base', '--sha', repo.shaBase, '--dir', dir, '--deps', 'auto']);
        assert.equal(prep.status, 0, prep.stderr);
        const resumo = join(repo.pasta, 'cobertura-base', 'coverage-summary.json');
        const suite = catraca(repo.clone, ['cobertura-base', '--dir', dir, '--saida', resumo]);
        assert.equal(suite.status, 0, suite.stderr + suite.stdout);
        assert.deepEqual(JSON.parse(readFileSync(resumo, 'utf8')).total.lines, { total: 4, covered: 1, skipped: 0, pct: 25 });
      } finally {
        repo.limpar();
      }
    });

    it('suíte da base com teste falhando ainda gera a cobertura (reportOnFailure): a PR que conserta a main não fica presa', () => {
      const pasta = pastaTemporaria('suite');
      try {
        // Faz o papel do vitest: com teste falhando, só grava o lcov se receber --coverage.reportOnFailure.
        const gera =
          "const fs=require('fs');" +
          "if(process.argv.includes('--coverage.reportOnFailure')){fs.mkdirSync('coverage',{recursive:true});" +
          "fs.writeFileSync('coverage/lcov.info','SF:src/a.js\\nLF:4\\nLH:2\\nBRF:0\\nBRH:0\\nend_of_record\\n');}" +
          'process.exit(1);';
        escrever(pasta, { 'gera.cjs': gera, 'package.json': JSON.stringify({ scripts: { 'test:coverage': 'node gera.cjs' } }) });
        const resumo = join(pasta, 'saida', 'coverage-summary.json');
        const r = catraca(pasta, ['cobertura-base', '--dir', pasta, '--saida', resumo]);
        assert.equal(r.status, 0, r.stderr);
        assert.deepEqual(JSON.parse(readFileSync(resumo, 'utf8')).total.lines, { total: 4, covered: 2, skipped: 0, pct: 50 });
        assert.match(r.stderr, /suíte da base falhou/);
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });

    it('suíte da base sem lcov (nem com reportOnFailure): sai 1 e não grava resumo', () => {
      const pasta = pastaTemporaria('suite');
      try {
        escrever(pasta, { 'falha.cjs': 'process.exit(1);', 'package.json': JSON.stringify({ scripts: { 'test:coverage': 'node falha.cjs' } }) });
        const resumo = join(pasta, 'saida', 'coverage-summary.json');
        const r = catraca(pasta, ['cobertura-base', '--dir', pasta, '--saida', resumo]);
        assert.equal(r.status, 1);
        assert.equal(existsSync(resumo), false);
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });
  });

  describe('lint (ESLint de verdade, base numa worktree)', () => {
    const nodeModules = nodeModulesComEslint();

    function prepararRepo(pr) {
      const repo = repoComPrMergeada({
        base: {
          'eslint.config.mjs': CONFIG_ESLINT,
          'src/velho.js': complexa('velha'),
          'src/app/[id]/pagina.js': complexa('pagina'),
          'src/renomear.js': complexa('renomear'),
        },
        pr,
      });
      try {
        symlinkSync(nodeModules, join(repo.clone, 'node_modules'));
        mkdirSync(join(repo.clone, 'audit'));
        // O que o passo "ESLint JSON" do workflow faz no head.
        spawnSync(join(repo.clone, 'node_modules/.bin/eslint'), ['.', '--format=json', '--output-file=audit/eslint.json'], { cwd: repo.clone });
        const alterados = join(repo.pasta, 'alterados.z');
        const base = catraca(repo.clone, ['base', '--alterados', alterados]);
        const sha = /^sha=(.+)$/m.exec(base.stdout)[1];
        const dir = join(repo.pasta, 'base');
        assert.equal(catraca(repo.clone, ['preparar-base', '--sha', sha, '--dir', dir, '--deps', 'link']).status, 0);
        return { repo, alterados, dir };
      } catch (erro) {
        // Falhou antes de o teste assumir a limpeza: não deixa a pasta temporária para trás.
        repo.limpar();
        throw erro;
      }
    }

    it('PR que piora: conta só o erro novo, inclusive em caminho com colchetes e em arquivo antigo', { skip: !nodeModules && 'eslint não instalado' }, () => {
      const { repo, alterados, dir } = prepararRepo((raiz) => {
        escrever(raiz, {
          'src/velho.js': complexa('velha') + complexa('outra'),
          'src/app/[id]/pagina.js': complexa('pagina') + complexa('nova'),
          'src/novo.js': complexa('novo'),
        });
        git(raiz, 'mv', 'src/renomear.js', 'src/renomeado.js');
      });
      try {
        const saida = join(repo.clone, 'audit/catraca-lint.json');
        const r = catraca(repo.clone, ['lint', '--eslint', 'audit/eslint.json', '--alterados', alterados, '--base-dir', dir, '--saida', saida]);
        assert.equal(r.status, 1, r.stderr + r.stdout);
        const json = JSON.parse(readFileSync(saida, 'utf8'));
        assert.equal(json.totalHead, 6);
        assert.equal(json.existentes, 3);
        assert.deepEqual(json.novos.map((g) => g.arquivo), ['src/app/[id]/pagina.js', 'src/novo.js', 'src/velho.js']);
      } finally {
        repo.limpar();
      }
    });

    it('PR que só renomeia e cria arquivo limpo passa com a dívida antiga', { skip: !nodeModules && 'eslint não instalado' }, () => {
      const { repo, alterados, dir } = prepararRepo((raiz) => {
        git(raiz, 'mv', 'src/renomear.js', 'src/renomeado.js');
        escrever(raiz, { 'src/limpo.js': 'export const limpo = 1;\n' });
      });
      try {
        const saida = join(repo.clone, 'audit/catraca-lint.json');
        const r = catraca(repo.clone, ['lint', '--eslint', 'audit/eslint.json', '--alterados', alterados, '--base-dir', dir, '--saida', saida]);
        assert.equal(r.status, 0, r.stderr + r.stdout);
        assert.equal(JSON.parse(readFileSync(saida, 'utf8')).existentes, 3);
      } finally {
        repo.limpar();
      }
    });

    it('sem o JSON do ESLint do head não dá para avaliar: barra', () => {
      const pasta = pastaTemporaria('lint');
      try {
        const saida = join(pasta, 'catraca-lint.json');
        const r = catraca(pasta, ['lint', '--eslint', join(pasta, 'nao-existe.json'), '--saida', saida]);
        assert.equal(r.status, 1);
        assert.match(JSON.parse(readFileSync(saida, 'utf8')).motivo, /JSON do ESLint/);
      } finally {
        rmSync(pasta, { recursive: true, force: true });
      }
    });
  });
});
