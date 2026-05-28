/**
 * Coverage gate — versão GLOBAL.
 *
 * Parsea coverage/lcov.info, agrega tudo num único totals global,
 * compara com thresholds. Escreve coverage/gate.json. Em modo error,
 * sai com exit 1 se thresholds violados.
 *
 * Diferente do monolito: aqui o gate é GLOBAL (não per-module). Frontend tem
 * pouca segmentação por bounded context — basta uma média geral pra ter sinal.
 *
 * Uso:
 *   npm run coverage:gate
 *
 * Env:
 *   AUDIT_LINES_MIN     mínimo % de lines (default 50)
 *   AUDIT_BRANCHES_MIN  mínimo % de branches (default 40)
 *   AUDIT_GATE_MODE     "warn" (default, exit 0) | "error" (exit 1 se violar)
 *
 * Arquivos sem lógica testável (componentes UI gerados, schemas, etc.) já são
 * excluídos pelo vitest.config.ts via coverage.exclude. Aqui não fazemos
 * filtragem extra além das listas abaixo (defensiva).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  AUDIT_LINES_MIN: z.coerce.number().int().min(0).max(100).default(75),
  AUDIT_BRANCHES_MIN: z.coerce.number().int().min(0).max(100).default(40),
  AUDIT_GATE_MODE: z.enum(['warn', 'error']).default('error'),
});

export type LcovTotals = {
  linesFound: number;
  linesHit: number;
  branchesFound: number;
  branchesHit: number;
  linesPct: number;
  branchesPct: number;
};

export type LcovParsed = {
  global: LcovTotals;
  byFile: Record<string, LcovTotals>;
};

function pctOrZero(hit: number, found: number): number {
  return found === 0 ? 0 : Math.round((hit / found) * 100);
}

function emptyTotals(): LcovTotals {
  return {
    linesFound: 0,
    linesHit: 0,
    branchesFound: 0,
    branchesHit: 0,
    linesPct: 0,
    branchesPct: 0,
  };
}

function finalizeTotals(t: LcovTotals): LcovTotals {
  return {
    ...t,
    linesPct: pctOrZero(t.linesHit, t.linesFound),
    branchesPct: pctOrZero(t.branchesHit, t.branchesFound),
  };
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
export type Violation = {
  scope: string;
  metric: 'lines' | 'branches';
  actual: number;
  expected: number;
};
export type GateResult = { passed: boolean; violations: Violation[] };

function violationsFor(
  totals: LcovTotals,
  scope: string,
  t: Thresholds,
): Violation[] {
  const out: Violation[] = [];
  if (totals.linesFound > 0 && totals.linesPct < t.linesMin) {
    out.push({
      scope,
      metric: 'lines',
      actual: totals.linesPct,
      expected: t.linesMin,
    });
  }
  if (totals.branchesFound > 0 && totals.branchesPct < t.branchesMin) {
    out.push({
      scope,
      metric: 'branches',
      actual: totals.branchesPct,
      expected: t.branchesMin,
    });
  }
  return out;
}

export function evaluateGate(global: LcovTotals, t: Thresholds): GateResult {
  const violations = violationsFor(global, 'global', t);
  return { passed: violations.length === 0, violations };
}

export function decideExitCode(gate: GateResult, mode: string): 0 | 1 {
  return !gate.passed && mode === 'error' ? 1 : 0;
}

function main() {
  const lcovPath = 'coverage/lcov.info';
  const outPath = 'coverage/gate.json';
  if (!existsSync(lcovPath)) {
    console.error(
      `[coverage-gate] ${lcovPath} não existe. Rode 'npm run test:coverage' antes.`,
    );
    process.exit(1);
  }
  const env = EnvSchema.parse(process.env);
  const parsed = parseLcov(readFileSync(lcovPath, 'utf8'));
  const thresholds: Thresholds = {
    linesMin: env.AUDIT_LINES_MIN,
    branchesMin: env.AUDIT_BRANCHES_MIN,
  };
  const gate = evaluateGate(parsed.global, thresholds);
  const mode = env.AUDIT_GATE_MODE;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      { totals: parsed.global, thresholds, gate, mode },
      null,
      2,
    ),
  );

  console.log(
    `[coverage-gate] global lines=${parsed.global.linesPct}% branches=${parsed.global.branchesPct}% — thresholds: lines>=${thresholds.linesMin}% branches>=${thresholds.branchesMin}% — mode=${mode}`,
  );
  if (gate.violations.length === 0) {
    console.log('  ok thresholds OK');
  } else {
    for (const v of gate.violations) {
      console.log(
        `  X ${v.scope}: ${v.metric}=${v.actual}% (esperado >=${v.expected}%)`,
      );
    }
  }

  const code = decideExitCode(gate, mode);
  if (code !== 0) process.exit(code);
}

// Compatibilidade tsx (ESM) e Node (CommonJS): main() roda quando o arquivo é executado direto.
// tsx executa o arquivo direto como entry point — checamos via process.argv[1].
const entry = process.argv[1] ?? '';
if (entry.endsWith('coverage-gate.ts') || entry.endsWith('coverage-gate.js')) {
  main();
}
