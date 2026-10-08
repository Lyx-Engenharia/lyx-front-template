// Catraca da cobertura.
//
// Global, por métrica (lines e branches):
//   - head cumpre o mínimo (coverage-lines / coverage-branches): passa, como hoje;
//   - base cumpria o mínimo e o head não: barra, como hoje (repo sem dívida não
//     ganha folga);
//   - base já estava abaixo do mínimo (dívida): o head não pode cair mais de 0,1
//     ponto em relação a ela. Arquivo que a PR apaga sai da conta da base:
//     apagar código coberto não é perder cobertura. A tolerância é por PR e
//     acumula: dez PRs seguidas podem tirar até 1 ponto;
//   - base medida com teste falhando (suíte vermelha na worktree): não vale como
//     referência, porque teste que não rodou baixa a cobertura dela. Com o head
//     abaixo do mínimo, barra.
// Por arquivo (input coverage-files-gate: off, warn ou error; padrão warn): cada
// arquivo com lógica que a PR cria ou altera precisa do mínimo. Em warn aparece
// no relatório e não reprova. "Com lógica" = está no lcov do vitest, ou seja, os
// mesmos excluídos de hoje (coverage.include/exclude do consumidor) ficam fora.
import { extname, isAbsolute, relative, sep } from 'node:path';
import { arquivosCriadosOuAlterados } from './git.mjs';

export const TOLERANCIA_PONTOS = 0.1;
export const MODOS_POR_ARQUIVO = ['off', 'warn', 'error'];
// Chave do coverage-summary com o que não é arquivo (a suíte da base falhou?).
const CHAVE_META = '#lyx-audit';
const EPSILON = 1e-9;
const METRICAS = { linhas: 'lines', branches: 'branches', funcoes: 'functions' };

const zerado = () => ({ total: 0, cobertas: 0 });
const totaisZerados = () => ({ linhas: zerado(), branches: zerado(), funcoes: zerado() });

function somar(alvo, origem) {
  for (const m of Object.keys(METRICAS)) {
    alvo[m].total += origem[m].total;
    alvo[m].cobertas += origem[m].cobertas;
  }
}

function relativo(caminho, raiz) {
  const rel = isAbsolute(caminho) && raiz ? relative(raiz, caminho) : caminho;
  return rel.split(sep).join('/');
}

const CAMPOS_LCOV = {
  'LF:': ['linhas', 'total'],
  'LH:': ['linhas', 'cobertas'],
  'BRF:': ['branches', 'total'],
  'BRH:': ['branches', 'cobertas'],
  'FNF:': ['funcoes', 'total'],
  'FNH:': ['funcoes', 'cobertas'],
};

function aplicarLinhaLcov(atual, linha) {
  for (const [prefixo, [metrica, campo]] of Object.entries(CAMPOS_LCOV)) {
    if (linha.startsWith(prefixo)) {
      atual[metrica][campo] += Number(linha.slice(prefixo.length)) || 0;
      return;
    }
  }
}

/** coverage/lcov.info → { total, arquivos } com contagens (sem arredondar). */
export function lerLcov(conteudo, { raiz } = {}) {
  const arquivos = {};
  let atual = null;
  let caminho = null;
  for (const bruta of conteudo.split('\n')) {
    const linha = bruta.trim();
    if (linha.startsWith('SF:')) {
      caminho = relativo(linha.slice(3), raiz);
      atual = totaisZerados();
    } else if (linha === 'end_of_record') {
      if (caminho !== null) arquivos[caminho] = atual;
      caminho = null;
      atual = null;
    } else if (atual) {
      aplicarLinhaLcov(atual, linha);
    }
  }
  const total = totaisZerados();
  for (const t of Object.values(arquivos)) somar(total, t);
  return { total, arquivos };
}

function metricaDoResumo(m) {
  return { total: Number(m?.total) || 0, cobertas: Number(m?.covered) || 0 };
}

function totaisDoResumo(entrada) {
  return {
    linhas: metricaDoResumo(entrada?.lines),
    branches: metricaDoResumo(entrada?.branches),
    funcoes: metricaDoResumo(entrada?.functions),
  };
}

