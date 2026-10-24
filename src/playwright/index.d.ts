import type { Locator, Page } from '@playwright/test';
import type { CellRef, IdleOptions, SortDirection } from '../core/index.js';

export type { CellRef, IdleOptions, SortDirection } from '../core/index.js';

/** The grid surface for a Playwright test. */
export interface PlaywrightGrid {
  readonly root: Locator;
  /** The role="grid" element. */
  element(): Locator;
  header(column: string): Locator;
  /** A rendered data row; call scrollToRow first for a row off screen. */
  row(rowIndex: number): Locator;
  /** A rendered cell; call scrollToRow first for a row off screen. */
  cell(column: string, rowIndex: number): Locator;
  rowCount(): Promise<number>;
  scrollToRow(rowIndex: number): Promise<void>;
  readCell(column: string, rowIndex: number): Promise<string>;
  readRow(rowIndex: number): Promise<Record<string, string>>;
  sortState(column: string): Promise<SortDirection>;
  sort(column: string, direction?: SortDirection): Promise<void>;
  filter(column: string, value: string): Promise<void>;
  selectRange(from: CellRef, to: CellRef): Promise<void>;
  editCell(column: string, rowIndex: number, value: unknown): Promise<void>;
  isIdle(): Promise<boolean>;
  waitForIdle(options?: IdleOptions): Promise<true>;
}

export interface PlaywrightViewer {
  readonly root: Locator;
  item(key: string | number): Locator;
  items(): Locator;
  itemKeys(): Promise<string[]>;
  itemCount(): Promise<number>;
  waitForIdle(options?: IdleOptions): Promise<true>;
}

export interface PlaywrightKanban extends PlaywrightViewer {
  lane(id: string): Locator;
}

export interface PlaywrightCalendar extends PlaywrightViewer {
  day(iso: string): Locator;
}

export function grid(root: Locator | Page): PlaywrightGrid;
export function list(root: Locator): PlaywrightViewer;
export function dataView(root: Locator): PlaywrightViewer;
export function kanban(root: Locator): PlaywrightKanban;
export function gantt(root: Locator): PlaywrightViewer;
export function calendar(root: Locator): PlaywrightCalendar;
