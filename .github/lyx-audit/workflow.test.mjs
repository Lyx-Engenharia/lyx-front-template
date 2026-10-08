// Testes do lyx-audit.yml: o passo que decide o status do job, a ligação entre o
// YAML e a CLI da catraca e os passos do lint rodando de verdade.
// LYX_AUDIT_WORKFLOW troca o arquivo testado (útil para rodar contra a versão da
// main e ver o que muda).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMANDOS, OPCOES } from './catraca.mjs';
import { GIT_ENV, escrever, frontComPluginDeLint, npmOffline, pacoteDoFront, passosDoWorkflow, repoComPrMergeada } from './apoio-teste.mjs';

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
