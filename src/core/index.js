// Framework-neutral core of @toclocoinc/lattice-grid-testing.
//
// Everything here stands on the grid's public DOM contract: ARIA roles and
// the data-* attributes the grid guarantees. Nothing reads a class name, so a
// grid update that restyles its markup does not move a test.
//
// The core has three parts:
//   - selectors: CSS selector builders for every locator in the surface;
//   - inPage: one self-contained function that runs in the page and reads the
//     DOM (row count, cell text, sort state, scrolling, idleness). It calls no
//     other module-level code, so a runner may serialise it into the page;
//   - grid(root) and the viewer factories: the same surface over a live DOM
//     element, for a test that already runs inside the page.
// The Playwright and Cypress bindings reuse the first two and drive the
// gestures (click, drag, type) with each runner's own real input events.

/**
 * Quotes a value for use inside a CSS attribute selector.
 * @param {string | number} value The attribute value.
 * @returns {string} The value in double quotes, with quotes and backslashes escaped.
 */
export const quote = (value) => `"${String(value).replace(/["\\]/g, '\\$&')}"`;

/** CSS selectors for the grid's public DOM contract. */
export const selectors = {
  /** The grid element itself. */
  grid: '[role="grid"]',
  /**
   * A column heading.
   * @param {string} column The column's field.
   * @returns {string} The selector.
   */
  header: (column) => `[role="columnheader"][data-col=${quote(column)}]`,
  /**
   * The heading's filter button: the one control in the heading that opens a dialog.
   * @param {string} column The column's field.
   * @returns {string} The selector.
   */
  filterButton: (column) => `[role="columnheader"][data-col=${quote(column)}] button[aria-haspopup="dialog"]`,
  /** An open dialog, such as the filter popup. */
  dialog: '[role="dialog"]',
  /** The text box a filter dialog types into. */
  dialogInput: 'input[type="text"], input:not([type]), input[type="search"], input[type="number"]',
  /** Every data row (heading rows carry no data-index). */
  rows: '[role="row"][data-index]',
  /**
   * The data row at a view position.
   * @param {number} rowIndex Zero-based position in the grid's current sorted, filtered view.
   * @returns {string} The selector.
   */
  row: (rowIndex) => `[role="row"][data-index=${quote(rowIndex)}]`,
  /**
   * A data row by its row key.
   * @param {string | number} key The row key.
   * @returns {string} The selector.
   */
  rowByKey: (key) => `[role="row"][data-key=${quote(key)}]`,
  /**
   * The cell of a column in the data row at a view position.
   * @param {string} column The column's field.
   * @param {number} rowIndex Zero-based view position.
   * @returns {string} The selector.
   */
  cell: (column, rowIndex) => `[role="row"][data-index=${quote(rowIndex)}] [role="gridcell"][data-col=${quote(column)}]`,
  /** An editor the grid opened inside a cell. */
  editor: '[role="gridcell"] input, [role="gridcell"] textarea, [role="gridcell"] select',
};

/**
 * How each viewer is found: its root inside the element the test names, and
 * its items. `key` is the attribute an item's identity is read from;
 * `ready` is what must exist before the viewer counts as mounted.
 */
export const viewerSelectors = {
  list: { ready: '[role="grid"]', root: '[role="grid"]', item: '[role="row"][data-key]', key: 'data-key' },
  dataView: { ready: '[role="grid"]', root: '[role="grid"]', item: '[role="gridcell"][data-key]', key: 'data-key' },
  kanban: { ready: '[role="list"][data-column]', root: '[role="group"]', item: '[role="listitem"][data-key]', key: 'data-key', lane: '[role="list"][data-column]', laneKey: 'data-column' },
  gantt: { ready: 'svg[role="img"]', root: 'svg[role="img"]', item: '[role="button"][data-task]', key: 'data-task' },
  calendar: { ready: '[role="gridcell"][data-day]', root: '[role="grid"]', item: '[role="button"][data-key]', key: 'data-key', day: '[role="gridcell"][data-day]', dayKey: 'data-day' },
};

