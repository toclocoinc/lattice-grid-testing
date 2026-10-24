# Worked example: Playwright

From nothing to a passing end-to-end test of the grid in your app.

## 1. Install (one command)

```sh
npm install --save-dev @toclocoinc/lattice-grid-testing
```

You need `@playwright/test` too; if your project does not have it yet:
`npm init playwright@latest`.

## 2. Tell the test where your grid is

Three facts about your app, nothing else: the page the grid is on, a CSS
selector for the element you passed to `createGrid`, and the `field` of one
text column. The grid needs no option set for the helpers to work.

## 3. Write the test

Save as `tests/grid.spec.js` (or `.ts`), change the three constants, run
`npx playwright test tests/grid.spec.js`.

```js
import { test, expect } from '@playwright/test';
import { grid } from '@toclocoinc/lattice-grid-testing/playwright';

const PAGE = 'http://localhost:3000/orders'; // the page your grid is on
const GRID = '#orders-grid';                 // the element passed to createGrid
const COLUMN = 'city';                       // the field of a text column

test('the grid sorts, filters and reads back', async ({ page }) => {
  await page.goto(PAGE);
  const g = grid(page.locator(GRID));
  await g.waitForIdle();

  const total = await g.rowCount();
  expect(total).toBeGreaterThan(0);
  await expect(g.header(COLUMN)).toBeVisible();

  await g.sort(COLUMN);
  expect(await g.sortState(COLUMN)).toBe('ascending');

  const first = await g.readCell(COLUMN, 0);
  await g.filter(COLUMN, first);
  expect(await g.rowCount()).toBeGreaterThan(0);
  expect(await g.readCell(COLUMN, 0)).toContain(first);
  await expect(g.header(COLUMN)).toHaveAttribute('data-filtered', 'true');

  await g.filter(COLUMN, '');
  expect(await g.rowCount()).toBe(total);
});
```

## 4. Going further

```js
const row = await g.readRow(41);            // { name: '…', city: '…', … }, scrolled into view first
await g.editCell('name', 2, 'Renamed');     // double click, type, Enter (the column must be editable)
await g.selectRange({ column: 'name', row: 1 }, { column: 'qty', row: 3 }); // a real mouse drag
await g.scrollToRow(150);                   // then g.row(150) / g.cell('qty', 150) are on screen
await g.waitForIdle({ timeout: 20000 });    // after anything that loads data
```

Viewers:

```js
import { kanban, calendar } from '@toclocoinc/lattice-grid-testing/playwright';

const board = kanban(page.locator('#board'));
await expect(board.lane('done').locator('[role="listitem"]')).toHaveCount(3);
await expect(board.item(42)).toHaveAttribute('data-column', 'done');

const cal = calendar(page.locator('#calendar'));
await expect(cal.day('2026-03-18').locator('[data-key="e2"]')).toHaveCount(1);
```

Every locator is a Playwright `Locator`, so `expect(...)`, `.click()` and
auto-waiting work on it as usual. Gestures go through Playwright's own mouse
and keyboard: they are real input events, not synthetic DOM events.
