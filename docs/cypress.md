# Worked example: Cypress

From nothing to a passing end-to-end test of the grid in your app.

## 1. Install (one command)

```sh
npm install --save-dev @toclocoinc/lattice-grid-testing
```

You need `cypress` too; if your project does not have it yet:
`npm install --save-dev cypress`, then `npx cypress open` once to create
`cypress.config.js`.

## 2. Tell the test where your grid is

Three facts about your app, nothing else: the page the grid is on, a CSS
selector for the element you passed to `createGrid`, and the `field` of one
text column. The grid needs no option set for the helpers to work.

## 3. Write the test

Save as `cypress/e2e/grid.cy.js`, change the three constants, run
`npx cypress run --browser chrome --spec cypress/e2e/grid.cy.js`.

```js
import { grid } from '@toclocoinc/lattice-grid-testing/cypress';

const PAGE = 'http://localhost:3000/orders'; // the page your grid is on
const GRID = '#orders-grid';                 // the element passed to createGrid
const COLUMN = 'city';                       // the field of a text column

it('the grid sorts, filters and reads back', () => {
  cy.visit(PAGE);
  const g = grid(GRID);
  g.waitForIdle();

  g.rowCount().should('be.greaterThan', 0).then((total) => {
    g.header(COLUMN).should('be.visible');

    g.sort(COLUMN);
    g.sortState(COLUMN).should('equal', 'ascending');

    g.readCell(COLUMN, 0).then((first) => {
      g.filter(COLUMN, first);
      g.rowCount().should('be.greaterThan', 0);
      g.readCell(COLUMN, 0).should('contain', first);
      g.header(COLUMN).should('have.attr', 'data-filtered', 'true');
    });

    g.filter(COLUMN, '');
    g.rowCount().should('equal', total);
  });
});
```

## 4. Going further

```js
g.readRow(41).then((row) => { /* { name: '…', city: '…', … } */ });
g.editCell('name', 2, 'Renamed');     // double click, type, Enter (the column must be editable)
g.selectRange({ column: 'name', row: 1 }, { column: 'qty', row: 3 }); // a real mouse drag
g.scrollToRow(150);                   // then g.row(150) / g.cell('qty', 150) are on screen
g.waitForIdle({ timeout: 20000 });    // after anything that loads data
```

Viewers:

```js
import { kanban, calendar } from '@toclocoinc/lattice-grid-testing/cypress';

kanban('#board').lane('done').find('[role="listitem"]').should('have.length', 3);
kanban('#board').item(42).should('have.attr', 'data-column', 'done');
calendar('#calendar').day('2026-03-18').find('[data-key="e2"]').should('have.length', 1);
```

Locators and readers are Cypress chains, so `.should(...)` retries on them
as usual. Gestures (sort, filter, editCell, selectRange) send real mouse and
keyboard input through the browser's DevTools Protocol rather than Cypress's
synthetic events, so the grid sees exactly what a user's input produces. That
needs a Chromium-family browser: Chrome, Edge or Cypress's bundled Electron.
