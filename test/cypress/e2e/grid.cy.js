// Grid contract under the Cypress binding: the same cases as the Playwright
// suite, through the same helper calls.
import { grid } from '../../../dist/cypress/index.js';

describe('grid', () => {
  beforeEach(() => {
    cy.visit('/test/fixtures/grid.html');
  });

  it('locates headings, rows and cells, and counts every row', () => {
    const g = grid('#grid');
    g.waitForIdle();
    g.header('city').should('contain.text', 'City');
    g.rowCount().should('equal', 200);
    g.cell('name', 0).should('have.text', 'Item 001');
    g.readRow(1).should('deep.equal', { name: 'Item 002', city: 'Osaka', qty: '37' });
  });

  it('reads a row far below the rendered window', () => {
    const g = grid('#grid');
    g.waitForIdle();
    g.readCell('name', 180).should('equal', 'Item 181');
    g.row(180).should('be.visible');
  });

  it('sorts a column ascending, then descending, then back to none', () => {
    const g = grid('#grid');
    g.sort('city');
    g.sortState('city').should('equal', 'ascending');
    g.readCell('city', 0).should('equal', 'Accra');
    g.sort('city', 'descending');
    g.readCell('city', 0).should('equal', 'Tallinn');
    g.sort('city', 'none');
    g.readCell('name', 0).should('equal', 'Item 001');
  });

  it('filters a column through its heading filter, and clears it', () => {
    const g = grid('#grid');
    g.filter('city', 'Osaka');
    g.rowCount().should('equal', 34);
    g.readCell('city', 0).should('equal', 'Osaka');
    g.header('city').should('have.attr', 'data-filtered', 'true');
    g.filter('city', '');
    g.rowCount().should('equal', 200);
  });

  it('selects a range by dragging from one cell to another', () => {
    const g = grid('#grid');
    g.selectRange({ column: 'name', row: 1 }, { column: 'qty', row: 3 });
    // The grid marks a range with class names only, so the test reads it back
    // through the grid's public JS API rather than the DOM (see the README).
    cy.window().then((win) => {
      const cells = win.grid.selection.cells();
      expect(cells).to.have.length(9);
      expect(cells).to.deep.include({ key: '2', colId: 'name' });
      expect(cells).to.deep.include({ key: '4', colId: 'qty' });
    });
  });

  it('edits a cell and the new value is drawn', () => {
    const g = grid('#grid');
    g.editCell('name', 2, 'Renamed row');
    g.readCell('name', 2).should('equal', 'Renamed row');
    g.readCell('name', 3).should('equal', 'Item 004');
  });

  it('waitForIdle settles after a data change, and fails on a grid that never settles', () => {
    const g = grid('#grid');
    cy.window().then((win) => win.grid.rows.load([{ id: 1, name: 'Only', city: 'Quito', qty: 1 }]));
    g.waitForIdle();
    g.rowCount().should('equal', 1);
    g.isIdle().should('equal', true);
    cy.get('#grid [role="grid"]').then(($g) => $g.attr('aria-busy', 'true'));
    cy.on('fail', (err) => {
      if (!/aria-busy/.test(err.message)) throw err;
    });
    g.waitForIdle({ timeout: 300 }).then(() => {
      throw new Error('waitForIdle resolved on a busy grid');
    });
  });
});
