#!/usr/bin/env node
// CLI da catraca do lyx-audit.yml. Cada subcomando é um passo do workflow:
//
//   base           --alterados <arq>                       sha da base (HEAD^1) e diff da PR
//   preparar-base  --sha <sha> --dir <dir> --deps link|auto worktree da base fora do workspace
//   lint           --eslint <json> [--alterados] [--base-dir] --saida <json>
//   precisa-base   --lcov <lcov>                            a cobertura da base é necessária?
//   cobertura-base --dir <dir> --saida <json>               roda a suíte na base e resume
//   resumo         --lcov <lcov> --saida <json>             coverage-summary publicado da main
//   cobertura      --lcov|--resumo-head --base-resumo --alterados --saida [--raiz]
//   relatorio      --repo <md> --lint <json> --cobertura <json>   (markdown no stdout)
//
// Env: AUDIT_LINES_MIN, AUDIT_BRANCHES_MIN e AUDIT_COVERAGE_FILES_GATE (off, warn
// ou error: a regra por arquivo da cobertura; vazio = warn).
// Saída 1 = a catraca barrou (ou não deu para avaliar). Sem dependência: só node.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { MODOS_POR_ARQUIVO, avaliarCobertura, lerLcov, lerResumo, paraResumo, precisaDaBase } from './cobertura.mjs';
import { depsDaBase, listarAlterados, parseNameStatusZ, prepararBase, resolverBase } from './git.mjs';
import { arquivosParaLintDaBase, compararErros, errosDoEslint } from './lint.mjs';
import { montarRelatorio } from './relatorio.mjs';

const OPCOES = {
  alterados: { type: 'string' },
  'base-dir': { type: 'string' },
  'base-resumo': { type: 'string' },
  cobertura: { type: 'string' },
  deps: { type: 'string', default: 'link' },
  dir: { type: 'string' },
  eslint: { type: 'string' },
  lcov: { type: 'string' },
  lint: { type: 'string' },
  raiz: { type: 'string' },
  repo: { type: 'string' },
  'resumo-head': { type: 'string' },
  saida: { type: 'string' },
  sha: { type: 'string' },
};

// Mesma leitura do lyx-coverage-gate: vazio vale o padrão, nunca zera o gate.
function percentualDoEnv(nome, padrao) {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === '') return padrao;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error(`${nome} inválido (inteiro 0-100): "${bruto}"`);
  return n;
}

const limitesDoEnv = () => ({
  linhas: percentualDoEnv('AUDIT_LINES_MIN', 75),
  branches: percentualDoEnv('AUDIT_BRANCHES_MIN', 40),
});

// Input coverage-files-gate. Vazio vale o padrão (warn); valor errado é erro, não vira warn calado.
function porArquivoDoEnv() {
  const bruto = (process.env.AUDIT_COVERAGE_FILES_GATE ?? '').trim();
  if (bruto === '') return 'warn';
  if (!MODOS_POR_ARQUIVO.includes(bruto)) {
    throw new Error(`AUDIT_COVERAGE_FILES_GATE inválido (off, warn ou error): "${bruto}"`);
  }
  return bruto;
}

function lerJson(caminho) {
  if (!caminho || !existsSync(caminho)) return null;
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'));
  } catch {
    return null;
  }
}

