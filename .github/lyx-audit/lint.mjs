// Catraca do lint: erro que já existia na base não conta; erro novo conta,
// mesmo em arquivo antigo.
//
// Um erro é identificado por (arquivo, regra, mensagem com números trocados por
// #). Linha e coluna ficam de fora porque mudam com qualquer edição acima do
// erro. A comparação é por quantidade: 1 "Arrow function has too many lines" na
// base e 3 no head são 2 erros novos. Por desenho, piorar um erro que já existe
// não conta (a mesma função passar de complexidade 13 para 40): a catraca barra
// erro novo, não o tamanho do antigo.
//
// Quando a PR mexe nas dependências, a base é lintada com as dependências dela
// e a mensagem de uma regra pode mudar de texto entre versões: aí o erro é
// (arquivo, regra), contado por quantidade (porRegra).
import { isAbsolute, relative, sep } from 'node:path';
import { mapaDeRenomeados } from './git.mjs';

/**
 * Primeira linha da mensagem, sem as raízes dos checkouts, com números como #.
 * As regras do React Compiler (react-hooks/*) trazem caminho absoluto e um
 * trecho do código nas linhas seguintes, que mudam entre head e base.
 */
export function normalizarMensagem(mensagem, raizes = []) {
  let texto = String(mensagem ?? '').split('\n')[0];
  for (const raiz of raizes) {
    if (raiz) texto = texto.split(`${raiz}/`).join('').split(raiz).join('');
  }
  return texto
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export function caminhoRelativo(caminho, raiz) {
  const rel = isAbsolute(caminho) && raiz ? relative(raiz, caminho) : caminho;
  return rel.split(sep).join('/');
}

function nomeDaRegra(m) {
  if (m.ruleId) return m.ruleId;
  return m.fatal ? '(parse)' : '(sem regra)';
}

/** Erros (severity 2) do JSON do `eslint --format json`, com caminho relativo à raiz. */
export function errosDoEslint(resultados, raiz) {
  const erros = [];
  for (const r of resultados ?? []) {
    const arquivo = caminhoRelativo(r.filePath, raiz);
    for (const m of r.messages ?? []) {
      if (m.severity !== 2) continue;
      erros.push({
        arquivo,
        regra: nomeDaRegra(m),
        mensagem: String(m.message ?? '').split('\n')[0],
        assinatura: normalizarMensagem(m.message, [raiz]),
        linha: m.line ?? 0,
        coluna: m.column ?? 0,
      });
    }
  }
  return erros;
}

const chaveDaMensagem = (e) => `${e.arquivo}\u0000${e.regra}\u0000${e.assinatura}`;
const chaveDaRegra = (e) => `${e.arquivo}\u0000${e.regra}`;

function agrupar(erros, chave) {
  const grupos = new Map();
  for (const e of erros) {
    const k = chave(e);
    const g = grupos.get(k) ?? { arquivo: e.arquivo, regra: e.regra, mensagem: e.mensagem, ocorrencias: [] };
    g.ocorrencias.push(e);
    grupos.set(k, g);
  }
  return grupos;
}

/**
 * Compara os erros do head com os da base. `alterados` traz os renames da PR:
 * o erro do arquivo renomeado é comparado no caminho novo. Base null = base
 * indisponível, e aí todo erro do head conta (não afrouxa sem medir).
 * porRegra: compara por (arquivo, regra), sem a mensagem.
 */
export function compararErros(errosHead, errosBase, { alterados = null, porRegra = false } = {}) {
  const renomeados = mapaDeRenomeados(alterados);
  const base = (errosBase ?? []).map((e) => ({ ...e, arquivo: renomeados.get(e.arquivo) ?? e.arquivo }));
  const chave = porRegra ? chaveDaRegra : chaveDaMensagem;
  const naBase = agrupar(base, chave);
  const noHead = agrupar(errosHead, chave);
  const novos = [];
  let existentes = 0;
  for (const [k, g] of noHead) {
    const quantosNaBase = naBase.get(k)?.ocorrencias.length ?? 0;
    const quantosNoHead = g.ocorrencias.length;
    existentes += Math.min(quantosNaBase, quantosNoHead);
    if (quantosNoHead <= quantosNaBase) continue;
    novos.push({
      arquivo: g.arquivo,
      regra: g.regra,
      mensagem: g.mensagem,
      linhas: g.ocorrencias.map((e) => e.linha).sort((a, b) => a - b),
      noHead: quantosNoHead,
      naBase: quantosNaBase,
      novos: quantosNoHead - quantosNaBase,
    });
  }
  novos.sort((a, b) => a.arquivo.localeCompare(b.arquivo) || a.regra.localeCompare(b.regra) || a.linhas[0] - b.linhas[0]);
  return {
    baseDisponivel: errosBase !== null && errosBase !== undefined,
    comparacao: porRegra ? 'regra' : 'mensagem',
    totalHead: errosHead.length,
    totalBase: base.length,
    existentes,
    corrigidos: base.length - existentes,
    novos,
  };
}

/**
 * Arquivos a lintar na base: os que têm erro no head, no caminho da base.
 * Arquivo criado pela PR não existe na base (todo erro dele é novo).
 * Lintar também os que a PR não tocou pega erro novo vindo de mudança de config.
 */
export function arquivosParaLintDaBase(errosHead, alterados) {
  const criados = new Set(alterados?.criados ?? []);
  const deParaInverso = new Map((alterados?.renomeados ?? []).map((r) => [r.para, r.de]));
  const lista = new Set();
  for (const e of errosHead) {
    if (criados.has(e.arquivo)) continue;
    lista.add(deParaInverso.get(e.arquivo) ?? e.arquivo);
  }
  return [...lista].sort();
}
