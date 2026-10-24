/// <reference types="cypress" />
import type { CellRef, IdleOptions, SortDirection } from '../core/index.js';

export type { CellRef, IdleOptions, SortDirection } from '../core/index.js';

type Subject = Cypress.Chainable<JQuery<HTMLElement>>;

/** The grid surface for a Cypress test. */
export interface CypressGrid {
  readonly root: string;
  /** The role="grid" element. */
  element(): Subject;
  header(column: string): Subject;
  /** A rendered data row; call scrollToRow first for a row off screen. */
  row(rowIndex: number): Subject;
  /** A rendered cell; call scrollToRow first for a row off screen. */
  cell(column: string, rowIndex: number): Subject;
  rowCount(): Cypress.Chainable<number>;
  scrollToRow(rowIndex: number): Subject;
  readCell(column: string, rowIndex: number): Cypress.Chainable<string>;
  readRow(rowIndex: number): Cypress.Chainable<Record<string, string>>;
  sortState(column: string): Cypress.Chainable<SortDirection>;
  sort(column: string, direction?: SortDirection): Subject;
  filter(column: string, value: string): Subject;
  selectRange(from: CellRef, to: CellRef): Subject;
  editCell(column: string, rowIndex: number, value: unknown): Subject;
  isIdle(): Cypress.Chainable<boolean>;
  waitForIdle(options?: IdleOptions): Cypress.Chainable<true>;
}

export interface CypressViewer {
  readonly root: string;
  item(key: string | number): Subject;
  items(): Subject;
  itemKeys(): Cypress.Chainable<string[]>;
  itemCount(): Cypress.Chainable<number>;
  waitForIdle(options?: IdleOptions): Cypress.Chainable<true>;
}

export interface CypressKanban extends CypressViewer {
  lane(id: string): Subject;
}

export interface CypressCalendar extends CypressViewer {
  day(iso: string): Subject;
}

export function grid(root: string): CypressGrid;
export function list(root: string): CypressViewer;
export function dataView(root: string): CypressViewer;
export function kanban(root: string): CypressKanban;
export function gantt(root: string): CypressViewer;
export function calendar(root: string): CypressCalendar;