function gravarJson(caminho, dados) {
  mkdirSync(dirname(resolve(caminho)), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`);
}

function lerAlterados(caminho) {
  return caminho && existsSync(caminho) ? parseNameStatusZ(readFileSync(caminho)) : null;
}

function exigir(op, ...nomes) {
  for (const nome of nomes) {
    if (!op[nome]) throw new Error(`falta --${nome}`);
  }
}

function base(op) {
  exigir(op, 'alterados');
  const b = resolverBase({ cwd: process.cwd() });
  if (b.disponivel) {
    mkdirSync(dirname(resolve(op.alterados)), { recursive: true });
    writeFileSync(op.alterados, listarAlterados({ cwd: process.cwd(), sha: b.sha }));
  } else {
    console.error(`[catraca] ${b.motivo}`);
  }
  const motivo = b.motivo ? `motivo=${b.motivo.replace(/\s+/g, ' ')}\n` : '';
  process.stdout.write(`sha=${b.sha}\ndisponivel=${b.disponivel}\n${motivo}`);
  return 0;
}

function prepararBaseCmd(op) {
  exigir(op, 'sha', 'dir');
  const r = prepararBase({ cwd: process.cwd(), sha: op.sha, dir: resolve(op.dir), deps: op.deps });
  console.error(`[catraca] base ${op.sha.slice(0, 7)} em ${r.dir} (dependências: ${r.deps})`);
  return 0;
}

function binarioEslint(dir) {
  const local = join(dir, 'node_modules', '.bin', 'eslint');
  return existsSync(local) ? { cmd: local, args: [] } : { cmd: 'npx', args: ['--no-install', 'eslint'] };
}

/**
 * ESLint na worktree da base, só nos arquivos com erro no head. Os caminhos vão
 * como argumento do processo, sem shell: `[sectorId]` não vira glob, e o ESLint 9
 * trata caminho de arquivo que existe como arquivo (não como padrão).
 */
function lintarNaBase(dir, arquivos) {
  const existentes = arquivos.filter((a) => existsSync(join(dir, a)));
  if (existentes.length === 0) return [];
  const saida = join(dirname(dir), 'eslint-base.json');
  const { cmd, args } = binarioEslint(dir);
  const r = spawnSync(
    cmd,
    [...args, '--format', 'json', '--output-file', saida, '--no-warn-ignored', '--no-error-on-unmatched-pattern', '--', ...existentes],
    { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const json = lerJson(saida);
  if (r.status > 1 || !Array.isArray(json)) {
    throw new Error(`ESLint falhou na base (saída ${r.status}): ${String(r.stderr).slice(0, 500)}`);
  }
  // O ESLint devolve o caminho real (no macOS /var é link para /private/var).
  return errosDoEslint(json, realpathSync(dir));
}

/** Erros da base, ou o motivo de não ter base (aí todo erro do head conta). */
function errosDaBase(dir, errosHead, alterados) {
  if (!dir || !existsSync(dir)) return { errosBase: null, motivoBase: 'worktree da base indisponível', deps: null };
  const deps = depsDaBase(dir);
  if (deps === 'ausente') {
    return { errosBase: null, motivoBase: 'a base ficou sem node_modules (a instalação das dependências dela falhou?)', deps };
  }
  try {
    return { errosBase: lintarNaBase(dir, arquivosParaLintDaBase(errosHead, alterados)), motivoBase: null, deps };
  } catch (erro) {
    return { errosBase: null, motivoBase: erro.message, deps };
  }
}

function lint(op) {
  exigir(op, 'eslint', 'saida');
  const head = lerJson(op.eslint);
  if (!Array.isArray(head)) {
    gravarJson(op.saida, { passou: false, motivo: `sem o JSON do ESLint do head (${op.eslint}): não deu para avaliar` });
    return 1;
  }
  const errosHead = errosDoEslint(head, process.cwd());
  if (errosHead.length === 0) {
    const motivo = 'o lint falhou, mas o JSON do ESLint não tem erro (ESLint quebrou? veja o passo Lint)';
    gravarJson(op.saida, { passou: false, motivo });
    return 1;
  }
  const alterados = lerAlterados(op.alterados);
  const dir = op['base-dir'] ? resolve(op['base-dir']) : null;
  const { errosBase, motivoBase, deps } = errosDaBase(dir, errosHead, alterados);
  // Base com as próprias dependências = a PR mexeu nelas, e a mensagem de uma
  // regra pode mudar de texto entre versões: compara por (arquivo, regra).
  const r = compararErros(errosHead, errosBase, { alterados, porRegra: deps === 'instalado' });
  const passou = r.novos.length === 0;
  gravarJson(op.saida, { passou, motivoBase, depsDaBase: deps, ...r });
  console.error(
    `[catraca] lint: ${r.novos.reduce((s, g) => s + g.novos, 0)} erro(s) novo(s), ${r.existentes} já existiam na base` +
      ` (dependências da base: ${deps ?? 'sem base'}; comparação por ${r.comparacao})`,
  );
  return passou ? 0 : 1;
}

function precisaBase(op) {
  exigir(op, 'lcov');
  const precisa = existsSync(op.lcov) && precisaDaBase(lerLcov(readFileSync(op.lcov, 'utf8'), { raiz: process.cwd() }), limitesDoEnv());
  process.stdout.write(`precisa=${precisa}\n`);
  return 0;
}

function resumo(op) {
  exigir(op, 'lcov', 'saida');
  if (!existsSync(op.lcov)) {
    console.error(`[catraca] ${op.lcov} não existe`);
    return 1;
  }
  gravarJson(op.saida, paraResumo(lerLcov(readFileSync(op.lcov, 'utf8'), { raiz: process.cwd() })));
  return 0;
}

/**
 * Custo: uma rodada a mais da suíte (a mesma do head). Só quando o head está
 * abaixo do mínimo e não há cache. Com --coverage.reportOnFailure o vitest grava
 * a cobertura mesmo com teste falhando na base; o resumo sai com a marca da
 * suíte vermelha, e essa base não vale como referência (teste que não rodou
 * baixa a cobertura dela). Saída 1 nesse caso: o cache só guarda base verde, e
 * a próxima rodada mede de novo (teste instável pode passar).
 */
function coberturaBase(op) {
  exigir(op, 'dir', 'saida');
  const dir = resolve(op.dir);
  rmSync(join(dir, 'coverage'), { recursive: true, force: true });
  const r = spawnSync('npm', ['run', 'test:coverage', '--', '--coverage.reportOnFailure'], { cwd: dir, stdio: 'inherit' });
  const lcov = join(dir, 'coverage', 'lcov.info');
  if (!existsSync(lcov)) {
    console.error(`[catraca] a suíte da base não gerou ${lcov} (saída ${r.status}): cobertura da base indisponível`);
    return 1;
  }
  const suiteFalhou = r.status !== 0;
  gravarJson(op.saida, paraResumo(lerLcov(readFileSync(lcov, 'utf8'), { raiz: realpathSync(dir) }), { suiteFalhou }));
  if (!suiteFalhou) return 0;
  console.error(`[catraca] a suíte da base falhou (saída ${r.status}): a cobertura dela fica no relatório, mas não vale como base`);
  return 1;
}

function cobertura(op) {
  exigir(op, 'saida');
  let porArquivo;
  try {
    porArquivo = porArquivoDoEnv();
  } catch (erro) {
    gravarJson(op.saida, { passou: false, motivo: erro.message });
    throw erro;
  }
  const raiz = op.raiz ? resolve(op.raiz) : process.cwd();
  let head = null;
  const resumoHead = lerJson(op['resumo-head']);
  if (resumoHead) head = lerResumo(resumoHead, { raiz });
  else if (op.lcov && existsSync(op.lcov)) head = lerLcov(readFileSync(op.lcov, 'utf8'), { raiz });
  if (!head) {
    gravarJson(op.saida, { passou: false, motivo: 'sem cobertura do head (coverage/lcov.info não existe)' });
    return 1;
  }
  const jsonBase = lerJson(op['base-resumo']);
  const r = avaliarCobertura({
    head,
    base: jsonBase ? lerResumo(jsonBase, { raiz }) : null,
    alterados: lerAlterados(op.alterados),
    limites: limitesDoEnv(),
    porArquivo,
  });
  gravarJson(op.saida, r);
  console.error(`[catraca] cobertura: ${r.passou ? 'ok' : 'barrou'} (lines ${r.global.linhas.status}, branches ${r.global.branches.status})`);
  return r.passou ? 0 : 1;
}

function relatorio(op) {
  const env = process.env;
  const md = montarRelatorio({
    sha: env.LYX_HEAD_SHA,
    base: { sha: env.LYX_BASE_SHA, disponivel: env.LYX_BASE_DISPONIVEL === 'true', motivo: env.LYX_BASE_MOTIVO || undefined },
    limites: limitesDoEnv(),
    checks: { lint: env.LINT, typecheck: env.TYPECHECK, testes: env.TESTS, deps: env.DEPS },
    lint: lerJson(op.lint),
    cobertura: lerJson(op.cobertura),
    relatorioDoRepo: op.repo && existsSync(op.repo) ? readFileSync(op.repo, 'utf8') : '',
  });
  process.stdout.write(md);
  return 0;
}

export const COMANDOS = {
  base,
  'preparar-base': prepararBaseCmd,
  lint,
  'precisa-base': precisaBase,
  'cobertura-base': coberturaBase,
  resumo,
  cobertura,
  relatorio,
};

export { OPCOES };

function main() {
  const [comando, ...resto] = process.argv.slice(2);
  const fn = COMANDOS[comando];
  if (!fn) {
    console.error(`uso: catraca.mjs <${Object.keys(COMANDOS).join('|')}> [opções]`);
    return 2;
  }
  const { values } = parseArgs({ args: resto, options: OPCOES, strict: true });
  return fn(values);
}

// Roda só quando chamado como script: o teste do workflow importa COMANDOS e OPCOES.
function chamadoComoScript() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (chamadoComoScript()) {
  try {
    process.exitCode = main();
  } catch (erro) {
    console.error(`[catraca] ${erro.message}`);
    process.exitCode = 1;
  }
}
