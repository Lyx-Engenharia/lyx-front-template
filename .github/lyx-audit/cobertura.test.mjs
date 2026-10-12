import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliarCobertura, lerLcov, lerResumo, paraResumo, pct, precisaDaBase } from './cobertura.mjs';
import { parseNameStatusZ } from './git.mjs';

// Fixtures sintéticos de um front com dívida: formato real do json-summary do vitest, do
// lcov e do git diff -z, com caminhos, nomes e números inventados.
const FIX = new URL('./fixtures/front-sintetico/', import.meta.url);
const RAIZ = '/home/runner/work/front-exemplo/front-exemplo';
const LIMITES = { linhas: 75, branches: 40 };

function resumo(nome) {
  return lerResumo(JSON.parse(readFileSync(new URL(nome, FIX), 'utf8')), { raiz: RAIZ });
}
function alterados(nome) {
  return parseNameStatusZ(readFileSync(new URL(nome, FIX)));
}
function totais(linhas, linhasCobertas, branches = 0, branchesCobertas = 0) {
  return {
    linhas: { total: linhas, cobertas: linhasCobertas },
    branches: { total: branches, cobertas: branchesCobertas },
    funcoes: { total: 0, cobertas: 0 },
  };
}
function cobertura(total, arquivos = {}) {
  return { total, arquivos };
}
function soModificados(...caminhos) {
  return { criados: [], modificados: caminhos, renomeados: [], removidos: [] };
}

