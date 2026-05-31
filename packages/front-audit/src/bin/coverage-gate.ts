#!/usr/bin/env node
/**
 * lyx-coverage-gate — gate de coverage GLOBAL.
 * Parsea coverage/lcov.info, agrega num único totals global, compara com
 * thresholds. Escreve coverage/gate.json. Em modo error, exit 1 se violar.
 *
 * Env: AUDIT_LINES_MIN (default 75), AUDIT_BRANCHES_MIN (default 40),
 *      AUDIT_GATE_MODE "warn" | "error" (default error).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type AuditEnv = {
  AUDIT_LINES_MIN: number;
  AUDIT_BRANCHES_MIN: number;
  AUDIT_GATE_MODE: 'warn' | 'error';
};

function pctEnv(raw: string | undefined, fallback: number): number {
  // Empty/whitespace treated as absent → safe default. Intentional: an empty CI
  // env var (e.g. AUDIT_LINES_MIN='') must NOT silently zero the coverage gate.
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new Error(`valor inválido (inteiro 0-100 esperado): "${raw}"`);
  }
  return n;
}

function modeEnv(raw: string | undefined): 'warn' | 'error' {
  // Same rationale: empty string → safe default 'error', not a silent no-op.
  if (raw === undefined || raw.trim() === '') return 'error';
  if (raw !== 'warn' && raw !== 'error') {
    throw new Error(`AUDIT_GATE_MODE inválido (warn|error): "${raw}"`);
  }
  return raw;
}

export function parseEnv(e: NodeJS.ProcessEnv): AuditEnv {
  return {
    AUDIT_LINES_MIN: pctEnv(e.AUDIT_LINES_MIN, 75),
    AUDIT_BRANCHES_MIN: pctEnv(e.AUDIT_BRANCHES_MIN, 40),
    AUDIT_GATE_MODE: modeEnv(e.AUDIT_GATE_MODE),
  };
}

export type LcovTotals = {
  linesFound: number;
  linesHit: number;
  branchesFound: number;
  branchesHit: number;
  linesPct: number;
  branchesPct: number;
};
export type LcovParsed = { global: LcovTotals; byFile: Record<string, LcovTotals> };

function pctOrZero(hit: number, found: number): number {
  return found === 0 ? 0 : Math.round((hit / found) * 100);
}
function emptyTotals(): LcovTotals {
  return { linesFound: 0, linesHit: 0, branchesFound: 0, branchesHit: 0, linesPct: 0, branchesPct: 0 };
}
function finalizeTotals(t: LcovTotals): LcovTotals {
  return { ...t, linesPct: pctOrZero(t.linesHit, t.linesFound), branchesPct: pctOrZero(t.branchesHit, t.branchesFound) };
}

export function parseLcov(content: string): LcovParsed {
  const byFile: Record<string, LcovTotals> = {};
  const global = emptyTotals();
  let currentSF: string | null = null;
  let currentTotals: LcovTotals = emptyTotals();
  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      currentSF = line.slice(3).trim();
      currentTotals = emptyTotals();
    } else if (line.startsWith('LF:')) {
      const n = Number(line.slice(3));
      currentTotals.linesFound += n;
      global.linesFound += n;
    } else if (line.startsWith('LH:')) {
      const n = Number(line.slice(3));
      currentTotals.linesHit += n;
      global.linesHit += n;
    } else if (line.startsWith('BRF:')) {
      const n = Number(line.slice(4));
      currentTotals.branchesFound += n;
      global.branchesFound += n;
    } else if (line.startsWith('BRH:')) {
      const n = Number(line.slice(4));
      currentTotals.branchesHit += n;
      global.branchesHit += n;
    } else if (line.startsWith('end_of_record')) {
      if (currentSF !== null) byFile[currentSF] = finalizeTotals(currentTotals);
      currentSF = null;
      currentTotals = emptyTotals();
    }
  }
  return { global: finalizeTotals(global), byFile };
}

export type Thresholds = { linesMin: number; branchesMin: number };
export type Violation = { scope: string; metric: 'lines' | 'branches'; actual: number; expected: number };
export type GateResult = { passed: boolean; violations: Violation[] };

function violationsFor(totals: LcovTotals, scope: string, t: Thresholds): Violation[] {
  const out: Violation[] = [];
  if (totals.linesFound > 0 && totals.linesPct < t.linesMin) {
    out.push({ scope, metric: 'lines', actual: totals.linesPct, expected: t.linesMin });
  }
  if (totals.branchesFound > 0 && totals.branchesPct < t.branchesMin) {
    out.push({ scope, metric: 'branches', actual: totals.branchesPct, expected: t.branchesMin });
  }
  return out;
}

export function evaluateGate(global: LcovTotals, t: Thresholds): GateResult {
  const violations = violationsFor(global, 'global', t);
  return { passed: violations.length === 0, violations };
}

export function decideExitCode(gate: GateResult, mode: 'warn' | 'error'): 0 | 1 {
  return !gate.passed && mode === 'error' ? 1 : 0;
}

/* v8 ignore start */
function main(): void {
  const lcovPath = 'coverage/lcov.info';
  const outPath = 'coverage/gate.json';
  if (!existsSync(lcovPath)) {
    console.error(`[coverage-gate] ${lcovPath} não existe. Rode 'npm run test:coverage' antes.`);
    process.exit(1);
  }
  const env = parseEnv(process.env);
  const parsed = parseLcov(readFileSync(lcovPath, 'utf8'));
  const thresholds: Thresholds = { linesMin: env.AUDIT_LINES_MIN, branchesMin: env.AUDIT_BRANCHES_MIN };
  const gate = evaluateGate(parsed.global, thresholds);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ totals: parsed.global, thresholds, gate, mode: env.AUDIT_GATE_MODE }, null, 2));
  console.log(`[coverage-gate] global lines=${parsed.global.linesPct}% branches=${parsed.global.branchesPct}% — thresholds: lines>=${thresholds.linesMin}% branches>=${thresholds.branchesMin}% — mode=${env.AUDIT_GATE_MODE}`);
  if (gate.violations.length === 0) console.log('  ok thresholds OK');
  else for (const v of gate.violations) console.log(`  X ${v.scope}: ${v.metric}=${v.actual}% (esperado >=${v.expected}%)`);
  const code = decideExitCode(gate, env.AUDIT_GATE_MODE);
  if (code !== 0) process.exit(code);
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('coverage-gate.js') || entry.endsWith('coverage-gate.ts')) main();
/* v8 ignore stop */
