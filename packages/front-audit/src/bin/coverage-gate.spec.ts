import { describe, it, expect } from 'vitest';
import { parseLcov, evaluateGate, decideExitCode, parseEnv, type GateResult } from './coverage-gate';

const lcov = `
TN:
SF:src/a.service.ts
LF:100
LH:80
BRF:50
BRH:35
end_of_record
SF:src/b.ts
LF:100
LH:60
BRF:50
BRH:25
end_of_record
`.trim();

describe('parseLcov', () => {
  it('soma LF/LH/BRF/BRH no global', () => {
    const r = parseLcov(lcov);
    expect(r.global.linesFound).toBe(200);
    expect(r.global.linesHit).toBe(140);
    expect(r.global.branchesFound).toBe(100);
    expect(r.global.branchesHit).toBe(60);
    expect(r.global.linesPct).toBe(70);
    expect(r.global.branchesPct).toBe(60);
  });
  it('retorna 0% quando LF=0 (sem NaN)', () => {
    const r = parseLcov('SF:src/x.ts\nLF:0\nLH:0\nBRF:0\nBRH:0\nend_of_record');
    expect(r.global.linesPct).toBe(0);
    expect(r.global.branchesPct).toBe(0);
  });
});

describe('evaluateGate', () => {
  const t = { linesMin: 75, branchesMin: 40 };
  it('passa acima do threshold', () => {
    expect(evaluateGate({ linesFound: 100, linesHit: 80, branchesFound: 100, branchesHit: 50, linesPct: 80, branchesPct: 50 }, t).passed).toBe(true);
  });
  it('falha em lines abaixo', () => {
    const g = evaluateGate({ linesFound: 100, linesHit: 70, branchesFound: 100, branchesHit: 50, linesPct: 70, branchesPct: 50 }, t);
    expect(g.passed).toBe(false);
    expect(g.violations).toContainEqual({ scope: 'global', metric: 'lines', actual: 70, expected: 75 });
  });
  it('não falha em branches quando branchesFound=0', () => {
    expect(evaluateGate({ linesFound: 100, linesHit: 80, branchesFound: 0, branchesHit: 0, linesPct: 80, branchesPct: 0 }, t).passed).toBe(true);
  });
});

describe('decideExitCode', () => {
  const failing: GateResult = { passed: false, violations: [{ scope: 'global', metric: 'lines', actual: 40, expected: 75 }] };
  it('warn → 0 mesmo com violação', () => expect(decideExitCode(failing, 'warn')).toBe(0));
  it('error → 1 com violação', () => expect(decideExitCode(failing, 'error')).toBe(1));
  it('error → 0 sem violação', () => expect(decideExitCode({ passed: true, violations: [] }, 'error')).toBe(0));
});

describe('parseEnv', () => {
  it('defaults: 75/40/error', () => {
    expect(parseEnv({})).toEqual({ AUDIT_LINES_MIN: 75, AUDIT_BRANCHES_MIN: 40, AUDIT_GATE_MODE: 'error' });
  });
  it('lê valores válidos', () => {
    expect(parseEnv({ AUDIT_LINES_MIN: '60', AUDIT_BRANCHES_MIN: '30', AUDIT_GATE_MODE: 'warn' })).toEqual({ AUDIT_LINES_MIN: 60, AUDIT_BRANCHES_MIN: 30, AUDIT_GATE_MODE: 'warn' });
  });
  it('rejeita lines fora de 0-100', () => {
    expect(() => parseEnv({ AUDIT_LINES_MIN: '150' })).toThrow();
  });
  it('rejeita modo inválido', () => {
    expect(() => parseEnv({ AUDIT_GATE_MODE: 'blah' })).toThrow();
  });
  it('trata string vazia como ausente → usa default (env vazio no CI não zera o gate)', () => {
    expect(parseEnv({ AUDIT_LINES_MIN: '', AUDIT_BRANCHES_MIN: '', AUDIT_GATE_MODE: '' }))
      .toEqual({ AUDIT_LINES_MIN: 75, AUDIT_BRANCHES_MIN: 40, AUDIT_GATE_MODE: 'error' });
  });
});