describe('cobertura', () => {
  describe('lerResumo', () => {
    it('lê o coverage-summary.json do vitest (main de um front com dívida) com chave absoluta', () => {
      const c = resumo('main.coverage-summary.json');
      assert.deepEqual(c.total.linhas, { total: 6059, cobertas: 987 });
      assert.deepEqual(c.total.branches, { total: 3720, cobertas: 621 });
      assert.ok(c.arquivos['src/lib/formato.ts']);
      assert.ok(c.arquivos['src/app/painel/[equipeId]/linha/linha.helpers.ts']);
      assert.equal(Object.keys(c.arquivos).length, 163);
    });

    it('volta igual depois de passar pelo formato publicado (paraResumo)', () => {
      const c = resumo('pr-ruim.coverage-summary.json');
      assert.deepEqual(lerResumo(JSON.parse(JSON.stringify(paraResumo(c)))), c);
    });

    it('a marca de suíte vermelha vai junto no resumo e não vira arquivo', () => {
      const c = resumo('pr-ruim.coverage-summary.json');
      const json = JSON.parse(JSON.stringify(paraResumo(c, { suiteFalhou: true })));
      const lido = lerResumo(json);
      assert.equal(lido.suiteFalhou, true);
      assert.deepEqual(Object.keys(lido.arquivos).sort(), Object.keys(c.arquivos).sort());
      assert.equal(lerResumo(paraResumo(c)).suiteFalhou, undefined);
    });
  });

  describe('lerLcov', () => {
    it('bate com o coverage-summary do vitest na mesma rodada (trecho do lcov da PR ruim)', () => {
      const lcov = lerLcov(readFileSync(new URL('pr-ruim.lcov-trecho.info', FIX), 'utf8'));
      const vitest = resumo('pr-ruim.coverage-summary.json');
      assert.equal(Object.keys(lcov.arquivos).length, 7);
      for (const [arquivo, t] of Object.entries(lcov.arquivos)) {
        assert.deepEqual(t.linhas, vitest.arquivos[arquivo].linhas, arquivo);
        assert.deepEqual(t.branches, vitest.arquivos[arquivo].branches, arquivo);
      }
    });

    it('caminho absoluto no SF vira relativo à raiz', () => {
      const c = lerLcov(`SF:${RAIZ}/src/a.ts\nLF:2\nLH:1\nBRF:0\nBRH:0\nend_of_record\n`, { raiz: RAIZ });
      assert.deepEqual(Object.keys(c.arquivos), ['src/a.ts']);
    });
  });

  describe('precisaDaBase', () => {
    it('não precisa quando o head já cumpre o mínimo (repo sem dívida não paga a suíte da base)', () => {
      assert.equal(precisaDaBase(cobertura(totais(100, 80, 10, 5)), LIMITES), false);
    });

    it('precisa quando lines ou branches do head está abaixo do mínimo', () => {
      assert.equal(precisaDaBase(resumo('pr-boa.coverage-summary.json'), LIMITES), true);
      assert.equal(precisaDaBase(cobertura(totais(100, 80, 10, 3)), LIMITES), true);
    });
  });

  describe('avaliarCobertura', () => {
    it('front com dívida, PR boa: global sobe e os arquivos com lógica alterados passam', () => {
      const r = avaliarCobertura({
        head: resumo('pr-boa.coverage-summary.json'),
        base: resumo('main.coverage-summary.json'),
        alterados: alterados('pr-boa.alterados.z'),
        limites: LIMITES,
      });
      assert.equal(r.passou, true);
      assert.equal(r.global.linhas.status, 'ok-catraca');
      assert.deepEqual(
        r.arquivos.map((a) => [a.arquivo, a.passou]),
        [['src/lib/datas.ts', true], ['src/lib/soma.ts', true]],
      );
      // page.tsx é excluído do coverage (mesmos excluídos de hoje) e o rename puro não conta.
      assert.ok(r.foraDaCobertura.includes('src/app/painel/[equipeId]/metas/page.tsx'));
    });

    it('front com dívida, PR ruim: global cai mais de 0,1 ponto e arquivo novo sem teste barra', () => {
      const r = avaliarCobertura({
        head: resumo('pr-ruim.coverage-summary.json'),
        base: resumo('main.coverage-summary.json'),
        alterados: alterados('pr-ruim.alterados.z'),
        limites: LIMITES,
      });
      assert.equal(r.passou, false);
      assert.equal(r.global.linhas.status, 'queda');
      assert.equal(r.global.branches.status, 'queda', '16,69% para 16,53%: 0,16 ponto');
      const reprovados = r.arquivos.filter((a) => !a.passou).map((a) => a.arquivo);
      assert.deepEqual(reprovados, [
        'src/app/painel/[equipeId]/resumo/resumo.helpers.ts',
        'src/lib/consultas.ts',
        'src/lib/formato.ts',
        'src/stores/useQuadroStore.ts',
      ]);
      assert.ok(r.arquivos.some((a) => a.arquivo === 'src/lib/soma.ts' && a.passou));
    });

    it('queda de exatamente 0,1 ponto passa; um pouco mais, não', () => {
      const base = cobertura(totais(1000, 120));
      const ok = avaliarCobertura({ head: cobertura(totais(1000, 119)), base, alterados: soModificados(), limites: LIMITES });
      assert.equal(ok.global.linhas.status, 'ok-catraca');
      const ruim = avaliarCobertura({ head: cobertura(totais(10000, 1189)), base, alterados: soModificados(), limites: LIMITES });
      assert.equal(ruim.global.linhas.status, 'queda');
      assert.equal(ruim.passou, false);
    });

    it('head acima do mínimo passa sem olhar a base, como o gate de hoje', () => {
      const r = avaliarCobertura({
        head: cobertura(totais(100, 80, 10, 5)),
        base: null,
        alterados: soModificados(),
        limites: LIMITES,
      });
      assert.equal(r.passou, true);
      assert.equal(r.global.linhas.status, 'ok-limite');
    });

    it('head abaixo do mínimo e base indisponível: barra (não afrouxa sem medir)', () => {
      const r = avaliarCobertura({ head: cobertura(totais(100, 10)), base: null, alterados: soModificados(), limites: LIMITES });
      assert.equal(r.passou, false);
      assert.equal(r.global.linhas.status, 'sem-base');
    });

    it('arquivo alterado: arredonda como o gate de hoje (74,5% conta como 75%) e ignora branches ausentes', () => {
      const head = cobertura(totais(1000, 900), {
        'src/a.ts': totais(200, 149),
        'src/b.ts': totais(200, 150, 10, 3),
        'src/sem-logica.ts': totais(0, 0),
      });
      const r = avaliarCobertura({ head, base: null, alterados: soModificados('src/a.ts', 'src/b.ts', 'src/sem-logica.ts'), limites: LIMITES });
      assert.deepEqual(
        r.arquivos.map((a) => [a.arquivo, a.passou]),
        [['src/a.ts', true], ['src/b.ts', false]],
      );
      assert.equal(pct(head.arquivos['src/a.ts'].linhas), 74.5);
    });

    it('rename puro não cobra cobertura; rename com mudança cobra no caminho novo', () => {
      const head = cobertura(totais(1000, 900), { 'src/novo.ts': totais(10, 0), 'src/outro.ts': totais(10, 0) });
      const r = avaliarCobertura({
        head,
        base: null,
        alterados: {
          criados: [],
          modificados: [],
          removidos: [],
          renomeados: [
            { de: 'src/velho.ts', para: 'src/novo.ts', similaridade: 100 },
            { de: 'src/x.ts', para: 'src/outro.ts', similaridade: 87 },
          ],
        },
        limites: LIMITES,
      });
      assert.deepEqual(r.arquivos.map((a) => a.arquivo), ['src/outro.ts']);
    });

    it('base cumpria o mínimo e a PR deixa a global abaixo dele: barra como hoje, mesmo caindo menos de 0,1', () => {
      // 74,52% conta como 75% (cumpre); 74,45% conta como 74%. A queda é de 0,07 ponto.
      const r = avaliarCobertura({
        head: cobertura(totais(10000, 7445)),
        base: cobertura(totais(10000, 7452)),
        alterados: soModificados(),
        limites: LIMITES,
      });
      assert.equal(r.global.linhas.status, 'abaixo-do-minimo');
      assert.equal(r.passou, false);
    });

    it('repo com dívida que a PR paga: o head passa a cumprir o mínimo e passa', () => {
      const r = avaliarCobertura({
        head: cobertura(totais(1000, 760, 10, 5)),
        base: cobertura(totais(1000, 600, 10, 3)),
        alterados: soModificados(),
        limites: LIMITES,
      });
      assert.equal(r.global.linhas.status, 'ok-limite');
      assert.equal(r.global.branches.status, 'ok-limite');
      assert.equal(r.passou, true);
    });

    it('arquivo que a PR apaga sai da base: apagar código coberto não conta como queda', () => {
      const base = cobertura(totais(1000, 150), { 'src/coberto.ts': totais(100, 100), 'src/resto.ts': totais(900, 50) });
      const head = cobertura(totais(900, 50), { 'src/resto.ts': totais(900, 50) });
      const r = avaliarCobertura({
        head,
        base,
        alterados: { criados: [], modificados: [], renomeados: [], removidos: ['src/coberto.ts'] },
        limites: LIMITES,
      });
      assert.equal(r.global.linhas.status, 'ok-catraca');
      assert.equal(r.global.linhas.base, pct(totais(900, 50).linhas));
      assert.deepEqual(r.removidosDaBase, ['src/coberto.ts']);
      assert.equal(r.passou, true);
    });

    it('teste apagado continua contando: o arquivo fica e a cobertura dele cai', () => {
      const base = cobertura(totais(1000, 150), { 'src/coberto.ts': totais(100, 100), 'src/resto.ts': totais(900, 50) });
      const head = cobertura(totais(1000, 50), { 'src/coberto.ts': totais(100, 0), 'src/resto.ts': totais(900, 50) });
      const r = avaliarCobertura({
        head,
        base,
        alterados: { criados: [], modificados: [], renomeados: [], removidos: ['src/coberto.spec.ts'] },
        limites: LIMITES,
      });
      assert.equal(r.global.linhas.status, 'queda');
      assert.deepEqual(r.removidosDaBase, []);
      assert.equal(r.passou, false);
    });

    it('base medida com teste falhando não vale como base: com o head abaixo do mínimo, barra', () => {
      // Repo limpo (75%) cuja suíte quebrou na worktree da base: mediu 60%. Com
      // ela valendo como base, o head a 70% entraria na tolerância de 0,1.
      const base = { ...cobertura(totais(1000, 600)), suiteFalhou: true };
      const r = avaliarCobertura({ head: cobertura(totais(1000, 700)), base, alterados: soModificados(), limites: LIMITES });
      assert.equal(r.global.linhas.status, 'base-vermelha');
      assert.equal(r.baseSuiteFalhou, true);
      assert.equal(r.passou, false);
    });

    it('base medida com teste falhando não muda nada quando o head cumpre o mínimo', () => {
      const base = { ...cobertura(totais(1000, 600)), suiteFalhou: true };
      const r = avaliarCobertura({ head: cobertura(totais(1000, 800, 10, 5)), base, alterados: soModificados(), limites: LIMITES });
      assert.equal(r.global.linhas.status, 'ok-limite');
      assert.equal(r.passou, true);
    });

    it('fora da cobertura lista só arquivo de código (yml, md, json e css não entram)', () => {
      const r = avaliarCobertura({
        head: cobertura(totais(100, 90)),
        base: null,
        alterados: soModificados('.github/workflows/pr.yml', 'README.md', 'package.json', 'src/app/globals.css', 'src/app/[id]/page.tsx', 'src/lib/a.spec.ts'),
        limites: LIMITES,
      });
      assert.deepEqual(r.foraDaCobertura, ['src/app/[id]/page.tsx', 'src/lib/a.spec.ts']);
    });
  });

  describe('regra por arquivo (coverage-files-gate)', () => {
    // Global no mínimo; o único problema é o arquivo antigo que a PR alterou.
    const head = cobertura(totais(1000, 900, 100, 80), { 'src/antigo.ts': totais(100, 10, 10, 1), 'src/ok.ts': totais(100, 100) });
    const avaliar = (porArquivo) =>
      avaliarCobertura({ head, base: null, alterados: soModificados('src/antigo.ts', 'src/ok.ts'), limites: LIMITES, porArquivo });

    it('padrão warn: o arquivo abaixo do mínimo aparece, mas não reprova', () => {
      const r = avaliarCobertura({ head, base: null, alterados: soModificados('src/antigo.ts', 'src/ok.ts'), limites: LIMITES });
      assert.equal(r.porArquivo, 'warn');
      assert.equal(r.passou, true);
      assert.equal(r.arquivosPassou, false);
      assert.deepEqual(r.arquivos.filter((a) => !a.passou).map((a) => a.arquivo), ['src/antigo.ts']);
    });

    it('error: o mesmo arquivo reprova', () => {
      const r = avaliar('error');
      assert.equal(r.passou, false);
      assert.equal(r.arquivosPassou, false);
    });

    it('off: nem avalia os arquivos', () => {
      const r = avaliar('off');
      assert.equal(r.passou, true);
      assert.deepEqual(r.arquivos, []);
      assert.deepEqual(r.foraDaCobertura, []);
    });

    it('warn não afrouxa a global: queda acima de 0,1 ponto continua reprovando', () => {
      const r = avaliarCobertura({
        head: cobertura(totais(1000, 100)),
        base: cobertura(totais(1000, 120)),
        alterados: soModificados(),
        limites: LIMITES,
        porArquivo: 'warn',
      });
      assert.equal(r.global.linhas.status, 'queda');
      assert.equal(r.passou, false);
    });

    it('sem saber o que a PR mudou: só o modo error reprova por isso', () => {
      const semAlterados = (porArquivo) => avaliarCobertura({ head, base: null, alterados: null, limites: LIMITES, porArquivo });
      assert.equal(semAlterados('warn').passou, true);
      assert.equal(semAlterados('error').passou, false);
    });

    it('modo desconhecido é erro (não vira warn calado)', () => {
      assert.throws(() => avaliar('aviso'), /coverage-files-gate/);
    });
  });

  describe('dívida por arquivo (informativa)', () => {
    it('conta os arquivos com lógica do repo inteiro abaixo do mínimo', () => {
      const head = cobertura(totais(310, 230, 10, 4), {
        'src/ok.ts': totais(100, 80, 10, 4),
        'src/no-limite.ts': totais(200, 150, 0, 0),
        'src/ruim.ts': totais(10, 0),
        'src/so-tipos.ts': totais(0, 0),
      });
      const r = avaliarCobertura({ head, base: null, alterados: soModificados(), limites: LIMITES });
      assert.deepEqual(r.dividaPorArquivo, { abaixo: 1, total: 3 });
    });

    it('main de um front com dívida: 143 de 163 arquivos com lógica abaixo de 75% lines ou 40% branches', () => {
      const r = avaliarCobertura({
        head: resumo('main.coverage-summary.json'),
        base: null,
        alterados: soModificados(),
        limites: LIMITES,
      });
      assert.deepEqual(r.dividaPorArquivo, { abaixo: 143, total: 163 });
    });
  });
});
