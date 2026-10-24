/** A sort direction as the grid states it in aria-sort. */
export type SortDirection = 'ascending' | 'descending' | 'none';

/** A cell by column field and zero-based view position. */
export interface CellRef {
  column: string;
  row: number;
}

/** Options for waitForIdle. */
export interface IdleOptions {
  /** Give-up time in ms. Default 10000. */
  timeout?: number;
  /** Animation frames in a row with no DOM change and no busy signal. Default 2. */
  quietFrames?: number;
}

/** Quotes a value for a CSS attribute selector. */
export function quote(value: string | number): string;

/** CSS selectors for the grid's public DOM contract. */
export const selectors: {
  readonly grid: string;
  header(column: string): string;
  filterButton(column: string): string;
  readonly dialog: string;
  readonly dialogInput: string;
  readonly rows: string;
  row(rowIndex: number): string;
  rowByKey(key: string | number): string;
  cell(column: string, rowIndex: number): string;
  readonly editor: string;
};

/** The viewers the helpers know. */
export type ViewerKind = 'list' | 'dataView' | 'kanban' | 'gantt' | 'calendar';

/** How a viewer's root and items are found. */
export interface ViewerSelectors {
  ready: string;
  root: string;
  item: string;
  key: string;
  lane?: string;
  laneKey?: string;
  day?: string;
  dayKey?: string;
}

export const viewerSelectors: Readonly<Record<ViewerKind, ViewerSelectors>>;

/** The selector for one viewer item by key. */
export function itemSelector(kind: ViewerKind, key: string | number): string;

/** The page-side reader every binding runs: self-contained, serialisable. */
export function inPage(el: Element, call: { op: string; args?: unknown[] }): unknown;

/** The grid surface over a live DOM element (for a test running in the page). */
export interface DomGrid {
  readonly root: Element;
  element(): Element;
  header(column: string): Element;
  row(rowIndex: number): Element;
  cell(column: string, rowIndex: number): Element;
  rowCount(): number;
  readCell(column: string, rowIndex: number): string;
  readRow(rowIndex: number): Record<string, string>;
  sortState(column: string): SortDirection;
  scrollToRow(rowIndex: number, options?: { timeout?: number }): Promise<boolean>;
  isIdle(): boolean;
  waitForIdle(options?: IdleOptions): Promise<true>;
}

/** A viewer surface over a live DOM element. */
export interface DomViewer {
  readonly root: Element;
  item(key: string | number): Element;
  items(): Element[];
  itemKeys(): string[];
  itemCount(): number;
  waitForIdle(options?: IdleOptions): Promise<true>;
}

export interface DomKanban extends DomViewer {
  lane(id: string): Element;
}

export interface DomCalendar extends DomViewer {
  day(iso: string): Element;
}

export function grid(root: Element): DomGrid;
export function list(root: Element): DomViewer;
export function dataView(root: Element): DomViewer;
export function kanban(root: Element): DomKanban;
export function gantt(root: Element): DomViewer;
export function calendar(root: Element): DomCalendar;
