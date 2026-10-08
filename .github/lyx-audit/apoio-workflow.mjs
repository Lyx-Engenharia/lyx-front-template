// Apoio dos testes do workflow: lê o lyx-audit.yml, avalia os `if:` e os `env:`
// como o GitHub avalia e roda o job passo a passo. Os passos da catraca rodam
// de verdade (bash, node, git); os do consumidor (npm, npx, gh) e os `uses:`
// são simulados com o desfecho que o cenário pede. Assim os testes cobrem a
// ligação entre os passos (ids, outputs, condições), não só cada script.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── YAML (o subconjunto que o lyx-audit.yml usa) ──────────────────────────
// Mapas e listas por recuo, escalares simples ou entre aspas simples, blocos
// `|` e `>-`, comentários de linha inteira. Sem âncoras e sem coleções inline.

const recuoDe = (linha) => linha.length - linha.trimStart().length;
const ignoravel = (linha) => linha.trim() === '' || linha.trimStart().startsWith('#');

function proxima(linhas, i) {
  let j = i;
  while (j < linhas.length && ignoravel(linhas[j])) j += 1;
  return j;
}

function escalar(texto) {
  if (texto.startsWith("'") && texto.endsWith("'")) return texto.slice(1, -1).replace(/''/g, "'");
  if (texto.startsWith('"') && texto.endsWith('"')) return JSON.parse(texto);
  if (texto === 'true' || texto === 'false') return texto === 'true';
  if (/^-?\d+(\.\d+)?$/.test(texto)) return Number(texto);
  return texto;
}

function lerBloco(linhas, i, recuo, estilo) {
  const corpo = [];
  let j = i + 1;
  for (; j < linhas.length; j += 1) {
    if (linhas[j].trim() !== '' && recuoDe(linhas[j]) <= recuo) break;
    corpo.push(linhas[j]);
  }
  while (corpo.length > 0 && corpo.at(-1).trim() === '') corpo.pop();
  const menor = Math.min(...corpo.filter((l) => l.trim() !== '').map(recuoDe));
  const texto = corpo.map((l) => l.slice(menor));
  if (estilo.startsWith('>')) return { valor: texto.join(' ').replace(/\s+/g, ' ').trim(), i: j };
  return { valor: `${texto.join('\n')}${estilo === '|' ? '\n' : ''}`, i: j };
}

function lerPar(linhas, i, recuo, texto, mapa) {
  const m = /^([^:]+?):(?:\s+(.*))?$/.exec(texto);
  if (!m) throw new Error(`YAML: linha ${i + 1} não é chave: valor (${texto})`);
  const chave = String(escalar(m[1].trim()));
  const resto = (m[2] ?? '').trim();
  if (resto === '') {
    const filho = lerNo(linhas, i + 1, recuo + 1);
    mapa[chave] = filho.valor;
    return filho.i;
  }
  if (['|', '|-', '>', '>-'].includes(resto)) {
    const bloco = lerBloco(linhas, i, recuo, resto);
    mapa[chave] = bloco.valor;
    return bloco.i;
  }
  mapa[chave] = escalar(resto);
  return i + 1;
}

function lerMapa(linhas, i, recuo) {
  const mapa = {};
  let j = proxima(linhas, i);
  while (j < linhas.length && recuoDe(linhas[j]) === recuo && !linhas[j].trimStart().startsWith('- ')) {
    j = proxima(linhas, lerPar(linhas, j, recuo, linhas[j].trim(), mapa));
  }
  return { valor: mapa, i: j };
}

function lerLista(linhas, i, recuo) {
  const lista = [];
  let j = proxima(linhas, i);
  while (j < linhas.length && recuoDe(linhas[j]) === recuo && linhas[j].trimStart().startsWith('- ')) {
    const texto = linhas[j].trimStart().slice(2).trim();
    if (/^[\w.-]+:(\s|$)/.test(texto)) {
      const item = {};
      const depois = lerPar(linhas, j, recuo + 2, texto, item);
      const resto = lerMapa(linhas, depois, recuo + 2);
      lista.push({ ...item, ...resto.valor });
      j = resto.i;
    } else {
      lista.push(escalar(texto));
      j = proxima(linhas, j + 1);
    }
  }
  return { valor: lista, i: j };
}

function lerNo(linhas, i, recuoMinimo) {
  const j = proxima(linhas, i);
  if (j >= linhas.length || recuoDe(linhas[j]) < recuoMinimo) return { valor: null, i: j };
  const recuo = recuoDe(linhas[j]);
  return linhas[j].trimStart().startsWith('- ') ? lerLista(linhas, j, recuo) : lerMapa(linhas, j, recuo);
}