/**
 * coverage-summary.json (formato json-summary do istanbul/vitest, o mesmo que a
 * catraca publica) → { total, arquivos }. Chave absoluta vira relativa à raiz.
 */
export function lerResumo(json, { raiz } = {}) {
  const arquivos = {};
  for (const [chave, entrada] of Object.entries(json ?? {})) {
    if (chave === 'total' || chave === CHAVE_META) continue;
    arquivos[relativo(chave, raiz)] = totaisDoResumo(entrada);
  }
  const lido = { total: totaisDoResumo(json?.total), arquivos };
  if (json?.[CHAVE_META]?.suiteDaBase === 'falhou') lido.suiteFalhou = true;
  return lido;
}

/** Percentual exato; null quando não há o que medir. */
export function pct(m) {
  return m.total > 0 ? (100 * m.cobertas) / m.total : null;
}

function metricaPublicada(m) {
  const p = pct(m);
  return { total: m.total, covered: m.cobertas, skipped: 0, pct: p === null ? 100 : Math.round(p * 100) / 100 };
}

function totaisPublicados(t) {
  return { lines: metricaPublicada(t.linhas), branches: metricaPublicada(t.branches), functions: metricaPublicada(t.funcoes) };
}

/**
 * { total, arquivos } → coverage-summary.json (json-summary do istanbul).
 * suiteFalhou: a suíte que mediu falhou; vai na chave '#lyx-audit', que o
 * lerResumo devolve como `suiteFalhou` e não conta como arquivo.
 */
export function paraResumo(cobertura, { suiteFalhou = false } = {}) {
  const json = { total: totaisPublicados(cobertura.total) };
  if (suiteFalhou) json[CHAVE_META] = { suiteDaBase: 'falhou' };
  for (const caminho of Object.keys(cobertura.arquivos).sort()) {
    json[caminho] = totaisPublicados(cobertura.arquivos[caminho]);
  }
  return json;
}

// Mesmo arredondamento do lyx-coverage-gate (@lyxai/front-audit): 74,5% conta como 75%.
const cumpre = (m, minimo) => Math.round(pct(m)) >= minimo;

/** A suíte da base só é necessária quando o head está abaixo do mínimo em alguma métrica. */
export function precisaDaBase(head, limites) {
  return [['linhas', limites.linhas], ['branches', limites.branches]].some(
    ([m, minimo]) => head.total[m].total > 0 && !cumpre(head.total[m], minimo),
  );
}

/** Status da global que barram a PR (os demais passam). */
export const STATUS_QUE_BARRAM = new Set(['sem-base', 'queda', 'abaixo-do-minimo', 'base-vermelha']);

function avaliarGlobal(m, { head, base, minimo, tolerancia }) {
  const h = head.total[m];
  const b = base ? base.total[m] : null;
  const resultado = { head: pct(h), base: b ? pct(b) : null, minimo, queda: null };
  if (h.total === 0) return { ...resultado, status: 'sem-dados' };
  if (cumpre(h, minimo)) return { ...resultado, status: 'ok-limite' };
  if (resultado.base === null) return { ...resultado, status: 'sem-base' };
  resultado.queda = resultado.base - resultado.head;
  if (cumpre(b, minimo)) return { ...resultado, status: 'abaixo-do-minimo' };
  // Base abaixo do mínimo só por causa da suíte vermelha daria a tolerância a
  // um repo sem dívida: falha fechada, como sem base.
  if (base.suiteFalhou) return { ...resultado, status: 'base-vermelha' };
  return { ...resultado, status: resultado.queda <= tolerancia + EPSILON ? 'ok-catraca' : 'queda' };
}

function subtrair(alvo, origem) {
  for (const m of Object.keys(METRICAS)) {
    alvo[m].total -= origem[m].total;
    alvo[m].cobertas -= origem[m].cobertas;
  }
}

/**
 * Base comparável com o head: sem os arquivos que a PR apaga. Apagar código
 * coberto baixa a média sem deixar nada descoberto; teste apagado continua
 * contando, porque o arquivo testado fica e a cobertura dele cai.
 */
