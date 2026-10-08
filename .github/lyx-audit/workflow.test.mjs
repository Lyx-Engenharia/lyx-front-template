// Testes do lyx-audit.yml: o passo que decide o status do job, a ligação entre o
// YAML e a CLI da catraca, os passos do lint rodando de verdade e o job inteiro
// simulado (apoio-workflow.mjs: if: e env: avaliados como o GitHub avalia).
// LYX_AUDIT_WORKFLOW troca o arquivo testado (útil para rodar contra a versão da
// main e ver o que muda).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMANDOS, OPCOES } from './catraca.mjs';
import { GIT_ENV, escrever, frontComPluginDeLint, git, npmOffline, pacoteDoFront, passosDoWorkflow, repoComPrMergeada } from './apoio-teste.mjs';
import { avaliar as avaliarExpressao, interpolar, lerYaml, rodarJob } from './apoio-workflow.mjs';

const WORKFLOW = process.env.LYX_AUDIT_WORKFLOW ?? fileURLToPath(new URL('../workflows/lyx-audit.yml', import.meta.url));
const TEXTO = readFileSync(WORKFLOW, 'utf8');
const PASSOS = passosDoWorkflow(TEXTO);
const CLI = fileURLToPath(new URL('./catraca.mjs', import.meta.url));

// ESLint de verdade do template (o npm ci do catraca-tests traz). Sem ele, os testes de ponta a ponta do lint são pulados.
function binDoEslint() {
  try {
    return join(dirname(createRequire(import.meta.url).resolve('eslint/package.json')), 'bin', 'eslint.js');
  } catch {
    return null;
  }
}

/** Roda o `run:` de um passo como o GitHub roda (bash --noprofile --norc -eo pipefail). */
function rodarPasso(nome, { cwd, env }) {
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', scriptDoPasso(nome)], { cwd, env, encoding: 'utf8' });
  return { status: r.status, saida: r.stdout + r.stderr };
}

function scriptDoPasso(nome) {
  const passo = PASSOS.find((p) => p.nome === nome);
  assert.ok(passo?.run, `passo "${nome}" com run no workflow`);
  return passo.run;
}