export function lerYaml(texto) {
  return lerNo(texto.split('\n'), 0, 0).valor;
}

// ─── Expressões ${{ }} ────────────────────────────────────────────────────
// Operadores ! && || == !=, parênteses, literais, contexto por caminho com ponto
// (inputs.skip-deps-check, steps.cache_base.outputs.cache-hit) e funções.
// Igualdade como a do GitHub: texto sem diferenciar caixa; tipos diferentes
// viram número (null = 0, booleano = 0 ou 1).

const TOKEN = /\s*(?:('(?:[^']|'')*')|(-?\d+(?:\.\d+)?)|([A-Za-z_][\w.-]*)|(==|!=|&&|\|\||[!(),]))/y;

function tokenizar(texto) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < texto.length) {
    if (texto.slice(TOKEN.lastIndex).trim() === '') break;
    const m = TOKEN.exec(texto);
    if (!m) throw new Error(`expressão inválida: ${texto}`);
    if (m[1] !== undefined) tokens.push({ tipo: 'texto', valor: m[1].slice(1, -1).replace(/''/g, "'") });
    else if (m[2] !== undefined) tokens.push({ tipo: 'numero', valor: Number(m[2]) });
    else if (m[3] !== undefined) tokens.push({ tipo: 'nome', valor: m[3] });
    else tokens.push({ tipo: 'op', valor: m[4] });
  }
  return tokens;
}

export const verdadeiro = (v) => !(v === false || v === null || v === undefined || v === 0 || v === '' || Number.isNaN(v));

function comoNumero(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') return v.trim() === '' ? 0 : Number(v);
  return v;
}

function igual(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return comoNumero(a) === comoNumero(b);
}

function caminho(contexto, nome) {
  let atual = contexto;
  for (const parte of nome.split('.')) {
    if (atual === null || typeof atual !== 'object' || !(parte in atual)) return null;
    atual = atual[parte];
  }
  return atual ?? null;
}

export function avaliar(expressao, contexto, funcoes = {}) {
  const corpo = /^\s*\$\{\{([\s\S]*)\}\}\s*$/.exec(expressao)?.[1] ?? expressao;
  const tokens = tokenizar(corpo);
  let i = 0;
  const olhar = () => tokens[i]?.valor;
  const pegar = (esperado) => {
    const t = tokens[i];
    i += 1;
    if (esperado !== undefined && t?.valor !== esperado) throw new Error(`esperava ${esperado} em: ${corpo}`);
    return t;
  };
  const ou = () => {
    let a = e();
    while (olhar() === '||') {
      pegar();
      const b = e();
      a = verdadeiro(a) ? a : b;
    }
    return a;
  };
  const e = () => {
    let a = igualdade();
    while (olhar() === '&&') {
      pegar();
      const b = igualdade();
      a = verdadeiro(a) ? b : a;
    }
    return a;
  };
  const igualdade = () => {
    let a = unario();
    while (olhar() === '==' || olhar() === '!=') {
      const op = pegar().valor;
      const b = unario();
      a = op === '==' ? igual(a, b) : !igual(a, b);
    }
    return a;
  };
  const unario = () => {
    if (olhar() === '!') {
      pegar();
      return !verdadeiro(unario());
    }
    return primario();
  };
  const primario = () => {
    const t = pegar();
    if (!t) throw new Error(`expressão incompleta: ${corpo}`);
    if (t.valor === '(') {
      const v = ou();
      pegar(')');
      return v;
    }
    if (t.tipo === 'texto' || t.tipo === 'numero') return t.valor;
    if (t.tipo !== 'nome') throw new Error(`token inesperado ${t.valor} em: ${corpo}`);
    if (olhar() === '(') {
      pegar('(');
      const args = [];
      while (olhar() !== ')') {
        args.push(ou());
        if (olhar() === ',') pegar();
      }
      pegar(')');
      if (!funcoes[t.valor]) throw new Error(`função ${t.valor}() fora do simulador`);
      return funcoes[t.valor](...args);
    }
    if (t.valor === 'true' || t.valor === 'false') return t.valor === 'true';
    if (t.valor === 'null') return null;
    return caminho(contexto, t.valor);
  };
  const valor = ou();
  if (i !== tokens.length) throw new Error(`sobrou expressão em: ${corpo}`);
  return valor;
}

/** Troca cada ${{ }} do texto pelo valor (null vira vazio), como no env: e no with:. */
export function interpolar(texto, contexto, funcoes) {
  if (typeof texto !== 'string') return texto === null || texto === undefined ? '' : String(texto);
  return texto.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expr) => {
    const v = avaliar(expr, contexto, funcoes);
    return v === null || v === undefined ? '' : String(v);
  });
}