export function baseSemRemovidos(base, alterados) {
  if (!base) return { base: null, removidos: [] };
  const removidos = (alterados?.removidos ?? []).filter((c) => base.arquivos[c]).sort();
  if (removidos.length === 0) return { base, removidos };
  const total = totaisZerados();
  somar(total, base.total);
  const arquivos = { ...base.arquivos };
  for (const c of removidos) {
    subtrair(total, base.arquivos[c]);
    delete arquivos[c];
  }
  return { base: { ...base, total, arquivos }, removidos };
}

function avaliarArquivo(arquivo, t, limites) {
  const linhasOk = cumpre(t.linhas, limites.linhas);
  const branchesOk = t.branches.total === 0 || cumpre(t.branches, limites.branches);
  return { arquivo, linhas: pct(t.linhas), branches: pct(t.branches), linhasOk, branchesOk, passou: linhasOk && branchesOk };
}

const EXTENSOES_DE_CODIGO = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

/** Arquivos com lógica que a PR cria ou altera, e os de código que ficam fora do coverage. */
function arquivosDaPr(head, alterados, limites) {
  const arquivos = [];
  const foraDaCobertura = [];
  for (const caminho of alterados ? arquivosCriadosOuAlterados(alterados) : []) {
    const t = head.arquivos[caminho];
    if (!t) {
      if (EXTENSOES_DE_CODIGO.has(extname(caminho))) foraDaCobertura.push(caminho);
    } else if (t.linhas.total > 0) {
      arquivos.push(avaliarArquivo(caminho, t, limites));
    }
  }
  return { arquivos, foraDaCobertura };
}

/** Dívida por arquivo do repo inteiro (informativa): arquivos com lógica abaixo do mínimo. */
export function dividaPorArquivo(head, limites) {
  const comLogica = Object.entries(head.arquivos).filter(([, t]) => t.linhas.total > 0);
  const abaixo = comLogica.filter(([caminho, t]) => !avaliarArquivo(caminho, t, limites).passou).length;
  return { abaixo, total: comLogica.length };
}

/**
 * head/base: { total, arquivos } (base.suiteFalhou: medida com teste falhando).
 * base null = indisponível. alterados: saída do parseNameStatusZ (null = não deu
 * para saber o que a PR mudou). porArquivo: input coverage-files-gate; só
 * 'error' reprova pelos arquivos (e por não saber quais a PR mudou).
 */
export function avaliarCobertura({ head, base, alterados, limites, tolerancia = TOLERANCIA_PONTOS, porArquivo = 'warn' }) {
  if (!MODOS_POR_ARQUIVO.includes(porArquivo)) {
    throw new Error(`coverage-files-gate inválido (off, warn ou error): "${porArquivo}"`);
  }
  const comparavel = baseSemRemovidos(base, alterados);
  const global = {
    linhas: avaliarGlobal('linhas', { head, base: comparavel.base, minimo: limites.linhas, tolerancia }),
    branches: avaliarGlobal('branches', { head, base: comparavel.base, minimo: limites.branches, tolerancia }),
  };
  const { arquivos, foraDaCobertura } = porArquivo === 'off' ? { arquivos: [], foraDaCobertura: [] } : arquivosDaPr(head, alterados, limites);
  const globalOk = Object.values(global).every((g) => !STATUS_QUE_BARRAM.has(g.status));
  const arquivosPassou = alterados !== null && arquivos.every((a) => a.passou);
  return {
    passou: globalOk && (porArquivo !== 'error' || arquivosPassou),
    limites,
    tolerancia,
    porArquivo,
    arquivosPassou,
    baseDisponivel: Boolean(base),
    baseSuiteFalhou: Boolean(base?.suiteFalhou),
    alteradosDisponivel: alterados !== null,
    removidosDaBase: comparavel.removidos,
    global,
    arquivos,
    foraDaCobertura,
    dividaPorArquivo: dividaPorArquivo(head, limites),
  };
}
