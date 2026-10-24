// Viewer contract under the Playwright binding: each viewer's root and items.
import { test, expect } from '@playwright/test';
import { list, dataView, kanban, gantt, calendar } from '../../dist/playwright/index.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/fixtures/viewers.html');
});

test('list: items by key', async ({ page }) => {
  const v = list(page.locator('#list'));
  await v.waitForIdle();
  expect(await v.itemKeys()).toEqual(['a', 'b', 'c']);
  await expect(v.item('b')).toHaveText('Bo');
});

test('data view: cards by key', async ({ page }) => {
  const v = dataView(page.locator('#dataview'));
  await v.waitForIdle();
  expect(await v.itemCount()).toBe(3);
  await expect(v.item('c')).toHaveText('Cy');
});

test('kanban: cards by key and lanes by column id', async ({ page }) => {
  const v = kanban(page.locator('#kanban'));
  await v.waitForIdle();
  expect(await v.itemCount()).toBe(4);
  await expect(v.lane('todo').locator('[role="listitem"]')).toHaveCount(2);
  await expect(v.item('3')).toHaveAttribute('data-column', 'done');
});

test('gantt: task bars by task id', async ({ page }) => {
  const v = gantt(page.locator('#gantt'));
  await v.waitForIdle();
  expect(await v.itemKeys()).toEqual(['t1', 't2']);
  await expect(v.item('t2')).toHaveAttribute('aria-label', /Build/);
});

test('calendar: events by key and days by date', async ({ page }) => {
  const v = calendar(page.locator('#calendar'));
  await v.waitForIdle();
  expect(await v.itemCount()).toBe(2);
  await expect(v.item('e1')).toContainText('Kick-off');
  await expect(v.day('2026-03-18').locator('[data-key="e2"]')).toHaveCount(1);
});
