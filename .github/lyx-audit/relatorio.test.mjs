import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { montarRelatorio } from './relatorio.mjs';

const RELATORIO_DO_REPO = [
  '<!-- audit-report -->',
  '',
  // Título e separadores como o lyx-audit-report do pacote escreve (com travessão).
  '## Audit Report \u2014 commit `abc1234`',
  '',
  '### Resumo',
  '',
  '| Métrica | Status | Detalhe |',
  '|---|---|---|',
  '| Cognitive complexity | FAIL | limite 15 |',
  '| Cobertura (lines, global) | FAIL | 14% \u2014 gate >= 75% (modo warn) |',
  '',
  '### Hotspots ESLint',
  '',
  '#### `complexity` (22 ocorrências)',
  "- `src/lib/queries.ts:193` \u2014 Function 'normalizeDoc' has a complexity of 31. Maximum allowed is 12.",
].join('\n');

const LINT_COM_NOVOS = {
  passou: false,
  baseDisponivel: true,
  totalHead: 64,
  totalBase: 60,
  existentes: 60,
  corrigidos: 0,
  novos: [
    { arquivo: 'src/app/dashboard/[sectorId]/painel/painel.helpers.ts', regra: 'complexity', mensagem: "Function 'corDoIndicador' has a complexity of 15. Maximum allowed is 12.", linhas: [2], noHead: 1, naBase: 0, novos: 1 },
    { arquivo: 'src/stores/useMindMapStore.ts', regra: 'max-lines-per-function', mensagem: 'Arrow function has too many lines (109). Maximum allowed is 80.', linhas: [20, 172, 173], noHead: 3, naBase: 1, novos: 2 },
  ],
};

const COBERTURA_RUIM = {
  passou: false,
  baseDisponivel: true,
  tolerancia: 0.1,
  limites: { linhas: 75, branches: 40 },
  global: {
    linhas: { head: 14.2969, base: 14.5707, minimo: 75, status: 'queda', queda: 0.2738 },
    branches: { head: 14.4792, base: 14.5871, minimo: 40, status: 'queda', queda: 0.1079 },
  },
  arquivos: [
    { arquivo: 'src/lib/format.ts', linhas: 42.1, branches: 39.7, linhasOk: false, branchesOk: true, passou: false },
    { arquivo: 'src/lib/soma.ts', linhas: 100, branches: 100, linhasOk: true, branchesOk: true, passou: true },
  ],
  foraDaCobertura: ['src/lib/soma.spec.ts'],
};

function relatorio(extra = {}) {
  return montarRelatorio({
    sha: 'abc1234def',
    base: { sha: 'fed4321cba', disponivel: true },
    limites: { linhas: 75, branches: 40 },
    checks: { lint: 'failure', typecheck: 'success', testes: 'success', deps: 'success' },
    lint: LINT_COM_NOVOS,
    cobertura: COBERTURA_RUIM,
    relatorioDoRepo: RELATORIO_DO_REPO,
    ...extra,
  });
}

