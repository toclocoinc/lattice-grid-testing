// Cypress binding: the core's locators as Cypress chains, the core's readers
// called on the element in the app's frame, and every gesture driven by real
// browser input sent through the Chrome DevTools Protocol
// (Cypress.automation('remote:debugger:protocol')), not by synthetic DOM
// events. That needs a Chromium-family browser (Chrome, Edge, Electron).
// cypress is an optional peer; `cy` and `Cypress` are the runner's globals.
import { inPage, itemSelector, selectors, viewerSelectors, quote } from '../core/index.js';

/** How long one gesture may take, in ms, before Cypress fails the command. */
const GESTURE_TIMEOUT = 20000;

/**
 * Sends one DevTools Protocol command.
 * @param {string} command The protocol method, such as Input.dispatchMouseEvent.
 * @param {object} params Its parameters.
 * @returns {Promise<unknown>} The protocol's answer.
 */
const cdp = (command, params) => Cypress.automation('remote:debugger:protocol', { command, params });

/**
 * The centre of an element in the top window's coordinates, which is where
 * protocol input lands: walks out of the app's frame, allowing for the
 * runner's scaling of it.
 * @param {Element} el The element.
 * @returns {{ x: number, y: number }} The point.
 */
const topCentre = (el) => {
  const r = el.getBoundingClientRect();
  let x = r.left + r.width / 2;
  let y = r.top + r.height / 2;
  let win = el.ownerDocument.defaultView;
  for (let f = frameOf(win); f; f = frameOf(win)) {
    const fr = f.getBoundingClientRect();
    const scale = f.offsetWidth ? fr.width / f.offsetWidth : 1;
    x = fr.left + (f.clientLeft + x) * scale;
    y = fr.top + (f.clientTop + y) * scale;
    win = f.ownerDocument.defaultView;
  }
  return { x, y };
};

/**
 * The iframe a window is shown in. The app's window cannot always see its own
 * frame element (the runner may sit on another origin), so the runner's
 * frames are searched from this side, which shares the runner's origin.
 * @param {Window} win The window.
 * @returns {HTMLIFrameElement | null} Its frame, or null for the top window.
 */
const frameOf = (win) => {
  if (win === win.top) return null;
  try {
    if (win.frameElement) return win.frameElement;
  } catch {
    // A cross-origin parent: look from the runner's side instead.
  }
  try {
    for (const f of window.top.document.querySelectorAll('iframe')) if (f.contentWindow === win) return f;
  } catch {
    // The top window is out of reach too; no offset can be added.
  }
  return null;
};

/** Mouse state carried between protocol events. */
const mouse = { x: 0, y: 0, down: false };

/**
 * Moves the real mouse pointer.
 * @param {number} x Top-window x.
 * @param {number} y Top-window y.
 * @param {number} [steps] Intermediate moves, so a drag is seen as one.
 * @returns {Promise<void>} Settles once the moves are sent.
 */
const moveTo = async (x, y, steps = 1) => {
  const fromX = mouse.x;
  const fromY = mouse.y;
  for (let i = 1; i <= steps; i++) {
    const px = fromX + ((x - fromX) * i) / steps;
    const py = fromY + ((y - fromY) * i) / steps;
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px, y: py, button: mouse.down ? 'left' : 'none', buttons: mouse.down ? 1 : 0 });
  }
  mouse.x = x;
  mouse.y = y;
};

/**
 * Presses or releases the left mouse button where the pointer is.
 * @param {'mousePressed' | 'mouseReleased'} type Which.
 * @param {number} [clickCount] 1 for a click, 2 for the second half of a double click.
 * @returns {Promise<unknown>} The protocol's answer.
 */
const button = (type, clickCount = 1) => {
  mouse.down = type === 'mousePressed';
  return cdp('Input.dispatchMouseEvent', { type, x: mouse.x, y: mouse.y, button: 'left', buttons: mouse.down ? 1 : 0, clickCount });
};

/**
 * Clicks (or double clicks) the centre of an element with the real mouse.
 * @param {Element} el The element.
 * @param {number} [count] 1 for a click, 2 for a double click.
 * @returns {Promise<void>} Settles once the click is sent.
 */
