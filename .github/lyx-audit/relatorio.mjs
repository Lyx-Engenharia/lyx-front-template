// Comentário do bot na PR com a catraca: primeiro o que barra esta PR, depois a
// dívida do repo inteiro (o relatório do @lyxai/front-audit), como informativa.
import { STATUS_QUE_BARRAM } from './cobertura.mjs';

const MARCADOR = '<!-- audit-report -->';
const MAX_ITENS = 30;

const STATUS = { success: 'OK', failure: 'FAIL', skipped: 'não rodou', cancelled: 'não rodou' };
const statusDe = (outcome) => STATUS[outcome] ?? 'não rodou';
const ok = (passou) => (passou ? 'OK' : 'FAIL');

function decimal(n) {
  return n.toFixed(2).replace('.', ',');
}
const pct2 = (n) => `${decimal(n)}%`;
const inteiro = (n) => `${Math.round(n)}%`;

function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

function linhaTabela(check, status, detalhe = '') {
  return `| ${check} | ${status} | ${detalhe} |`;
}

function linhaLint(checks, lint) {
  if (checks.lint === 'success') return linhaTabela('Lint (erros novos)', 'OK', 'nenhum erro de lint');
  if (checks.lint !== 'failure') return linhaTabela('Lint (erros novos)', 'não rodou', '');
  if (!lint) return linhaTabela('Lint (erros novos)', 'FAIL', 'a catraca do lint não rodou (veja os logs)');
  if (lint.motivo) return linhaTabela('Lint (erros novos)', 'FAIL', lint.motivo);
  const novos = lint.novos.reduce((s, g) => s + g.novos, 0);
  const antigos = lint.baseDisponivel
    ? `${plural(lint.existentes, 'já existia', 'já existiam')} na base`
    : 'base indisponível: todo erro conta';
  const quantos = novos === 0 ? 'nenhum erro novo' : plural(novos, 'erro novo', 'erros novos');
  return linhaTabela('Lint (erros novos)', ok(lint.passou), `${quantos} · ${antigos}`);
}

const ROTULO_METRICA = { linhas: 'lines', branches: 'branches' };

const pontos = (n) => `${decimal(n)} ${n >= 2 ? 'pontos' : 'ponto'}`;

function detalheGlobal(g) {
  const base = g.base === null ? '' : ` (base ${pct2(g.base)})`;
  switch (g.status) {
    case 'ok-limite':
      return `${pct2(g.head)}: cumpre o mínimo de ${g.minimo}%`;
    case 'ok-catraca':
      return `${pct2(g.head)}${base}: abaixo de ${g.minimo}% não pode cair mais de 0,1 ponto`;
    case 'queda':
      return `${pct2(g.head)}${base}: caiu ${pontos(g.queda)} (abaixo de ${g.minimo}% pode cair até 0,1)`;
    case 'abaixo-do-minimo':
      return `${pct2(g.head)}${base}: a base cumpria o mínimo de ${g.minimo}% e esta PR deixa a global abaixo dele`;
    case 'sem-base':
      return `${pct2(g.head)}, abaixo de ${g.minimo}%, e a cobertura da base não foi medida`;
    default:
      return 'sem dados no lcov';
  }
}

function detalheArquivos(cobertura) {
  const { limites, arquivos } = cobertura;
  const abaixo = arquivos.filter((a) => !a.passou).length;
  if (cobertura.alteradosDisponivel === false) return 'não deu para saber o que a PR mudou';
  if (arquivos.length === 0) return 'nenhum arquivo com lógica';
  if (abaixo === 0) {
    return `${plural(arquivos.length, 'arquivo', 'arquivos')}, todos com ${limites.linhas}% lines e ${limites.branches}% branches ou mais`;
  }
  return `${abaixo} de ${arquivos.length} abaixo de ${limites.linhas}% lines ou ${limites.branches}% branches`;
}

function linhasCobertura(checks, cobertura) {
  if (checks.testes !== 'success' && checks.testes !== 'failure') {
    return [linhaTabela('Cobertura', 'não rodou', 'os testes não rodaram')];
  }
  if (!cobertura) return [linhaTabela('Cobertura', 'FAIL', 'a catraca da cobertura não rodou (veja os logs)')];
  const linhas = Object.entries(cobertura.global).map(([m, g]) =>
    linhaTabela(`Cobertura global (${ROTULO_METRICA[m]})`, ok(!STATUS_QUE_BARRAM.has(g.status)), detalheGlobal(g)),
  );
  const arquivosOk = cobertura.alteradosDisponivel !== false && cobertura.arquivos.every((a) => a.passou);
  linhas.push(linhaTabela('Arquivos que a PR cria ou altera', ok(arquivosOk), detalheArquivos(cobertura)));
  return linhas;
}

function tabelaDoGate({ checks, lint, cobertura }) {
  const testes = checks.testes === 'skipped' && checks.typecheck === 'failure' ? 'typecheck quebrado: corrija o tipo e a suíte roda' : '';
  return [
    '| Check | Status | Detalhe |',
    '|---|---|---|',
    linhaLint(checks, lint),
    linhaTabela('Typecheck', statusDe(checks.typecheck)),
    linhaTabela('Testes', statusDe(checks.testes), testes),
    ...linhasCobertura(checks, cobertura),
    linhaTabela('Ciclos de import', statusDe(checks.deps)),
  ];
}

