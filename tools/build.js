// Builds dist/ from src/: the sources are already plain ESM with hand-written
// declarations, so the build copies them and checks nothing outside the
// package is imported (zero runtime dependencies).
import { cp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

/**
 * Lists every file under a folder.
 * @param {string} dir The folder.
 * @returns {Promise<string[]>} Absolute paths.
 */
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

await rm(DIST, { recursive: true, force: true });
await cp(SRC, DIST, { recursive: true });

for (const file of await walk(DIST)) {
  if (!file.endsWith('.js')) continue;
  const code = await readFile(file, 'utf8');
  for (const m of code.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
    if (!m[1].startsWith('.')) throw new Error(`${file} imports ${m[1]}: the package has no runtime dependencies`);
  }
}
console.log('built dist/');