const clickEl = async (el, count = 1) => {
  const at = topCentre(el);
  await moveTo(at.x, at.y);
  for (let n = 1; n <= count; n++) {
    await button('mousePressed', n);
    await button('mouseReleased', n);
  }
};

/** Named keys: DOM key, code, Windows virtual key code and the text they type. */
const KEYS = {
  Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  Backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
};

/** Virtual key codes for punctuation on a US layout. */
const PUNCT = { ' ': [32, 'Space'], '-': [189, 'Minus'], '=': [187, 'Equal'], ',': [188, 'Comma'], '.': [190, 'Period'], '/': [191, 'Slash'], ';': [186, 'Semicolon'], "'": [222, 'Quote'] };

/**
 * Describes the key that types one character.
 * @param {string} ch The character.
 * @returns {{ key: string, code: string, vk: number, text: string }} The key.
 */
const charKey = (ch) => {
  if (/^[a-z]$/i.test(ch)) return { key: ch, code: `Key${ch.toUpperCase()}`, vk: ch.toUpperCase().charCodeAt(0), text: ch };
  if (/^[0-9]$/.test(ch)) return { key: ch, code: `Digit${ch}`, vk: ch.charCodeAt(0), text: ch };
  const p = PUNCT[ch];
  return { key: ch, code: p ? p[1] : '', vk: p ? p[0] : 0, text: ch };
};

/**
 * Presses and releases one key with real keyboard events.
 * @param {{ key: string, code: string, vk: number, text?: string }} k The key.
 * @param {{ modifiers?: number, commands?: string[] }} [extra] Modifier bits and editing commands.
 * @returns {Promise<void>} Settles once both events are sent.
 */
const press = async (k, extra = {}) => {
  const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers: extra.modifiers || 0 };
  const typed = k.text && !extra.modifiers ? { text: k.text, unmodifiedText: k.text } : {};
  await cdp('Input.dispatchKeyEvent', { type: typed.text ? 'keyDown' : 'rawKeyDown', ...base, ...typed, commands: extra.commands });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};

/**
 * Types text one real key press at a time.
 * @param {string} text What to type.
 * @returns {Promise<void>} Settles once every key is sent.
 */
const typeText = async (text) => {
  for (const ch of text) await press(charKey(ch));
};

/**
 * Selects everything in the focused text box with the platform's own
 * shortcut: Meta+A on macOS, Control+A elsewhere.
 * @returns {Promise<void>} Settles once the shortcut is sent.
 */
const selectAll = () => {
  const mac = Cypress.platform === 'darwin';
  return press({ key: 'a', code: 'KeyA', vk: 65 }, { modifiers: mac ? 4 : 2, commands: mac ? ['selectAll'] : undefined });
};

/**
 * Waits, a frame at a time, for a function to return something.
 * @param {Window} win The app's window.
 * @param {() => any} find The probe.
 * @param {string} what What is awaited, for the error.
 * @param {number} [timeout] Give-up time in ms.
 * @returns {Promise<any>} The probe's first truthy answer.
 */
const until = (win, find, what, timeout = 5000) => new Promise((done, fail) => {
  const end = Date.now() + timeout;
  /** One probe per frame. */
  const step = () => {
    const got = find();
    if (got) done(got);
    else if (Date.now() > end) fail(new Error(`lattice-grid-testing: timed out waiting for ${what}`));
    else win.requestAnimationFrame(step);
  };
  step();
});

/**
 * Finds a required element under a root.
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
 * The gestures, as plain async functions over the grid element. Each sends
 * real input and waits for the grid to settle.
 */