// O GitHub roda o `run:` sem `shell:` como `bash -e {0}`.
function avaliar(env) {
  const r = spawnSync('bash', ['-e', '-c', scriptDoPasso('Avaliar status final')], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
  return { status: r.status, saida: r.stdout + r.stderr };
}

const PR = {
  TYPECHECK: 'success',
  TESTS: 'success',
  DEPS: 'success',
  GATE_MODE: 'error',
  EVENTO: 'pull_request',
  CATRACA_PEDIDA: 'true',
};

describe('lyx-audit.yml', () => {
  describe('Avaliar status final', () => {
    it('taskbuilder, PR boa: lint e cobertura do repo vermelhos, catraca verde, job verde', () => {
      const r = avaliar({ ...PR, LINT: 'failure', COVERAGE: 'success', CATRACA_ATIVA: 'true', CATRACA_LINT: 'success', CATRACA_COBERTURA: 'success' });
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /Tudo verde/);
    });

    it('erro de lint novo barra', () => {
      const r = avaliar({ ...PR, LINT: 'failure', COVERAGE: 'success', CATRACA_ATIVA: 'true', CATRACA_LINT: 'failure', CATRACA_COBERTURA: 'success' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /::error::Falhas: lint/);
    });

    it('lint vermelho e a catraca do lint não chegou a rodar: barra (não afrouxa sem medir)', () => {
      const r = avaliar({ ...PR, LINT: 'failure', COVERAGE: 'success', CATRACA_ATIVA: 'true', CATRACA_LINT: '', CATRACA_COBERTURA: 'success' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /Falhas: lint/);
    });

    it('cobertura que a PR piora barra, mesmo com o gate do repo inteiro em modo informativo', () => {
      const r = avaliar({ ...PR, LINT: 'success', COVERAGE: 'success', CATRACA_ATIVA: 'true', CATRACA_COBERTURA: 'failure' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /Falhas: coverage/);
    });

    it('repo sem dívida e PR limpa: verde', () => {
      const r = avaliar({ ...PR, LINT: 'success', COVERAGE: 'success', CATRACA_ATIVA: 'true', CATRACA_COBERTURA: 'success' });
      assert.equal(r.status, 0, r.saida);
    });

    it('typecheck quebrado: barra pelo typecheck; a cobertura, que não rodou, não entra na conta', () => {
      const r = avaliar({ ...PR, TYPECHECK: 'failure', TESTS: 'skipped', LINT: 'success', COVERAGE: 'skipped', CATRACA_ATIVA: 'true', CATRACA_COBERTURA: '' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /Falhas: typecheck/);
      assert.doesNotMatch(r.saida, /Falhas:.*coverage/);
    });

    it('push na main publicando a cobertura: a dívida de lint e cobertura não pinta a main', () => {
      const r = avaliar({ ...PR, EVENTO: 'push', LINT: 'failure', COVERAGE: 'failure', CATRACA_PUBLICAR: 'true' });
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /informativo/);
    });

    it('push na main com teste quebrado continua vermelho', () => {
      const r = avaliar({ ...PR, EVENTO: 'push', TESTS: 'failure', LINT: 'success', COVERAGE: 'failure', CATRACA_PUBLICAR: 'true' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /Falhas: tests/);
    });

    it('ratchet: false volta ao gate absoluto do repo inteiro', () => {
      const r = avaliar({ ...PR, CATRACA_PEDIDA: 'false', LINT: 'failure', COVERAGE: 'failure' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /Falhas: lint coverage/);
      assert.doesNotMatch(r.saida, /::warning::/);
    });

    it('scripts da catraca não carregaram: gate absoluto, com aviso', () => {
      const r = avaliar({ ...PR, LINT: 'failure', COVERAGE: 'failure' });
      assert.equal(r.status, 1);
      assert.match(r.saida, /::warning::Catraca pedida/);
    });

    it('gate-mode warn: verde mesmo com a catraca barrando', () => {
      const r = avaliar({ ...PR, GATE_MODE: 'warn', LINT: 'failure', COVERAGE: 'success', CATRACA_ATIVA: 'true', CATRACA_LINT: 'failure', CATRACA_COBERTURA: 'failure' });
      assert.equal(r.status, 0, r.saida);
    });
  });

  describe('catraca do lint de ponta a ponta: os passos do YAML com git, npm e ESLint de verdade', () => {
    const eslint = binDoEslint();
    const pular = !eslint && 'eslint não instalado';
    const CODIGO_COM_CONSOLE = { 'src/a.js': "export const proibido = 1;\nconsole.log('oi');\n" };

    // O caminho do pull_request: npm ci no head, base da PR, ESLint JSON e a catraca do lint.
    function rodarCatracaDoLint({ base, pr }) {
      const repo = repoComPrMergeada({
        base: (raiz) => {
          escrever(raiz, base);
          npmOffline(raiz, 'install', '--package-lock-only');
        },
        pr: (raiz) => {
          pr(raiz);
          npmOffline(raiz, 'install', '--package-lock-only');
        },
      });
      try {
        const temp = join(repo.pasta, 'runner-temp');
        mkdirSync(temp);
        const saidaGh = join(temp, 'github-output');
        writeFileSync(saidaGh, '');
        const env = { ...GIT_ENV, LYX_AUDIT: CLI, RUNNER_TEMP: temp, GITHUB_OUTPUT: saidaGh };
        npmOffline(repo.clone, 'ci');
        assert.equal(rodarPasso('Catraca: base da PR', { cwd: repo.clone, env }).status, 0);
        const sha = /^sha=(.*)$/m.exec(readFileSync(saidaGh, 'utf8'))?.[1];
        assert.equal(sha, repo.shaBase);
        rodarPasso('Prepare audit dir', { cwd: repo.clone, env });
        assert.equal(rodarPasso('ESLint JSON', { cwd: repo.clone, env }).status, 1, 'o head tem erro de lint');
        const r = rodarPasso('Catraca: lint (erros novos)', { cwd: repo.clone, env: { ...env, BASE_SHA: sha } });
        const json = JSON.parse(readFileSync(join(repo.clone, 'audit/catraca-lint.json'), 'utf8'));
        return { ...r, json };
      } finally {
        repo.limpar();
      }
    }

    it('PR que só sobe o plugin e ele liga regra nova: o erro conta como novo (a base é lintada com as dependências dela)', { skip: pular }, () => {
      const r = rodarCatracaDoLint({
        base: frontComPluginDeLint({ binDoEslint: eslint, versao: 1, codigo: CODIGO_COM_CONSOLE }),
        pr: (raiz) => escrever(raiz, { 'package.json': pacoteDoFront(2) }),
      });
      assert.equal(r.status, 1, r.saida);
      assert.deepEqual(r.json.novos.map((g) => [g.arquivo, g.regra, g.novos]), [['src/a.js', 'no-console', 1]]);
      assert.equal(r.json.existentes, 1, 'fake/proibido já existia na base, com o texto da 1.0.0');
      assert.equal(r.json.depsDaBase, 'instalado');
      assert.equal(r.json.comparacao, 'regra');
    });

    it('PR que só sobe o plugin e ele reescreve a mensagem: o erro antigo continua antigo', { skip: pular }, () => {
      const r = rodarCatracaDoLint({
        base: frontComPluginDeLint({ binDoEslint: eslint, versao: 1, codigo: { 'src/a.js': 'export const proibido = 1;\n' } }),
        pr: (raiz) => escrever(raiz, { 'package.json': pacoteDoFront(2) }),
      });
      assert.equal(r.status, 0, r.saida);
      assert.deepEqual(r.json.novos, []);
      assert.equal(r.json.existentes, 1);
    });

    it('PR que não mexe nas dependências: a base usa o node_modules do head (sem npm ci) e só o erro novo conta', { skip: pular }, () => {
      const r = rodarCatracaDoLint({
        base: frontComPluginDeLint({ binDoEslint: eslint, versao: 1, codigo: CODIGO_COM_CONSOLE }),
        pr: (raiz) => escrever(raiz, { 'src/b.js': 'export const proibido = 2;\n' }),
      });
      assert.equal(r.status, 1, r.saida);
      assert.deepEqual(r.json.novos.map((g) => [g.arquivo, g.regra, g.novos]), [['src/b.js', 'fake/proibido', 1]]);
      assert.equal(r.json.depsDaBase, 'link');
      assert.equal(r.json.comparacao, 'mensagem');
    });
  });

  describe('expressões ${{ }} do simulador (a semântica do GitHub que os if: usam)', () => {
    const ctx = { inputs: { ratchet: true, 'skip-deps-check': false }, steps: { tests: { outcome: 'failure', outputs: {} }, c: { outputs: {} } } };
    it('saída que não existe é null: != compara como diferente, == como igual a vazio', () => {
      assert.equal(avaliarExpressao("${{ steps.c.outputs.cache-hit != 'true' }}", ctx), true);
      assert.equal(avaliarExpressao("${{ steps.c.outputs.cache-hit == '' }}", ctx), true);
      assert.equal(avaliarExpressao("${{ steps.c.outputs.ativa == 'true' }}", ctx), false);
    });
    it('precedência: ! e == antes de &&, && antes de ||; texto sem diferenciar caixa', () => {
      assert.equal(avaliarExpressao("${{ !inputs.skip-deps-check && (steps.tests.outcome == 'success' || steps.tests.outcome == 'FAILURE') }}", ctx), true);
      assert.equal(avaliarExpressao("${{ inputs.ratchet && 'warn' || 'error' }}", ctx), 'warn');
      assert.equal(interpolar('modo=${{ inputs.ratchet }} x=${{ steps.c.outputs.nada }}.', ctx), 'modo=true x=.');
    });
  });

  describe('o job inteiro simulado: condições dos passos (if:), outputs entre passos e o status final', () => {
    const eslintDoTemplate = binDoEslint();
    const nodeModulesDoTemplate = eslintDoTemplate && dirname(dirname(dirname(eslintDoTemplate)));
    const pular = !eslintDoTemplate && 'eslint não instalado';
    const WF = lerYaml(TEXTO);
    // Rodam de verdade: os passos da catraca e os que só usam bash, node e git.
    // Os demais (npm, npx do pacote, gh, uses:) são simulados pelo cenário.
    const EXECUTAR = [
      'Catraca: preparar',
      'Catraca: base da PR',
      'Prepare audit dir',
      'ESLint JSON',
      'Catraca: lint (erros novos)',
      'Catraca: cobertura da base é necessária?',
      'Catraca: suíte na base (sem cache)',
      'Catraca: cobertura',
      'Catraca: publicar a cobertura da main',
      'Relatório: gate da PR e dívida do repo',
      'Avaliar status final',
    ];
    const SCRIPTS = dirname(CLI);
    const lcov = (arquivos) =>
      Object.entries(arquivos)
        .map(([arquivo, [total, cobertas]]) => `SF:${arquivo}\nLF:${total}\nLH:${cobertas}\nBRF:0\nBRH:0\nend_of_record\n`)
        .join('');
    // test:coverage da base: grava o lcov; com `falha`, só grava com --coverage.reportOnFailure e sai 1 (o vitest faz assim).
    const geraCobertura = (arquivos, { falha = false } = {}) =>
      [
        "const fs = require('fs');",
        `const grava = () => { fs.mkdirSync('coverage', { recursive: true }); fs.writeFileSync('coverage/lcov.info', ${JSON.stringify(lcov(arquivos))}); };`,
        falha ? "if (process.argv.includes('--coverage.reportOnFailure')) grava(); process.exit(1);" : 'grava();',
        '',
      ].join('\n');
    const CONFIG = `export default [{ files: ['src/**/*.js'], rules: { complexity: ['error', 2] } }];\n`;
    const complexa = (nome) => `export function ${nome}(a, b) {\n  if (a) return 1;\n  if (b) return 2;\n  return 3;\n}\n`;

    function repo({ baseCobertura, baseFalha = false, pr }) {
      const r = repoComPrMergeada({
        base: {
          'package.json': JSON.stringify({ name: 'front', private: true, scripts: { 'test:coverage': 'node gera.cjs' } }),
          'gera.cjs': geraCobertura(baseCobertura, { falha: baseFalha }),
          'eslint.config.mjs': CONFIG,
          'src/velho.js': complexa('velha'),
          'src/resto.js': 'export const resto = 1;\n',
        },
        pr,
      });
      try {
        // O node_modules do template faz o papel do npm ci do consumidor (ESLint de verdade).
        symlinkSync(nodeModulesDoTemplate, join(r.clone, 'node_modules'));
      } catch (erro) {
        r.limpar();
        throw erro;
      }
      return r;
    }

    function rodar(r, { evento = 'pull_request', inputs = {}, scriptsCarregam = true, simulados = {} } = {}) {
      const temp = join(r.pasta, 'runner-temp');
      mkdirSync(temp, { recursive: true });
      const contexto = {
        github: {
          event_name: evento,
          repository: 'Lyx-Engenharia/lyx-front-de-teste',
          ref_name: evento === 'push' ? 'main' : '7/merge',
          sha: 'f'.repeat(40),
          run_id: 1,
          event: { repository: { default_branch: 'main' }, pull_request: evento === 'pull_request' ? { number: 7, head: { sha: 'a'.repeat(40) } } : null },
        },
        job: { workflow_repository: 'Lyx-Engenharia/lyx-front-template', workflow_sha: 'b'.repeat(40) },
        runner: { temp },
      };
      // O checkout esparso dos scripts do template, entre repos (o consumidor não é o template).
      const scripts = {
        outcome: scriptsCarregam ? 'success' : 'failure',
        efeito: (cwd) => {
          if (!scriptsCarregam) return;
          const destino = join(cwd, '.lyx-audit-template/.github/lyx-audit');
          mkdirSync(destino, { recursive: true });
          for (const f of readdirSync(SCRIPTS).filter((n) => n.endsWith('.mjs'))) cpSync(join(SCRIPTS, f), join(destino, f));
        },
      };
      const passos = rodarJob({
        workflow: WF,
        cwd: r.clone,
        inputs,
        contexto,
        executar: EXECUTAR,
        simulados: { 'Catraca: scripts do template': scripts, ...simulados },
        envBase: { ...GIT_ENV, RUNNER_TEMP: temp, GITHUB_REF_NAME: contexto.github.ref_name },
      });
      const por = (nome) => {
        const p = passos.find((x) => x.nome === nome);
        assert.ok(p, `passo "${nome}" no workflow`);
        return p;
      };
      const relatorio = join(r.clone, 'audit/report.md');
      return { passos, por, final: por('Avaliar status final'), relatorio: existsSync(relatorio) ? readFileSync(relatorio, 'utf8') : '' };
    }

    // Consumidor com o desfecho pedido; os testes do head gravam o lcov do head.
    const consumidor = ({ lint = 'success', typecheck = 'success', testes = 'success', headCobertura }) => ({
      Lint: { outcome: lint },
      Typecheck: { outcome: typecheck },
      'Tests + coverage': {
        outcome: testes,
        efeito: (cwd) => escrever(cwd, { 'coverage/lcov.info': lcov(headCobertura) }),
      },
    });
    const rodou = (job, nome) => job.por(nome).rodou;

    it('todo passo que o simulador roda de verdade existe no workflow', () => {
      const nomes = WF.jobs.audit.steps.map((p) => p.name);
      for (const nome of EXECUTAR) assert.ok(nomes.includes(nome), nome);
    });

    it('PR boa num repo com dívida, scripts vindos de outro repo: a catraca inteira roda (inclusive a suíte na base) e o job fica verde', { skip: pular }, () => {
      const r = repo({ baseCobertura: { 'src/velho.js': [10, 2], 'src/resto.js': [90, 18] }, pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }) });
      try {
        const job = rodar(r, { simulados: consumidor({ lint: 'failure', headCobertura: { 'src/velho.js': [10, 2], 'src/resto.js': [90, 18], 'src/novo.js': [10, 10] } }) });
        for (const nome of ['Catraca: lint (erros novos)', 'Catraca: suíte na base (sem cache)', 'Catraca: cache da cobertura da base (desta PR)', 'Catraca: cobertura']) {
          assert.equal(job.por(nome).outcome, 'success', `${nome}: ${job.por(nome).saida}`);
        }
        assert.equal(job.por('Catraca: base da PR').outputs.disponivel, 'true');
        assert.equal(job.final.outcome, 'success', job.final.saida);
        assert.match(job.final.saida, /Modo: +catraca/);
        assert.match(job.relatorio, /\| Lint \(erros novos\) \| OK \| nenhum erro novo · 1 já existia na base \|/);
      } finally {
        r.limpar();
      }
    });

    it('scripts do template não carregaram: nenhum passo da catraca roda e o gate volta ao absoluto, com aviso', { skip: pular }, () => {
      const r = repo({ baseCobertura: { 'src/velho.js': [10, 2], 'src/resto.js': [90, 18] }, pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }) });
      try {
        const job = rodar(r, { scriptsCarregam: false, simulados: consumidor({ lint: 'failure', headCobertura: { 'src/velho.js': [10, 2] } }) });
        assert.equal(job.por('Catraca: preparar').outcome, 'failure');
        for (const nome of ['Catraca: base da PR', 'Catraca: lint (erros novos)', 'Catraca: cobertura da base é necessária?', 'Catraca: cobertura']) {
          assert.equal(rodou(job, nome), false, nome);
        }
        assert.equal(job.final.outcome, 'failure');
        assert.match(job.final.saida, /Modo: +absoluto/);
        assert.match(job.final.saida, /::warning::Catraca pedida/);
        assert.match(job.final.saida, /Falhas: lint/);
      } finally {
        r.limpar();
      }
    });

    it('HEAD sem commit de merge (base indisponível): não mede a base, a catraca da cobertura avalia sem ela e barra o head abaixo do mínimo', { skip: pular }, () => {
      const r = repo({ baseCobertura: { 'src/resto.js': [100, 20] }, pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }) });
      try {
        git(r.clone, 'checkout', '-q', 'HEAD^2');
        const job = rodar(r, { simulados: consumidor({ headCobertura: { 'src/resto.js': [100, 20] } }) });
        assert.equal(job.por('Catraca: base da PR').outputs.disponivel, 'false');
        assert.equal(rodou(job, 'Catraca: cobertura da base é necessária?'), false);
        assert.equal(rodou(job, 'Catraca: suíte na base (sem cache)'), false);
        assert.equal(job.por('Catraca: cobertura').outcome, 'failure');
        assert.equal(job.final.outcome, 'failure');
        assert.match(job.final.saida, /Falhas: coverage/);
      } finally {
        r.limpar();
      }
    });

    it('typecheck quebrado: testes e catraca da cobertura não rodam, e o job barra pelo typecheck', { skip: pular }, () => {
      const r = repo({ baseCobertura: { 'src/resto.js': [100, 90] }, pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }) });
      try {
        const job = rodar(r, { simulados: consumidor({ typecheck: 'failure', headCobertura: {} }) });
        assert.equal(rodou(job, 'Tests + coverage'), false);
        assert.equal(rodou(job, 'Catraca: cobertura'), false);
        assert.equal(rodou(job, 'Coverage gate (global)'), false);
        // Só o typecheck na lista de falhas (o que vem depois do nome é a pontuação da mensagem).
        assert.match(job.final.saida, /::error::Falhas: typecheck \W/);
      } finally {
        r.limpar();
      }
    });

    it('cobertura da base no cache: a suíte da base não roda e o cache não é salvo de novo', { skip: pular }, () => {
      const r = repo({ baseCobertura: { 'src/resto.js': [100, 20] }, pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }) });
      try {
        const doCache = (cwd, { env }) => {
          const resumo = join(env.RUNNER_TEMP, 'lyx-audit/cobertura-base/coverage-summary.json');
          mkdirSync(dirname(resumo), { recursive: true });
          writeFileSync(resumo, JSON.stringify({ total: { lines: { total: 100, covered: 20 }, branches: { total: 0, covered: 0 } } }));
        };
        const job = rodar(r, {
          simulados: {
            ...consumidor({ headCobertura: { 'src/resto.js': [100, 20], 'src/novo.js': [10, 10] } }),
            'Catraca: cobertura da base (cache)': { outputs: { 'cache-hit': 'true' }, efeito: doCache },
          },
        });
        assert.equal(rodou(job, 'Catraca: suíte na base (sem cache)'), false);
        assert.equal(rodou(job, 'Catraca: cache da cobertura da base (desta PR)'), false);
        assert.equal(job.por('Catraca: cobertura').outcome, 'success', job.por('Catraca: cobertura').saida);
        assert.equal(job.final.outcome, 'success', job.final.saida);
      } finally {
        r.limpar();
      }
    });

    it('suíte da base vermelha: a catraca da cobertura barra e o cache da PR não guarda essa base', { skip: pular }, () => {
      const r = repo({
        baseCobertura: { 'src/resto.js': [100, 20] },
        baseFalha: true,
        pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }),
      });
      try {
        const job = rodar(r, { simulados: consumidor({ headCobertura: { 'src/resto.js': [100, 20], 'src/novo.js': [10, 10] } }) });
        assert.equal(job.por('Catraca: suíte na base (sem cache)').outcome, 'failure');
        assert.equal(rodou(job, 'Catraca: cache da cobertura da base (desta PR)'), false);
        assert.equal(job.por('Catraca: cobertura').outcome, 'failure');
        assert.match(job.relatorio, /a suíte da base falhou, então a cobertura dela não vale como referência/);
        assert.match(job.final.saida, /Falhas: coverage/);
      } finally {
        r.limpar();
      }
    });

    it('coverage-files-gate: o padrão (warn) deixa passar a PR que altera arquivo antigo abaixo do mínimo; error barra', { skip: pular }, () => {
      const baseCobertura = { 'src/velho.js': [10, 2], 'src/resto.js': [190, 188] };
      const pr = (raiz) => escrever(raiz, { 'src/velho.js': `${complexa('velha')}// mexido\n` });
      const cenario = { simulados: consumidor({ headCobertura: baseCobertura }) };
      for (const [inputs, esperado] of [[{}, 'success'], [{ 'coverage-files-gate': 'error' }, 'failure'], [{ 'coverage-files-gate': 'off' }, 'success']]) {
        const r = repo({ baseCobertura, pr });
        try {
          const job = rodar(r, { ...cenario, inputs });
          assert.equal(job.final.outcome, esperado, `${JSON.stringify(inputs)}: ${job.final.saida}`);
          if (esperado === 'success' && !inputs['coverage-files-gate']) {
            assert.match(job.relatorio, /\| Arquivos que a PR cria ou altera \| AVISO \|/);
          }
        } finally {
          r.limpar();
        }
      }
    });

    it('push na main: publica a cobertura da main, sem catraca, e lint e cobertura do repo ficam informativos', { skip: pular }, () => {
      const r = repo({ baseCobertura: { 'src/resto.js': [100, 20] }, pr: (raiz) => escrever(raiz, { 'src/novo.js': 'export const novo = 1;\n' }) });
      try {
        const job = rodar(r, {
          evento: 'push',
          simulados: { ...consumidor({ lint: 'failure', headCobertura: { 'src/resto.js': [100, 20] } }), 'Coverage gate (global)': { outcome: 'failure' } },
        });
        assert.equal(job.por('Catraca: preparar').outputs.publicar, 'true');
        assert.equal(rodou(job, 'Catraca: base da PR'), false);
        assert.equal(job.por('Catraca: publicar a cobertura da main').outcome, 'success');
        assert.equal(rodou(job, 'Catraca: cache da cobertura da main (para as PRs)'), true);
        assert.equal(rodou(job, 'Upsert PR comment'), false);
        assert.equal(job.final.outcome, 'success', job.final.saida);
      } finally {
        r.limpar();
      }
    });
  });

  describe('ligação com a CLI da catraca', () => {
    it('todo subcomando e toda opção que o workflow passa para a catraca existem na CLI', () => {
      const chamadas = PASSOS.filter((p) => p.run?.includes('"$LYX_AUDIT"')).flatMap((p) =>
        p.run
          .replace(/\\\n\s*/g, ' ')
          .split('\n')
          .filter((l) => l.includes('node "$LYX_AUDIT"'))
          .map((l) => l.slice(l.indexOf('node "$LYX_AUDIT"'))),
      );
      assert.ok(chamadas.length >= 8, `chamadas encontradas: ${chamadas.length}`);
      for (const chamada of chamadas) {
        const [, comando] = /node "\$LYX_AUDIT" ([a-z-]+)/.exec(chamada) ?? [];
        assert.ok(COMANDOS[comando], `subcomando "${comando}" (${chamada})`);
        for (const [, opcao] of chamada.matchAll(/ --([a-z-]+)/g)) {
          assert.ok(OPCOES[opcao], `opção --${opcao} (${chamada})`);
        }
      }
    });

    it('o input ratchet nasce opcional e com padrão que liga a catraca', () => {
      const bloco = /\n {6}ratchet:\n((?: {8}.*\n| {10}.*\n)+)/.exec(TEXTO)?.[1] ?? '';
      assert.match(bloco, /type: boolean/);
      assert.match(bloco, /default: true/);
      assert.doesNotMatch(bloco, /required: true/);
    });

    it('os inputs de antes continuam lá', () => {
      for (const input of ['coverage-lines', 'coverage-branches', 'gate-mode', 'node-version', 'next-public-api-url', 'skip-deps-check', 'timeout-minutes', 'runs-on']) {
        assert.match(TEXTO, new RegExp(`\\n {6}${input}:\\n`), input);
      }
    });

    it('o checkout traz a base da PR (HEAD^1 do merge)', () => {
      assert.match(TEXTO, /- name: Checkout consumer repo\n\s+uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 2\n/);
    });

    it('a chave do cache que a PR lê é a mesma que a main publica', () => {
      const chaves = [...TEXTO.matchAll(/key: (lyx-audit-cobertura-[^$]*)\$\{\{ ([^}]+) \}\}/g)].map((m) => [m[1], m[2].trim()]);
      assert.deepEqual(chaves, [
        ['lyx-audit-cobertura-v1-', 'steps.base.outputs.sha'],
        ['lyx-audit-cobertura-v1-', 'steps.base.outputs.sha'],
        ['lyx-audit-cobertura-v1-', 'github.sha'],
      ]);
    });

    it('os scripts do template saem do workspace antes do lint, do typecheck e dos testes do consumidor', () => {
      const ordem = (nome) => PASSOS.findIndex((p) => p.nome === nome);
      assert.match(scriptDoPasso('Catraca: preparar'), /trap 'rm -rf \.lyx-audit-template' EXIT/);
      for (const passo of ['Lint', 'Typecheck', 'Tests + coverage', 'ESLint JSON']) {
        assert.ok(ordem('Catraca: preparar') < ordem(passo), passo);
      }
      assert.match(TEXTO, /sparse-checkout: \.github\/lyx-audit\/\*\.mjs\n/);
    });
  });
});
