// Viewer contract under the Cypress binding: each viewer's root and items.
import { list, dataView, kanban, gantt, calendar } from '../../../dist/cypress/index.js';

describe('viewers', () => {
  beforeEach(() => {
    cy.visit('/test/fixtures/viewers.html');
  });

  it('list: items by key', () => {
    const v = list('#list');
    v.waitForIdle();
    v.itemKeys().should('deep.equal', ['a', 'b', 'c']);
    v.item('b').should('have.text', 'Bo');
  });

  it('data view: cards by key', () => {
    const v = dataView('#dataview');
    v.waitForIdle();
    v.itemCount().should('equal', 3);
    v.item('c').should('have.text', 'Cy');
  });

  it('kanban: cards by key and lanes by column id', () => {
    const v = kanban('#kanban');
    v.waitForIdle();
    v.itemCount().should('equal', 4);
    v.lane('todo').find('[role="listitem"]').should('have.length', 2);
    v.item('3').should('have.attr', 'data-column', 'done');
  });

  it('gantt: task bars by task id', () => {
    const v = gantt('#gantt');
    v.waitForIdle();
    v.itemKeys().should('deep.equal', ['t1', 't2']);
    v.item('t2').should('have.attr', 'aria-label').and('match', /Build/);
  });

  it('calendar: events by key and days by date', () => {
    const v = calendar('#calendar');
    v.waitForIdle();
    v.itemCount().should('equal', 2);
    v.item('e1').should('contain.text', 'Kick-off');
    v.day('2026-03-18').find('[data-key="e2"]').should('have.length', 1);
  });
});
