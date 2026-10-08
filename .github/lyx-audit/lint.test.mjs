import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  arquivosParaLintDaBase,
  compararErros,
  errosDoEslint,
  normalizarMensagem,
} from './lint.mjs';
import { parseNameStatusZ } from './git.mjs';

const FIX = new URL('./fixtures/taskbuilder/', import.meta.url);
const RAIZ_HEAD = '/home/runner/work/lyx-taskbuilder-front/lyx-taskbuilder-front';
const RAIZ_BASE = '/home/runner/work/_temp/lyx-base';

function fixture(nome) {
  return JSON.parse(readFileSync(new URL(nome, FIX), 'utf8'));
}
function alterados(nome) {
  return parseNameStatusZ(readFileSync(new URL(nome, FIX)));
}
function erro(arquivo, regra, mensagem, linha = 1) {
  return { arquivo, regra, mensagem, linha, coluna: 1, assinatura: normalizarMensagem(mensagem) };
}

describe('lint', () => {
  describe('normalizarMensagem', () => {
    it('troca números por # (a mesma função com outro tamanho continua sendo a mesma dívida)', () => {
      assert.equal(
        normalizarMensagem("Function 'WeeklyClient' has too many lines (360). Maximum allowed is 80."),
        "Function 'WeeklyClient' has too many lines (#). Maximum allowed is #.",
      );
    });

    it('usa só a primeira linha: as regras do React Compiler trazem caminho absoluto e trecho do código', () => {
      const mensagem =
        'Error: Calling setState synchronously within an effect can trigger cascading renders\n\n' +
        `${RAIZ_HEAD}/src/a.tsx:16:5\n  14 | useEffect(() => {\n> 16 |   setX(1);`;
      assert.equal(
        normalizarMensagem(mensagem),
        'Error: Calling setState synchronously within an effect can trigger cascading renders',
      );
    });

    it('tira a raiz do checkout quando ela aparece na mensagem', () => {
      assert.equal(normalizarMensagem(`Falhou em ${RAIZ_BASE}/src/x.ts`, [RAIZ_BASE]), 'Falhou em src/x.ts');
    });
  });

  describe('errosDoEslint', () => {
    it('lê o JSON real do taskbuilder-front: 60 erros na main, warnings fora, caminho relativo', () => {
      const erros = errosDoEslint(fixture('main.eslint.json'), RAIZ_BASE);
      assert.equal(erros.length, 60);
      assert.ok(erros.every((e) => !e.arquivo.startsWith('/')));
      assert.ok(erros.some((e) => e.arquivo === 'src/app/dashboard/[sectorId]/weekly/weekly-client.tsx'));
      assert.ok(!erros.some((e) => e.regra === 'react-hooks/set-state-in-effect'), 'warning não é erro');
    });

    it('erro de parse (fatal, sem ruleId) vira a regra (parse)', () => {
      const erros = errosDoEslint(
        [{ filePath: '/r/src/a.ts', messages: [{ ruleId: null, fatal: true, severity: 2, message: "Parsing error: ';' expected.", line: 3, column: 9 }] }],
        '/r',
      );
      assert.deepEqual(erros.map((e) => [e.arquivo, e.regra, e.linha]), [['src/a.ts', '(parse)', 3]]);
    });
  });

  describe('compararErros', () => {
    it('taskbuilder, PR boa: os 60 erros da main não contam, nem os do arquivo renomeado', () => {
      const r = compararErros(
        errosDoEslint(fixture('pr-boa.eslint.json'), RAIZ_HEAD),
        errosDoEslint(fixture('main.eslint.json'), RAIZ_BASE),
        { alterados: alterados('pr-boa.alterados.z') },
      );
      assert.equal(r.totalHead, 60);
      assert.equal(r.existentes, 60);
      assert.deepEqual(r.novos, []);
    });

    it('taskbuilder, PR ruim: só os 4 erros que a PR criou contam, inclusive em arquivo antigo', () => {
      const r = compararErros(
        errosDoEslint(fixture('pr-ruim.eslint.json'), RAIZ_HEAD),
        errosDoEslint(fixture('main.eslint.json'), RAIZ_BASE),
        { alterados: alterados('pr-ruim.alterados.z') },
      );
      assert.equal(r.totalHead, 64);
      const novos = r.novos.map((g) => [g.arquivo, g.regra, g.novos]);
      assert.deepEqual(novos, [
        ['src/app/dashboard/[sectorId]/painel/painel.helpers.ts', 'complexity', 1],
        ['src/lib/format.ts', 'complexity', 1],
        ['src/stores/useMindMapStore.ts', 'max-lines-per-function', 2],
      ]);
      assert.equal(r.novos.reduce((s, g) => s + g.novos, 0), 4);
      // queries.ts: "File has too many lines (1173)" era 1168 na base. Mesmo erro.
      assert.ok(!r.novos.some((g) => g.arquivo === 'src/lib/queries.ts'));
    });

    it('a mesma mensagem repetida conta pela quantidade (1 na base, 3 no head = 2 novos)', () => {
      const msg = 'Arrow function has too many lines (109). Maximum allowed is 80.';
      const r = compararErros(
        [erro('src/s.ts', 'max-lines-per-function', msg, 20), erro('src/s.ts', 'max-lines-per-function', msg, 172), erro('src/s.ts', 'max-lines-per-function', msg, 173)],
        [erro('src/s.ts', 'max-lines-per-function', msg, 20)],
      );
      assert.equal(r.novos.length, 1);
      assert.equal(r.novos[0].novos, 2);
      assert.deepEqual(r.novos[0].linhas, [20, 172, 173]);
    });

    it('erro igual em OUTRO arquivo é novo', () => {
      const msg = 'Unexpected any. Specify a different type.';
      const r = compararErros([erro('src/b.ts', 'no-explicit-any', msg)], [erro('src/a.ts', 'no-explicit-any', msg)]);
      assert.equal(r.novos.length, 1);
      assert.equal(r.novos[0].arquivo, 'src/b.ts');
    });

    it('erro corrigido na PR some da conta e não vira crédito para erro novo em outro lugar', () => {
      const r = compararErros(
        [erro('src/a.ts', 'complexity', "Function 'b' has a complexity of 13. Maximum allowed is 12.")],
        [erro('src/a.ts', 'complexity', "Function 'a' has a complexity of 13. Maximum allowed is 12.")],
      );
      assert.equal(r.corrigidos, 1);
      assert.equal(r.novos.length, 1);
    });

    it('por regra (PR que mexe nas dependências): mensagem reescrita entre versões não vira erro novo', () => {
      const head = [erro('src/a.ts', 'sonarjs/cognitive-complexity', 'Refactor this function to reduce its Cognitive Complexity from 31 to the 15 allowed.')];
      const base = [erro('src/a.ts', 'sonarjs/cognitive-complexity', 'Reduce the Cognitive Complexity of this function from 31 to 15.')];
      assert.equal(compararErros(head, base).novos.length, 1, 'por mensagem, o texto novo conta como erro novo');
      const r = compararErros(head, base, { porRegra: true });
      assert.deepEqual(r.novos, []);
      assert.equal(r.existentes, 1);
      assert.equal(r.comparacao, 'regra');
    });

    it('por regra: regra que a versão nova liga continua sendo erro novo, e a contagem por arquivo e regra vale', () => {
      const r = compararErros(
        [erro('src/a.ts', 'no-console', 'Unexpected console statement.'), erro('src/a.ts', 'complexity', 'x', 3), erro('src/a.ts', 'complexity', 'y', 9)],
        [erro('src/a.ts', 'complexity', 'z', 3)],
        { porRegra: true },
      );
      assert.deepEqual(r.novos.map((g) => [g.arquivo, g.regra, g.novos]), [
        ['src/a.ts', 'complexity', 1],
        ['src/a.ts', 'no-console', 1],
      ]);
    });

    it('sem a base (indisponível), todo erro do head conta', () => {
      const r = compararErros([erro('src/a.ts', 'complexity', 'x')], null);
      assert.equal(r.baseDisponivel, false);
      assert.equal(r.novos.length, 1);
    });
  });

  describe('arquivosParaLintDaBase', () => {
    it('lista só os arquivos com erro no head, no caminho da base, sem os criados pela PR', () => {
      const lista = arquivosParaLintDaBase(errosDoEslint(fixture('pr-ruim.eslint.json'), RAIZ_HEAD), alterados('pr-ruim.alterados.z'));
      assert.ok(lista.includes('src/components/bonus/bonus-page.tsx'), 'renomeado: lint no caminho antigo');
      assert.ok(!lista.includes('src/components/bonus/pagina-bonus.tsx'));
      assert.ok(!lista.includes('src/app/dashboard/[sectorId]/painel/painel.helpers.ts'), 'criado na PR');
      assert.ok(lista.includes('src/app/dashboard/[sectorId]/weekly/weekly-client.tsx'), 'caminho com colchetes');
      assert.equal(new Set(lista).size, lista.length);
    });
  });
});
