import { describe, it, expect } from 'vitest';
import { renderReport, type AuditInputs } from './report';

const base: AuditInputs = {
  commitSha: 'abc1234',
  eslint: { violations: [] },
  depcruise: { violations: [] },
  coverage: {
    totals: { linesFound: 1000, linesHit: 800, branchesFound: 200, branchesHit: 100, linesPct: 80, branchesPct: 50 },
    thresholds: { linesMin: 75, branchesMin: 40 },
    gate: { passed: true, violations: [] },
    mode: 'error',
  },
};

describe('renderReport', () => {
  it('inclui o marker do bot', () => expect(renderReport(base)).toContain('<!-- audit-report -->'));
  it('inclui o commit sha curto', () => expect(renderReport(base)).toContain('abc1234'));
  it('renderiza a tabela Resumo com cobertura global', () => {
    const md = renderReport(base);
    expect(md).toContain('### Resumo');
    expect(md).toContain('Cobertura (lines, global)');
    expect(md).toContain('80%');
  });
  it('lista violação de cobertura quando o gate falha', () => {
    const md = renderReport({ ...base, coverage: { ...base.coverage, totals: { ...base.coverage.totals, linesPct: 30 }, gate: { passed: false, violations: [{ scope: 'global', metric: 'lines', actual: 30, expected: 75 }] } } });
    expect(md).toContain('Cobertura abaixo do threshold');
    expect(md).toContain('30%');
  });
  it('mostra "sem dados" quando branchesFound=0', () => {
    const md = renderReport({ ...base, coverage: { ...base.coverage, totals: { ...base.coverage.totals, branchesFound: 0, branchesHit: 0, branchesPct: 0 } } });
    expect(md).toContain('sem dados');
  });
  it('agrupa hotspots de ESLint por regra', () => {
    const md = renderReport({ ...base, eslint: { violations: [{ filePath: '/abs/src/lib/big.ts', errorCount: 1, warningCount: 0, messages: [{ ruleId: 'complexity', severity: 2, message: "function 'foo' has complexity 18", line: 42, column: 1 }] }] } });
    expect(md).toContain('Hotspots ESLint');
    expect(md).toContain('complexity');
  });
  it('mostra ciclos do dependency-cruiser', () => {
    const md = renderReport({ ...base, depcruise: { violations: [{ rule: { name: 'no-circular', severity: 'error' }, from: 'src/a.ts', to: 'src/b.ts', cycle: ['src/a.ts', 'src/b.ts'] }] } });
    expect(md).toContain('no-circular');
  });
});
