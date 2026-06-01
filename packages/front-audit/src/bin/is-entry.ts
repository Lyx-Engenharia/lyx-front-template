import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** True when this module is the program entry point — robust to .bin symlinks
 *  (e.g. node_modules/.bin/lyx-coverage-gate → dist/bin/coverage-gate.js).
 *  The old `process.argv[1].endsWith('coverage-gate.js')` guard FAILED for the
 *  symlink name and made the gate a silent no-op. */
export function isEntryPoint(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