// ─── O job ────────────────────────────────────────────────────────────────

function lerArquivoDeComandos(caminhoArq) {
  const pares = {};
  if (!existsSync(caminhoArq)) return pares;
  for (const linha of readFileSync(caminhoArq, 'utf8').split('\n')) {
    const k = linha.indexOf('=');
    if (k > 0) pares[linha.slice(0, k)] = linha.slice(k + 1);
  }
  return pares;
}

function inputsComPadrao(workflow, inputs) {
  const declarados = workflow.on.workflow_call.inputs;
  const valores = {};
  for (const [nome, def] of Object.entries(declarados)) valores[nome] = def.default ?? null;
  for (const [nome, valor] of Object.entries(inputs)) {
    if (!(nome in declarados)) throw new Error(`input ${nome} não existe no workflow`);
    valores[nome] = valor;
  }
  return valores;
}

function envDoPasso(estado, passo) {
  const env = { ...estado.envDoRunner };
  for (const [k, v] of Object.entries(estado.job.env ?? {})) env[k] = interpolar(v, estado.ctx, estado.funcoes);
  for (const [k, v] of Object.entries(passo.env ?? {})) env[k] = interpolar(v, estado.ctx, estado.funcoes);
  return env;
}

// Como o GitHub roda um `run:` sem `shell:`, com GITHUB_OUTPUT e GITHUB_ENV próprios.
function rodarDeVerdade(estado, passo, n) {
  if (typeof passo.run !== 'string') throw new Error(`${passo.name}: passo sem run não roda de verdade`);
  const dir = join(estado.envDoRunner.RUNNER_TEMP, 'simulador', String(n));
  mkdirSync(dir, { recursive: true });
  const env = { ...envDoPasso(estado, passo), GITHUB_OUTPUT: join(dir, 'output'), GITHUB_ENV: join(dir, 'env') };
  writeFileSync(env.GITHUB_OUTPUT, '');
  writeFileSync(env.GITHUB_ENV, '');
  const script = interpolar(passo.run, estado.ctx, estado.funcoes);
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { cwd: estado.cwd, env, encoding: 'utf8' });
  Object.assign(estado.envDoRunner, lerArquivoDeComandos(env.GITHUB_ENV));
  return { outcome: r.status === 0 ? 'success' : 'failure', outputs: lerArquivoDeComandos(env.GITHUB_OUTPUT), saida: r.stdout + r.stderr };
}

function simular(estado, passo, cenario = {}) {
  cenario.efeito?.(estado.cwd, { env: envDoPasso(estado, passo) });
  return { outcome: cenario.outcome ?? 'success', outputs: cenario.outputs ?? {}, saida: '' };
}

/**
 * Roda o job `audit` do workflow em `cwd`.
 * executar: nomes dos passos que rodam de verdade (bash como o GitHub roda).
 * simulados: { [nome]: { outcome, outputs, efeito(cwd, { env }) } } para os
 *   demais; passo simulado sem entrada no cenário termina em success.
 * contexto: github, job e runner (o simulador soma inputs e steps).
 * envBase: o ambiente do runner (PATH, RUNNER_TEMP...).
 * Devolve cada passo (rodou, outcome, outputs, saída) na ordem do YAML.
 */
export function rodarJob({ workflow, cwd, inputs = {}, contexto, executar, simulados = {}, envBase }) {
  const job = workflow.jobs.audit;
  const steps = {};
  const estado = { job, cwd, ctx: { ...contexto, inputs: inputsComPadrao(workflow, inputs), steps }, envDoRunner: { ...envBase }, jobFalhou: false };
  estado.funcoes = { always: () => true, success: () => !estado.jobFalhou, failure: () => estado.jobFalhou, cancelled: () => false };
  return job.steps.map((passo, n) => {
    const nome = passo.name ?? passo.uses ?? `passo ${n + 1}`;
    const rodou = verdadeiro(avaliar(passo.if ?? 'success()', estado.ctx, estado.funcoes));
    const r = !rodou ? { outcome: 'skipped', outputs: {}, saida: '' } : executar.includes(nome) ? rodarDeVerdade(estado, passo, n) : simular(estado, passo, simulados[nome]);
    if (r.outcome === 'failure' && passo['continue-on-error'] !== true) estado.jobFalhou = true;
    if (passo.id) steps[passo.id] = { outcome: r.outcome, conclusion: r.outcome, outputs: r.outputs };
    return { nome, id: passo.id ?? null, rodou, ...r };
  });
}
