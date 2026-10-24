// Playwright binding: the core's locators as Playwright Locators, the core's
// readers run in the page, and every gesture driven by Playwright's own mouse
// and keyboard (real input events through the browser, not synthetic DOM
// events). @playwright/test is an optional peer; this file imports nothing
// from it, it only calls methods on the Locator it is given.
import { inPage, itemSelector, selectors, viewerSelectors, quote } from '../core/index.js';

/**
 * Turns what the test passed into a Locator.
 * @param {import('@playwright/test').Locator | import('@playwright/test').Page} root A Locator, or a Page (then the first grid on it).
 * @param {string} fallback The selector used when a Page is given.
 * @returns {import('@playwright/test').Locator} The root Locator.
 */
const asLocator = (root, fallback) => (typeof root.locator === 'function' && typeof root.page !== 'function'
  ? root.locator(fallback).first()
  : root);

/**
 * The grid surface for a Playwright test.
 * @param {import('@playwright/test').Locator | import('@playwright/test').Page} root The grid's container (or the role="grid" element itself); a Page means the first grid on it.
 * @returns {import('./index.js').PlaywrightGrid} The surface.
 */
export function grid(root) {
  const host = asLocator(root, selectors.grid);
  const page = host.page();
  const g = host.locator(`xpath=self::*[@role="grid"]`).or(host.locator(selectors.grid)).first();

  /**
   * Runs a core reader against an element.
   * @param {import('@playwright/test').Locator} loc Where it runs.
   * @param {string} op The operation.
   * @param {unknown[]} [args] Its arguments.
   * @returns {Promise<any>} The reader's result.
   */
  const run = (loc, op, args = []) => loc.evaluate(inPage, { op, args });

  /**
   * Brings a data row into the rendered window.
   * @param {number} rowIndex Zero-based view position.
   * @returns {Promise<void>} Settles once the row is rendered.
   */
  const reveal = async (rowIndex) => {
    const ok = await run(g, 'scrollToRow', [rowIndex]);
    if (!ok) throw new Error(`lattice-grid-testing: row ${rowIndex} is not in the grid (rowCount is ${await run(g, 'rowCount')})`);
  };

  /**
   * The centre of an element, in page coordinates.
   * @param {import('@playwright/test').Locator} loc The element.
   * @returns {Promise<{ x: number, y: number }>} Its centre.
   */
  const centre = async (loc) => {
    const r = await run(loc, 'rect');
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  const api = {
    root: host,
    element: () => g,
    header: (column) => g.locator(selectors.header(column)),
    row: (rowIndex) => g.locator(selectors.row(rowIndex)),
    cell: (column, rowIndex) => g.locator(selectors.cell(column, rowIndex)),
    rowCount: () => run(g, 'rowCount'),
    scrollToRow: (rowIndex) => reveal(rowIndex),
    readCell: async (column, rowIndex) => {
      await reveal(rowIndex);
      return run(api.cell(column, rowIndex), 'readCell');
    },
    readRow: async (rowIndex) => {
      await reveal(rowIndex);
      return run(api.row(rowIndex), 'readRow');
    },
    sortState: (column) => run(api.header(column), 'sortState'),
    sort: async (column, direction = 'ascending') => {
      for (let i = 0; i < 3; i++) {
        if ((await api.sortState(column)) === direction) return;
        const at = await centre(api.header(column));
        await page.mouse.click(at.x, at.y);
        await api.waitForIdle();
      }
      const now = await api.sortState(column);
      if (now !== direction) throw new Error(`lattice-grid-testing: column ${column} would not sort ${direction} (it is ${now})`);
    },
    filter: async (column, value) => {
      const head = await centre(api.header(column));
      await page.mouse.move(head.x, head.y);
      const button = g.locator(selectors.filterButton(column));
      const at = await centre(button);
      await page.mouse.click(at.x, at.y);
      const dialog = page.locator(selectors.dialog).last();
      const input = dialog.locator(selectors.dialogInput).first();
      await input.waitFor();
      await input.focus();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      if (value !== '' && value != null) await page.keyboard.type(String(value));
      await api.waitForIdle();
      await page.keyboard.press('Escape');
      await api.waitForIdle();
    },
    selectRange: async (from, to) => {
      await reveal(from.row);
      const a = await centre(api.cell(from.column, from.row));
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await reveal(to.row);
      const b = await centre(api.cell(to.column, to.row));
      await page.mouse.move(b.x, b.y, { steps: 6 });
      await page.mouse.up();
      await api.waitForIdle();
    },
    editCell: async (column, rowIndex, value) => {
      await reveal(rowIndex);
      const at = await centre(api.cell(column, rowIndex));
      await page.mouse.dblclick(at.x, at.y);
      await g.locator(selectors.editor).first().waitFor();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(String(value));
      await page.keyboard.press('Enter');
      await api.waitForIdle();
      // Enter commits; a grid that then opens the next row's editor gets Escape,
      // which leaves that row untouched.
      if (await g.locator(selectors.editor).count()) {
        await page.keyboard.press('Escape');
        await api.waitForIdle();
      }
    },
    isIdle: () => run(host, 'isIdle'),
    waitForIdle: (options = {}) => run(host, 'waitForIdle', [options.timeout, options.quietFrames, selectors.grid]),
  };
  return api;
}

/**
 * Builds a viewer surface (root + items) for Playwright.
 * @param {keyof viewerSelectors} kind The viewer.
 * @param {import('@playwright/test').Locator} root The element the viewer was created in.
 * @returns {import('./index.js').PlaywrightViewer} The surface.
 */
const viewer = (kind, root) => {
  const v = viewerSelectors[kind];
  return {
    root,
    item: (key) => root.locator(itemSelector(kind, key)),
    items: () => root.locator(v.item),
    itemKeys: () => root.evaluate(inPage, { op: 'itemKeys', args: [v.item, v.key] }),
    itemCount: () => root.locator(v.item).count(),
    waitForIdle: (options = {}) => root.evaluate(inPage, { op: 'waitForIdle', args: [options.timeout, options.quietFrames, v.ready] }),
  };
};

/**
 * The list view surface for Playwright.
 * @param {import('@playwright/test').Locator} root The element the list was created in.
 * @returns {import('./index.js').PlaywrightViewer} Root and item locators.
 */
export const list = (root) => viewer('list', root);

/**
 * The data view (card grid) surface for Playwright.
 * @param {import('@playwright/test').Locator} root The element the data view was created in.
 * @returns {import('./index.js').PlaywrightViewer} Root and item locators.
 */
export const dataView = (root) => viewer('dataView', root);

/**
 * The Kanban surface for Playwright; `lane(id)` is a column's card list.
 * @param {import('@playwright/test').Locator} root The element the board was created in.
 * @returns {import('./index.js').PlaywrightKanban} Root, item and lane locators.
 */
export const kanban = (root) => {
  const v = viewerSelectors.kanban;
  return { ...viewer('kanban', root), lane: (id) => root.locator(`${v.lane}[${v.laneKey}=${quote(id)}]`) };
};

/**
 * The Gantt surface for Playwright; items are task bars keyed by task id.
 * @param {import('@playwright/test').Locator} root The element the plan was mounted in.
 * @returns {import('./index.js').PlaywrightViewer} Root and item locators.
 */
export const gantt = (root) => viewer('gantt', root);

/**
 * The calendar surface for Playwright; `day(iso)` is a day cell.
 * @param {import('@playwright/test').Locator} root The element the calendar was created in.
 * @returns {import('./index.js').PlaywrightCalendar} Root, item and day locators.
 */
export const calendar = (root) => {
  const v = viewerSelectors.calendar;
  return { ...viewer('calendar', root), day: (iso) => root.locator(`${v.day}[${v.dayKey}=${quote(iso)}]`) };
};