const gestures = {
  /**
   * Scrolls a row into the rendered window or fails.
   * @param {Element} g The grid element.
   * @param {number} rowIndex Zero-based view position.
   * @returns {Promise<void>} Settles once the row is rendered.
   */
  reveal: async (g, rowIndex) => {
    if (!(await inPage(g, { op: 'scrollToRow', args: [rowIndex] }))) {
      throw new Error(`lattice-grid-testing: row ${rowIndex} is not in the grid (rowCount is ${inPage(g, { op: 'rowCount' })})`);
    }
  },
  /**
   * Clicks a heading until the column sorts in the asked direction.
   * @param {Element} g The grid element.
   * @param {string} column The column's field.
   * @param {string} direction 'ascending', 'descending' or 'none'.
   * @returns {Promise<void>} Settles once sorted.
   */
  sort: async (g, column, direction) => {
    for (let i = 0; i < 3; i++) {
      const head = must(g, selectors.header(column));
      if (inPage(head, { op: 'sortState' }) === direction) return;
      await clickEl(head);
      await inPage(g, { op: 'waitForIdle' });
    }
    const now = inPage(must(g, selectors.header(column)), { op: 'sortState' });
    if (now !== direction) throw new Error(`lattice-grid-testing: column ${column} would not sort ${direction} (it is ${now})`);
  },
  /**
   * Types a value into a column's filter.
   * @param {Element} g The grid element.
   * @param {string} column The column's field.
   * @param {string} value The filter text; empty clears it.
   * @returns {Promise<void>} Settles once the filter is applied and the popup closed.
   */
  filter: async (g, column, value) => {
    const doc = g.ownerDocument;
    const head = must(g, selectors.header(column));
    const at = topCentre(head);
    await moveTo(at.x, at.y);
    await clickEl(must(g, selectors.filterButton(column)));
    const input = await until(doc.defaultView, () => {
      const dialogs = doc.querySelectorAll(selectors.dialog);
      const last = dialogs[dialogs.length - 1];
      return last && last.querySelector(selectors.dialogInput);
    }, 'the filter dialog');
    await clickEl(input);
    await selectAll();
    await press(KEYS.Backspace);
    if (value !== '' && value != null) await typeText(String(value));
    await inPage(g, { op: 'waitForIdle' });
    await press(KEYS.Escape);
    await inPage(g, { op: 'waitForIdle' });
  },
  /**
   * Drags the real mouse from one cell to another.
   * @param {Element} g The grid element.
   * @param {{ column: string, row: number }} from The anchor cell.
   * @param {{ column: string, row: number }} to The far corner.
   * @returns {Promise<void>} Settles once the drag ends.
   */
  selectRange: async (g, from, to) => {
    await gestures.reveal(g, from.row);
    const a = topCentre(must(g, selectors.cell(from.column, from.row)));
    await moveTo(a.x, a.y);
    await button('mousePressed');
    await gestures.reveal(g, to.row);
    const b = topCentre(must(g, selectors.cell(to.column, to.row)));
    await moveTo(b.x, b.y, 6);
    await button('mouseReleased');
    await inPage(g, { op: 'waitForIdle' });
  },
  /**
   * Opens a cell's editor with a double click, replaces its text and commits with Enter.
   * @param {Element} g The grid element.
   * @param {string} column The column's field.
   * @param {number} rowIndex Zero-based view position.
   * @param {unknown} value The new text.
   * @returns {Promise<void>} Settles once committed.
   */
  editCell: async (g, column, rowIndex, value) => {
    await gestures.reveal(g, rowIndex);
    await clickEl(must(g, selectors.cell(column, rowIndex)), 2);
    await until(g.ownerDocument.defaultView, () => g.querySelector(selectors.editor), 'the cell editor');
    await selectAll();
    await typeText(String(value));
    await press(KEYS.Enter);
    await inPage(g, { op: 'waitForIdle' });
    // Enter commits; a grid that then opens the next row's editor gets Escape,
    // which leaves that row untouched.
    if (g.querySelector(selectors.editor)) {
      await press(KEYS.Escape);
      await inPage(g, { op: 'waitForIdle' });
    }
  },
};

/**
 * The grid surface for a Cypress test. Locators and readers yield Cypress
 * subjects; gestures queue a command that sends real input.
 * @param {string} root A selector for the grid's container (or the role="grid" element itself).
 * @returns {import('./index.js').CypressGrid} The surface.
 */