describe('relatorio', () => {
  describe('montarRelatorio', () => {
    it('começa pelo marcador que o upsert do comentário procura', () => {
      const md = relatorio();
      assert.ok(md.startsWith('<!-- audit-report -->\n'));
      assert.equal(md.split('<!-- audit-report -->').length, 2, 'um marcador só');
    });

    it('a tabela do gate mostra o que barra a PR: erros novos e queda de cobertura', () => {
      const md = relatorio();
      assert.match(md, /\| Lint \(erros novos\) \| FAIL \| 3 erros novos · 60 já existiam na base \|/);
      assert.match(md, /\| Cobertura global \(lines\) \| FAIL \| 14,30% \(base 14,57%\): caiu 0,27 ponto/);
      assert.match(md, /\| Arquivos que a PR cria ou altera \| FAIL \| 1 de 2 abaixo de 75% lines ou 40% branches \|/);
      assert.match(md, /`src\/stores\/useMindMapStore.ts:20, 172, 173` · `max-lines-per-function` · .*\(2 novos: 3 no head, 1 na base\)/);
      // Por arquivo vale o arredondamento do gate de hoje: mostra inteiro, e o mínimo só na métrica que falhou.
      assert.match(md, /\| `src\/lib\/format.ts` \| 42% \(mínimo 75%\) \| 40% \|/);
    });

    it('a dívida do repo inteiro continua no relatório, marcada como informativa', () => {
      const md = relatorio();
      const i = md.indexOf('### Dívida do repo inteiro (informativa');
      assert.ok(i > 0);
      assert.ok(md.indexOf('Gate desta PR') < i, 'o gate vem antes da dívida');
      assert.match(md.slice(i), /#### Resumo/);
      assert.match(md.slice(i), /normalizeDoc/);
      assert.ok(!md.slice(i).includes('## Audit Report'), 'sem o título duplicado do relatório do pacote');
    });

    it('PR limpa num repo com dívida: tudo OK no gate', () => {
      const md = relatorio({
        lint: { ...LINT_COM_NOVOS, passou: true, totalHead: 60, novos: [] },
        cobertura: {
          ...COBERTURA_RUIM,
          passou: true,
          global: {
            linhas: { head: 14.64, base: 14.57, minimo: 75, status: 'ok-catraca', queda: -0.07 },
            branches: { head: 14.63, base: 14.59, minimo: 40, status: 'ok-catraca', queda: -0.04 },
          },
          arquivos: [{ arquivo: 'src/lib/soma.ts', linhas: 100, branches: 100, linhasOk: true, branchesOk: true, passou: true }],
        },
      });
      assert.match(md, /\| Lint \(erros novos\) \| OK \| nenhum erro novo · 60 já existiam na base \|/);
      assert.match(md, /\| Cobertura global \(lines\) \| OK \| 14,64% \(base 14,57%\): abaixo de 75% não pode cair mais de 0,1 ponto \|/);
      assert.match(md, /\| Arquivos que a PR cria ou altera \| OK \| 1 arquivo, todos com 75% lines e 40% branches ou mais \|/);
      assert.ok(!md.includes('#### Erros de lint novos'));
    });

    it('lint verde no repo inteiro não precisa da catraca', () => {
      const md = relatorio({ checks: { lint: 'success', typecheck: 'success', testes: 'success', deps: 'success' }, lint: null });
      assert.match(md, /\| Lint \(erros novos\) \| OK \| nenhum erro de lint \|/);
    });

    it('typecheck quebrado: testes e cobertura aparecem como não rodou', () => {
      const md = relatorio({ checks: { lint: 'success', typecheck: 'failure', testes: 'skipped', deps: 'success' }, lint: null, cobertura: null });
      assert.match(md, /\| Typecheck \| FAIL \|/);
      assert.match(md, /\| Testes \| não rodou \| typecheck quebrado/);
      assert.match(md, /\| Cobertura \| não rodou \|/);
    });

    it('base indisponível aparece explicada', () => {
      const md = relatorio({ base: { disponivel: false, motivo: 'HEAD não é commit de merge' } });
      assert.match(md, /Base da PR indisponível \(HEAD não é commit de merge\)/);
    });

    it('global que a PR tira do mínimo aparece explicada (a base cumpria)', () => {
      const md = relatorio({
        cobertura: {
          ...COBERTURA_RUIM,
          global: {
            linhas: { head: 74.45, base: 74.52, minimo: 75, status: 'abaixo-do-minimo', queda: 0.07 },
            branches: { head: 50, base: 50, minimo: 40, status: 'ok-limite', queda: null },
          },
        },
      });
      assert.match(md, /\| Cobertura global \(lines\) \| FAIL \| 74,45% \(base 74,52%\): a base cumpria o mínimo de 75% e esta PR deixa a global abaixo dele \|/);
      assert.match(md, /\| Cobertura global \(branches\) \| OK \| 50,00%: cumpre o mínimo de 40% \|/);
    });

    it('a base sem os arquivos que a PR apaga aparece no detalhe', () => {
      const md = relatorio({ cobertura: { ...COBERTURA_RUIM, removidosDaBase: ['src/a.ts', 'src/b.ts'] } });
      assert.match(md, /2 arquivos que esta PR apaga saem da conta da base/);
    });

    it('a dívida do repo vem sem travessão (o do pacote vira dois-pontos)', () => {
      const md = relatorio();
      assert.ok(!/[\u2013\u2014]/.test(md), 'nenhum travessão no comentário');
      assert.match(md, /\| Cobertura \(lines, global\) \| FAIL \| 14%: gate >= 75% \(modo warn\) \|/);
      assert.match(md, /- `src\/lib\/queries.ts:193`: Function 'normalizeDoc'/);
    });

    it('a dívida por arquivo do repo inteiro aparece na seção informativa', () => {
      const md = relatorio({ cobertura: { ...COBERTURA_RUIM, dividaPorArquivo: { abaixo: 133, total: 163 } } });
      const i = md.indexOf('### Dívida do repo inteiro');
      assert.match(
        md.slice(i),
        /Arquivos com lógica abaixo de 75% lines ou 40% branches: 133 de 163\. Cada um passa a ser cobrado quando uma PR o cria ou altera\./,
      );
    });

    it('lista longa é cortada para o comentário caber no limite do GitHub', () => {
      const novos = Array.from({ length: 45 }, (_, i) => ({ ...LINT_COM_NOVOS.novos[0], arquivo: `src/a${i}.ts` }));
      const md = relatorio({ lint: { ...LINT_COM_NOVOS, novos } });
      assert.match(md, /e mais 15 grupos de erro/);
    });
  });
});
