/**
 * Copia AGENTS.md pros 3 locais que diferentes AIs leem.
 *
 * Uso: npm run sync-agents
 *
 * AGENTS.md é fonte da verdade — NÃO editar os arquivos copiados.
 * CI valida que estão sincronizados (pr.yml step "Check AGENTS.md sync").
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

const SOURCE = 'AGENTS.md';
const TARGETS = [
  'CLAUDE.md', // Claude Code (legacy fallback)
  '.cursorrules', // Cursor (legacy fallback)
  '.github/copilot-instructions.md', // GitHub Copilot (obrigatório)
];

if (!existsSync(SOURCE)) {
  console.error(`[sync-agents] ${SOURCE} não existe. Rode da raiz do repo.`);
  process.exit(1);
}

mkdirSync('.github', { recursive: true });

for (const target of TARGETS) {
  copyFileSync(SOURCE, target);
  console.log(`[sync-agents] ${target} <- ${SOURCE}`);
}

console.log('[sync-agents] sincronização completa.');