/**
 * The selector for one viewer item by its key.
 * @param {keyof viewerSelectors} kind The viewer.
 * @param {string | number} key The item's key (a row key; a task id for Gantt).
 * @returns {string} The selector.
 */
export const itemSelector = (kind, key) => {
  const v = viewerSelectors[kind];
  return `${v.item}[${v.key}=${quote(key)}]`;
};

/**
 * The page-side reader. Self-contained on purpose: it references nothing
 * outside its own body, so Playwright can ship it to the page with
 * `locator.evaluate(inPage, { op, args })` and Cypress can call it directly.
 *
 * Operations (the element is the root the test named, or a cell/row):
 *   gridOf, rowCount, readCell, readRow, sortState, scrollToRow, rect,
 *   isIdle, waitForIdle, itemKeys.
 *
 * @param {Element} el The element the operation starts from.
 * @param {{ op: string, args?: unknown[] }} call The operation and its arguments.
 * @returns {unknown} The operation's result, or a promise of it.
 */
export function inPage(el, call) {
  const args = call.args || [];
  const win = el.ownerDocument.defaultView;

  /**
   * The role="grid" element at or under the root.
   * @param {Element} root The element the test named.
   * @returns {Element} The grid element.
   */
  const gridOf = (root) => {
    if (root.getAttribute('role') === 'grid') return root;
    const found = root.querySelector('[role="grid"]');
    if (!found) throw new Error('lattice-grid-testing: no [role="grid"] at or under the given root');
    return found;
  };

  /**
   * The visible text of an element, trimmed and with runs of white space collapsed.
   * @param {Element} node The element.
   * @returns {string} Its text.
   */
  const text = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();

  /**
   * How many heading rows the grid counts in aria-rowcount.
   * @param {Element} g The grid element.
   * @returns {number} The highest aria-rowindex of a row that holds a column heading.
   */
  const headerRows = (g) => {
    let most = 0;
    for (const r of g.querySelectorAll('[role="row"]')) {
      if (!r.querySelector('[role="columnheader"]')) continue;
      most = Math.max(most, Number(r.getAttribute('aria-rowindex')) || 0);
    }
    return most;
  };

  /**
   * The grid's scrolling body: the element that scrolls its data rows.
   * @param {Element} g The grid element.
   * @returns {Element | null} The scroller, or null when every row fits.
   */
  const scroller = (g) => {
    const row = g.querySelector('[role="row"][data-index]');
    for (let n = row && row.parentElement; n && n !== g.parentElement; n = n.parentElement) {
      const oy = win.getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
  };

  /**
   * Resolves after the next animation frame.
   * @returns {Promise<void>} Settles on the frame.
   */
  const frame = () => new Promise((done) => win.requestAnimationFrame(() => done()));

  /**
   * What, if anything, the root is still busy with, by the grid's public signals.
   * @param {Element} root The element the test named.
   * @returns {string | null} A description of the pending work, or null when none.
   */
  const busy = (root) => {
    const sel = '[aria-busy="true"], [data-loading="true"]';
    const hit = root.matches(sel) ? root : root.querySelector(sel);
    if (!hit) return null;
    return hit.getAttribute('aria-busy') === 'true' ? 'aria-busy="true"' : 'data-loading="true"';
  };

  const ops = {
    gridOf: () => gridOf(el),
    rowCount: () => {
      const g = gridOf(el);
      const total = Number(g.getAttribute('aria-rowcount'));
      if (Number.isFinite(total) && total >= 0) return Math.max(0, total - headerRows(g));
      return g.querySelectorAll('[role="row"][data-index]').length;
    },
    readCell: () => {
      const editor = el.querySelector('input, textarea, select');
      return editor ? String(editor.value) : text(el);
    },
    readRow: () => {
      const out = {};
      for (const c of el.querySelectorAll('[role="gridcell"][data-col]')) out[c.getAttribute('data-col')] = text(c);
      return out;
    },
    sortState: () => el.getAttribute('aria-sort') || 'none',
    rect: () => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    scrollToRow: async () => {
      const [rowIndex, timeout = 5000] = args;
      const g = gridOf(el);
      const sel = `[role="row"][data-index="${Number(rowIndex)}"]`;
      const deadline = Date.now() + timeout;
      for (let tries = 0; Date.now() < deadline; tries++) {
        const row = g.querySelector(sel);
        if (row) {
          const box = scroller(g);
          if (box) {
            const r = row.getBoundingClientRect();
            const b = box.getBoundingClientRect();
            if (r.top < b.top) box.scrollTop -= b.top - r.top;
            else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
          }
          await frame();
          if (g.querySelector(sel)) return true;
          continue;
        }
        const box = scroller(g);
        const any = g.querySelector('[role="row"][data-index]');
        if (!box || !any) return false;
        const height = any.getBoundingClientRect().height || 1;
        box.scrollTop = Math.max(0, Number(rowIndex) * height - box.clientHeight / 2);
        await frame();
        await frame();
        if (tries > 50) return false;
      }
      return false;
    },
    isIdle: () => busy(el) === null,
    waitForIdle: () => {
      const [timeout = 10000, quietFrames = 2, ready] = args;
      /**
       * Whether the component has mounted under the root yet.
       * @returns {boolean} True when there is nothing to wait for or it is there.
       */
      const mounted = () => !ready || el.matches(ready) || el.querySelector(ready) !== null;
      return new Promise((done, fail) => {
        let quiet = 0;
        let changed = false;
        const watch = new win.MutationObserver(() => { changed = true; });
        watch.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
        const stop = win.setTimeout(() => {
          watch.disconnect();
          const why = busy(el) || (mounted() ? 'the DOM kept changing' : `nothing matching ${ready} appeared`);
          fail(new Error(`lattice-grid-testing: waitForIdle timed out after ${timeout} ms (${why})`));
        }, timeout);
        /** Counts quiet frames until enough have passed in a row. */
        const tick = () => {
          if (changed || busy(el) || !mounted()) quiet = 0;
          else quiet += 1;
          changed = false;
          if (quiet >= quietFrames) {
            win.clearTimeout(stop);
            watch.disconnect();
            done(true);
            return;
          }
          win.requestAnimationFrame(tick);
        };
        win.requestAnimationFrame(tick);
      });
    },
    itemKeys: () => {
      const [itemSel, keyAttr] = args;
      return [...el.querySelectorAll(itemSel)].map((n) => n.getAttribute(keyAttr));
    },
  };
  const fn = ops[call.op];
  if (!fn) throw new Error(`lattice-grid-testing: unknown operation ${call.op}`);
  return fn();
}

/**
 * Resolves the element a viewer lives in: the root itself when it matches,
 * else the first match under it.
 * @param {Element} root The element the test named.
 * @param {string} rootSelector The viewer's root selector.
 * @returns {Element} The viewer's root element.
 */
const viewerRoot = (root, rootSelector) => {
  if (root.matches(rootSelector)) return root;
  const found = root.querySelector(rootSelector);
  if (!found) throw new Error(`lattice-grid-testing: no ${rootSelector} at or under the given root`);
  return found;
};

/**
 * Finds an element under a root, or throws naming the selector.
 * @param {Element} root Where to look.
 * @param {string} sel The selector.
 * @returns {Element} The element.
 */
const must = (root, sel) => {
  const found = root.querySelector(sel);
  if (!found) throw new Error(`lattice-grid-testing: nothing matches ${sel}`);
  return found;
};

/**
 * The grid surface over a live DOM element, for a test that runs in the page
 * itself. Locators return elements; readers return values; `waitForIdle` and
 * `scrollToRow` return promises. Gestures (sort, filter, editCell,
 * selectRange) belong to the runner bindings, which drive them with real input.
 * @param {Element} root The grid's container, or the role="grid" element.
 * @returns {import('./index.js').DomGrid} The surface.
 */
export function grid(root) {
  return {
    root,
    element: () => inPage(root, { op: 'gridOf' }),
    header: (column) => must(inPage(root, { op: 'gridOf' }), selectors.header(column)),
    row: (rowIndex) => must(inPage(root, { op: 'gridOf' }), selectors.row(rowIndex)),
    cell: (column, rowIndex) => must(inPage(root, { op: 'gridOf' }), selectors.cell(column, rowIndex)),
    rowCount: () => inPage(root, { op: 'rowCount' }),
    readCell: (column, rowIndex) => inPage(must(inPage(root, { op: 'gridOf' }), selectors.cell(column, rowIndex)), { op: 'readCell' }),
    readRow: (rowIndex) => inPage(must(inPage(root, { op: 'gridOf' }), selectors.row(rowIndex)), { op: 'readRow' }),
    sortState: (column) => inPage(must(inPage(root, { op: 'gridOf' }), selectors.header(column)), { op: 'sortState' }),
    scrollToRow: (rowIndex, options = {}) => inPage(root, { op: 'scrollToRow', args: [rowIndex, options.timeout] }),
    isIdle: () => inPage(root, { op: 'isIdle' }),
    waitForIdle: (options = {}) => inPage(root, { op: 'waitForIdle', args: [options.timeout, options.quietFrames, selectors.grid] }),
  };
}

/**
 * Builds a viewer surface (root + items) over a live DOM element.
 * @param {keyof viewerSelectors} kind The viewer.
 * @param {Element} root The element the viewer was created in.
 * @returns {import('./index.js').DomViewer} The surface.
 */
const domViewer = (kind, root) => {
  const v = viewerSelectors[kind];
  const el = () => viewerRoot(root, v.root);
  return {
    root,
    item: (key) => must(el(), itemSelector(kind, key)),
    items: () => [...el().querySelectorAll(v.item)],
    itemKeys: () => inPage(el(), { op: 'itemKeys', args: [v.item, v.key] }),
    itemCount: () => el().querySelectorAll(v.item).length,
    waitForIdle: (options = {}) => inPage(root, { op: 'waitForIdle', args: [options.timeout, options.quietFrames, selectors.grid] }),
  };
};

/**
 * The list view surface over a live DOM element.
 * @param {Element} root The element the list was created in.
 * @returns {import('./index.js').DomViewer} Root and item locators.
 */
export const list = (root) => domViewer('list', root);

/**
 * The data view (card grid) surface over a live DOM element.
 * @param {Element} root The element the data view was created in.
 * @returns {import('./index.js').DomViewer} Root and item locators.
 */
export const dataView = (root) => domViewer('dataView', root);

/**
 * The Kanban surface over a live DOM element; `lane(id)` finds a column's card list.
 * @param {Element} root The element the board was created in.
 * @returns {import('./index.js').DomKanban} Root, item and lane locators.
 */
export const kanban = (root) => {
  const base = domViewer('kanban', root);
  const v = viewerSelectors.kanban;
  return { ...base, lane: (id) => must(viewerRoot(root, v.root), `${v.lane}[${v.laneKey}=${quote(id)}]`) };
};

/**
 * The Gantt surface over a live DOM element; items are task bars keyed by task id.
 * @param {Element} root The element the plan was mounted in.
 * @returns {import('./index.js').DomViewer} Root and item locators.
 */
export const gantt = (root) => domViewer('gantt', root);

/**
 * The calendar surface over a live DOM element; `day(iso)` finds a day cell.
 * @param {Element} root The element the calendar was created in.
 * @returns {import('./index.js').DomCalendar} Root, item and day locators.
 */
export const calendar = (root) => {
  const base = domViewer('calendar', root);
  const v = viewerSelectors.calendar;
  return { ...base, day: (iso) => must(viewerRoot(root, v.root), `${v.day}[${v.dayKey}=${quote(iso)}]`) };
};
