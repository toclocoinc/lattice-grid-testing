// Grid contract under the Playwright binding. Each case is written the way a
// customer writes an end-to-end test: open the page, find the grid by its
// container, act on it, read it back.
import { test, expect } from '@playwright/test';
import { grid } from '../../dist/playwright/index.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/fixtures/grid.html');
});

test('locates headings, rows and cells, and counts every row', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await g.waitForIdle();
  await expect(g.header('city')).toHaveText(/City/);
  expect(await g.rowCount()).toBe(200);
  await expect(g.cell('name', 0)).toHaveText('Item 001');
  expect(await g.readRow(1)).toEqual({ name: 'Item 002', city: 'Osaka', qty: '37' });
});

test('reads a row far below the rendered window', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await g.waitForIdle();
  expect(await g.readCell('name', 180)).toBe('Item 181');
  await expect(g.row(180)).toBeVisible();
});

test('sorts a column ascending, then descending, then back to none', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await g.sort('city');
  expect(await g.sortState('city')).toBe('ascending');
  expect(await g.readCell('city', 0)).toBe('Accra');
  await g.sort('city', 'descending');
  expect(await g.readCell('city', 0)).toBe('Tallinn');
  await g.sort('city', 'none');
  expect(await g.readCell('name', 0)).toBe('Item 001');
});

test('filters a column through its heading filter, and clears it', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await g.filter('city', 'Osaka');
  expect(await g.rowCount()).toBe(34);
  expect(await g.readCell('city', 0)).toBe('Osaka');
  await expect(g.header('city')).toHaveAttribute('data-filtered', 'true');
  await g.filter('city', '');
  expect(await g.rowCount()).toBe(200);
});

test('selects a range by dragging from one cell to another', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await g.selectRange({ column: 'name', row: 1 }, { column: 'qty', row: 3 });
  // The grid marks a range with class names only, so the test reads it back
  // through the grid's public JS API rather than the DOM (see the README).
  const cells = await page.evaluate(() => window.grid.selection.cells());
  expect(cells.length).toBe(9);
  expect(cells).toContainEqual({ key: '2', colId: 'name' });
  expect(cells).toContainEqual({ key: '4', colId: 'qty' });
});

test('edits a cell and the new value is drawn', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await g.editCell('name', 2, 'Renamed row');
  expect(await g.readCell('name', 2)).toBe('Renamed row');
  expect(await g.readCell('name', 3)).toBe('Item 004');
});

test('waitForIdle settles after a data change, and fails on a grid that never settles', async ({ page }) => {
  const g = grid(page.locator('#grid'));
  await page.evaluate(() => window.grid.rows.load([{ id: 1, name: 'Only', city: 'Quito', qty: 1 }]));
  await g.waitForIdle();
  expect(await g.rowCount()).toBe(1);
  expect(await g.isIdle()).toBe(true);
  await page.evaluate(() => document.querySelector('#grid [role="grid"]').setAttribute('aria-busy', 'true'));
  await expect(g.waitForIdle({ timeout: 300 })).rejects.toThrow(/aria-busy/);
});