function cortar(lista, rotulo) {
  if (lista.length <= MAX_ITENS) return lista;
  return [...lista.slice(0, MAX_ITENS), `- _... e mais ${lista.length - MAX_ITENS} ${rotulo}_`];
}

function secaoLintNovos(lint) {
  if (!lint?.novos?.length) return [];
  const total = lint.novos.reduce((s, g) => s + g.novos, 0);
  const itens = lint.novos.map((g) => {
    const extra = g.naBase > 0 || g.novos > 1 ? ` (${plural(g.novos, 'novo', 'novos')}: ${g.noHead} no head, ${g.naBase} na base)` : '';
    return `- \`${g.arquivo}:${g.linhas.join(', ')}\` · \`${g.regra}\` · ${g.mensagem}${extra}`;
  });
  return ['', `#### Erros de lint novos (${total})`, '', ...cortar(itens, 'grupos de erro')];
}

function celula(valor, okMetrica, minimo) {
  if (valor === null) return 'sem branches';
  return okMetrica ? inteiro(valor) : `${inteiro(valor)} (mínimo ${minimo}%)`;
}

function secaoArquivos(cobertura) {
  const abaixo = (cobertura?.arquivos ?? []).filter((a) => !a.passou);
  const fora = cobertura?.foraDaCobertura ?? [];
  const linhas = [];
  if (abaixo.length > 0) {
    const { limites } = cobertura;
    const itens = abaixo.map(
      (a) => `| \`${a.arquivo}\` | ${celula(a.linhas, a.linhasOk, limites.linhas)} | ${celula(a.branches, a.branchesOk, limites.branches)} |`,
    );
    linhas.push('', '#### Arquivos abaixo do mínimo', '', '| Arquivo | Lines | Branches |', '|---|---|---|', ...cortar(itens, 'arquivos'));
  }
  if (fora.length > 0) {
    linhas.push('', `_${plural(fora.length, 'arquivo de código alterado fica', 'arquivos de código alterados ficam')} fora da cobertura (o coverage do vitest.config exclui: specs, páginas, tipos, ui)._`);
  }
  const removidos = cobertura?.removidosDaBase ?? [];
  if (removidos.length > 0) {
    linhas.push('', `_${plural(removidos.length, 'arquivo que esta PR apaga sai', 'arquivos que esta PR apaga saem')} da conta da base: apagar código coberto não é perder cobertura._`);
  }
  return linhas;
}

function linhaDividaPorArquivo(cobertura) {
  const divida = cobertura?.dividaPorArquivo;
  if (!divida || divida.total === 0) return [];
  const { linhas, branches } = cobertura.limites;
  return [
    `Arquivos com lógica abaixo de ${linhas}% lines ou ${branches}% branches: ${divida.abaixo} de ${divida.total}. Cada um passa a ser cobrado quando uma PR o cria ou altera.`,
    '',
  ];
}

/**
 * Relatório do pacote sem marcador e título, com os títulos um nível abaixo e sem
 * travessão (o do pacote vira dois-pontos).
 */
function dividaDoRepo(relatorioDoRepo, cobertura) {
  const corpo = String(relatorioDoRepo ?? '')
    .split('\n')
    .filter((l) => l.trim() !== MARCADOR && !l.startsWith('## Audit Report'))
    .map((l) => (/^#{3,5} /.test(l) ? `#${l}` : l))
    .join('\n')
    .replace(/[^\S\n]+[\u2013\u2014][^\S\n]+/g, ': ')
    .replace(/[\u2013\u2014]/g, '-')
    .trim();
  const texto = corpo || '_Panorama do repo indisponível: o relatório do @lyxai/front-audit não rodou (veja os logs)._';
  return ['', '---', '', '### Dívida do repo inteiro (informativa, não barra esta PR)', '', ...linhaDividaPorArquivo(cobertura), texto];
}

function introducao(base, limites) {
  const minimos = `Mínimo de cobertura: ${limites.linhas}% lines e ${limites.branches}% branches.`;
  if (base?.disponivel) {
    return `Barra só o que esta PR piora em relação à base \`${String(base.sha).slice(0, 7)}\`. ${minimos}`;
  }
  const motivo = base?.motivo ?? 'sem motivo registrado';
  return `Base da PR indisponível (${motivo}): sem ela, todo erro de lint conta e a cobertura global volta ao mínimo absoluto. ${minimos}`;
}

export function montarRelatorio({ sha, base, limites, checks, lint, cobertura, relatorioDoRepo }) {
  const md = [
    MARCADOR,
    '',
    `## Audit Report · commit \`${String(sha ?? '').slice(0, 7)}\``,
    '',
    '### Gate desta PR (catraca)',
    '',
    introducao(base, limites),
    '',
    ...tabelaDoGate({ checks, lint, cobertura }),
    ...secaoLintNovos(lint),
    ...secaoArquivos(cobertura),
    ...dividaDoRepo(relatorioDoRepo, cobertura),
  ];
  return `${md.join('\n')}\n`;
}
