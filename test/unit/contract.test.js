// Static checks on the built package: it stands on data-* attributes and ARIA
// roles only, has no runtime dependencies, and packs to a clean tarball.
// Run after `node tools/build.js`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectors, viewerSelectors, itemSelector, quote } from '../../dist/core/index.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(ROOT, 'dist');

/**
 * Lists every file under a folder.
 * @param {string} dir The folder.
 * @returns {string[]} Absolute paths.
 */
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test('no file in the built package references a grid class name', () => {
  const files = walk(DIST);
  assert.ok(files.length >= 6, 'dist/ is built');
  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    assert.equal(code.includes('lat-'), false, `${file} mentions 'lat-'`);
    assert.equal(/classList|className|\[class[~*^$|]?=/.test(code), false, `${file} reads class names`);
  }
});

test('every selector is built from roles and data-* attributes, never a class', () => {
  const all = [
    selectors.grid, selectors.dialog, selectors.dialogInput, selectors.rows, selectors.editor,
    selectors.header('city'), selectors.filterButton('city'), selectors.row(3),
    selectors.rowByKey('k'), selectors.cell('city', 3),
    ...Object.keys(viewerSelectors).flatMap((k) => Object.values(viewerSelectors[k]).concat(itemSelector(k, 'x'))),
  ];
  for (const sel of all) {
    // Strip quoted values, then look for a .class token.
    const bare = sel.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    assert.equal(/(^|[\s>+~,(])?\.[a-zA-Z_-]/.test(bare), false, `${sel} uses a class`);
  }
});

test('quote escapes quotes and backslashes in attribute values', () => {
  assert.equal(quote('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(selectors.header('my"col'), '[role="columnheader"][data-col="my\\"col"]');
});

test('the package has no runtime dependencies and only optional peers', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  for (const peer of Object.keys(pkg.peerDependencies)) assert.equal(pkg.peerDependenciesMeta[peer].optional, true);
  assert.equal(pkg.version, '0.1.0');
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './core', './cypress', './package.json', './playwright']);
});

test('npm pack produces a tarball of dist, README, LICENSE and package.json only', () => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8' });
  // npm 10 prints an array with one entry; newer npm prints the entry itself.
  const parsed = JSON.parse(out.slice(out.search(/[\[{]/)));
  const { files } = Array.isArray(parsed) ? parsed[0] : parsed;
  const paths = files.map((f) => f.path).sort();
  for (const p of paths) assert.match(p, /^(dist\/(core|playwright|cypress)\/index\.(js|d\.ts)|README\.md|LICENSE|package\.json)$/);
  for (const need of ['dist/core/index.js', 'dist/playwright/index.js', 'dist/cypress/index.js', 'dist/core/index.d.ts', 'README.md', 'LICENSE']) {
    assert.ok(paths.includes(need), `${need} is packed`);
  }
});
