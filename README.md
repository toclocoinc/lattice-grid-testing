# @toclocoinc/lattice-grid-testing

Playwright and Cypress helpers for end-to-end tests of applications built on
Lattice Grid: find a cell, read a row, sort a column, filter, edit, select a
range, wait until the grid has settled. Locators and readers stand on the
grid's public DOM contract (ARIA roles and `data-*` attributes), never on
class names, so a grid update that restyles its markup does not break your
tests.

## Install

```sh
npm install --save-dev @toclocoinc/lattice-grid-testing
```

Zero runtime dependencies. `@playwright/test` and `cypress` are optional peers:
install whichever runner you use. The grid needs no option set for the helpers
to work; point them at the element you passed to `createGrid`.

## Use

The same calls under both runners; only the import (and each runner's own
idiom for awaiting and asserting) differs.

```js
// Playwright
import { grid } from '@toclocoinc/lattice-grid-testing/playwright';

const g = grid(page.locator('#orders'));
await g.sort('city');
expect(await g.readCell('city', 0)).toBe('Accra');
```

```js
// Cypress
import { grid } from '@toclocoinc/lattice-grid-testing/cypress';

const g = grid('#orders');
g.sort('city');
g.readCell('city', 0).should('equal', 'Accra');
```

Worked examples, copy-paste to a passing test:
[Playwright](docs/playwright.md) · [Cypress](docs/cypress.md).

## The surface

`grid(root)`: `root` is the grid's container or its `role="grid"` element (a
Playwright `Locator`, a Cypress selector string, or a DOM element for the core).

| Call | What it does |
|---|---|
| `header(column)` | Locator for a column heading, by the column's `field`. |
| `cell(column, rowIndex)` | Locator for a rendered cell. `rowIndex` is the zero-based position in the current sorted, filtered view. |
| `row(rowIndex)` | Locator for a rendered data row. |
| `scrollToRow(rowIndex)` | Scrolls a row into the grid's rendered window (rows are virtualised). |
| `rowCount()` | Rows in the current view, rendered or not. |
| `readCell(column, rowIndex)` | The cell's text, scrolling to it first. |
| `readRow(rowIndex)` | `{ field: text }` for every rendered column of the row, scrolling to it first. |
| `sortState(column)` | `'ascending'`, `'descending'` or `'none'`. |
| `sort(column, direction = 'ascending')` | Clicks the heading until the column sorts that way. |
| `filter(column, value)` | Types `value` into the column's heading filter; `''` clears it. |
| `selectRange(from, to)` | Drags the mouse from cell `{ column, row }` to cell `{ column, row }`. |
| `editCell(column, rowIndex, value)` | Double-clicks the cell, replaces its text, commits with Enter. The column must be editable in your app. |
| `isIdle()` | Whether the grid shows no pending work now. |
| `waitForIdle({ timeout, quietFrames })` | Resolves once the grid has settled (below). |

Viewers, each with `item(key)`, `items()`, `itemKeys()`, `itemCount()` and
`waitForIdle()`:

| Factory | Root | Items keyed by | Extra |
|---|---|---|---|
| `list(root)` | `role="grid"` | row key (`data-key`) | |
| `dataView(root)` | `role="grid"` | item key (`data-key`) | |
| `kanban(root)` | `role="group"` board | card key (`data-key`) | `lane(columnId)` |
| `gantt(root)` | `role="img"` chart | task id (`data-task`) | |
| `calendar(root)` | `role="grid"` | event key (`data-key`) | `day('YYYY-MM-DD')` |

`@toclocoinc/lattice-grid-testing/core` (also the package root) holds the
framework-neutral part: the CSS selectors, the page-side readers, and the same
surface over live DOM elements for a test that runs inside the page.

### Real input

Gestures are real input, not synthetic DOM events: the Playwright binding uses
Playwright's mouse and keyboard; the Cypress binding sends mouse and key events
through the browser's DevTools Protocol, so it needs a Chromium-family browser
(Chrome, Edge, Electron). Select-all uses the platform's modifier (Meta on
macOS, Control elsewhere).

### When the grid has settled

`waitForIdle` resolves when, for `quietFrames` animation frames in a row
(default 2), nothing under the root has changed and nothing carries the grid's
public busy signals (`aria-busy="true"`, `data-loading="true"`), and the
component has mounted. It rejects after `timeout` ms (default 10000) naming what
was still pending. Every gesture waits for it before returning.

## What the package promises

- It reads only ARIA roles and `data-*` attributes the grid renders as its DOM
  contract. No helper references a grid class name; the package's own
  test run fails if one does.
- It sets no grid option and asks you to set none.
- It is versioned independently of the grid. Each release states the grid
  versions its contract tests ran against; this one, 0.1.0, ran against
  `@toclocoinc/lattice-grid` 1.112.0.

## Known gaps in this release

Two parts of the grid's DOM contract are not there yet, and the helpers say so
rather than paper over it:

- **No reader for a selected range.** The grid does not yet mark range-selected
  cells with `aria-selected`, so `selectRange` performs the gesture but nothing
  in this package can report which cells ended up selected. Assert on what the
  selection caused (an edit, a copy, a status line) until the grid carries the
  attribute.
- **No busy signal while a source loads.** The grid does not yet raise
  `aria-busy="true"` while rows are on their way, so `waitForIdle` rests on the
  quiet-frames rule and the mount check. A slow remote source can look idle
  between the request and the first row; give such a test a `rowCount`
  expectation rather than trusting idleness alone.

Both are tracked on the grid side; a release of this package that can read
them will say so here.

## Licence

Same licence as Lattice Grid; see [LICENSE](LICENSE).