export function grid(root) {
  /**
   * The role="grid" element, as a Cypress subject.
   * @returns {Cypress.Chainable<JQuery<HTMLElement>>} The chain.
   */
  const g = () => cy.get(root).then(($r) => Cypress.$(inPage($r[0], { op: 'gridOf' })));

  /**
   * Queues an async step on the grid element.
   * @param {(el: Element) => unknown} fn The step.
   * @returns {Cypress.Chainable<any>} The chain, yielding the step's result.
   */
  const step = (fn) => g().then({ timeout: GESTURE_TIMEOUT }, ($g) => fn($g[0]));

  const api = {
    root,
    element: () => g(),
    header: (column) => g().find(selectors.header(column)),
    row: (rowIndex) => g().find(selectors.row(rowIndex)),
    cell: (column, rowIndex) => g().find(selectors.cell(column, rowIndex)),
    rowCount: () => step((el) => inPage(el, { op: 'rowCount' })),
    scrollToRow: (rowIndex) => step((el) => gestures.reveal(el, rowIndex)),
    readCell: (column, rowIndex) => step(async (el) => {
      await gestures.reveal(el, rowIndex);
      return inPage(must(el, selectors.cell(column, rowIndex)), { op: 'readCell' });
    }),
    readRow: (rowIndex) => step(async (el) => {
      await gestures.reveal(el, rowIndex);
      return inPage(must(el, selectors.row(rowIndex)), { op: 'readRow' });
    }),
    sortState: (column) => step((el) => inPage(must(el, selectors.header(column)), { op: 'sortState' })),
    sort: (column, direction = 'ascending') => step((el) => gestures.sort(el, column, direction)),
    filter: (column, value) => step((el) => gestures.filter(el, column, value)),
    selectRange: (from, to) => step((el) => gestures.selectRange(el, from, to)),
    editCell: (column, rowIndex, value) => step((el) => gestures.editCell(el, column, rowIndex, value)),
    isIdle: () => cy.get(root).then(($r) => inPage($r[0], { op: 'isIdle' })),
    waitForIdle: (options = {}) => cy.get(root).then({ timeout: (options.timeout || 10000) + 1000 }, ($r) => inPage($r[0], { op: 'waitForIdle', args: [options.timeout, options.quietFrames, selectors.grid] })),
  };
  return api;
}

/**
 * Builds a viewer surface (root + items) for Cypress.
 * @param {keyof viewerSelectors} kind The viewer.
 * @param {string} root A selector for the element the viewer was created in.
 * @returns {import('./index.js').CypressViewer} The surface.
 */
const viewer = (kind, root) => {
  const v = viewerSelectors[kind];
  return {
    root,
    item: (key) => cy.get(root).find(itemSelector(kind, key)),
    items: () => cy.get(root).find(v.item),
    itemKeys: () => cy.get(root).then(($r) => inPage($r[0], { op: 'itemKeys', args: [v.item, v.key] })),
    itemCount: () => cy.get(root).then(($r) => $r[0].querySelectorAll(v.item).length),
    waitForIdle: (options = {}) => cy.get(root).then({ timeout: (options.timeout || 10000) + 1000 }, ($r) => inPage($r[0], { op: 'waitForIdle', args: [options.timeout, options.quietFrames, v.ready] })),
  };
};

/**
 * The list view surface for Cypress.
 * @param {string} root A selector for the element the list was created in.
 * @returns {import('./index.js').CypressViewer} Root and item locators.
 */
export const list = (root) => viewer('list', root);

/**
 * The data view (card grid) surface for Cypress.
 * @param {string} root A selector for the element the data view was created in.
 * @returns {import('./index.js').CypressViewer} Root and item locators.
 */
export const dataView = (root) => viewer('dataView', root);

/**
 * The Kanban surface for Cypress; `lane(id)` is a column's card list.
 * @param {string} root A selector for the element the board was created in.
 * @returns {import('./index.js').CypressKanban} Root, item and lane locators.
 */
export const kanban = (root) => {
  const v = viewerSelectors.kanban;
  return { ...viewer('kanban', root), lane: (id) => cy.get(root).find(`${v.lane}[${v.laneKey}=${quote(id)}]`) };
};

/**
 * The Gantt surface for Cypress; items are task bars keyed by task id.
 * @param {string} root A selector for the element the plan was mounted in.
 * @returns {import('./index.js').CypressViewer} Root and item locators.
 */
export const gantt = (root) => viewer('gantt', root);

/**
 * The calendar surface for Cypress; `day(iso)` is a day cell.
 * @param {string} root A selector for the element the calendar was created in.
 * @returns {import('./index.js').CypressCalendar} Root, item and day locators.
 */
export const calendar = (root) => {
  const v = viewerSelectors.calendar;
  return { ...viewer('calendar', root), day: (iso) => cy.get(root).find(`${v.day}[${v.dayKey}=${quote(iso)}]`) };
};
