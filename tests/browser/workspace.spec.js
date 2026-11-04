import { test, expect } from '@playwright/test';
import { start, step, predict, adjust, unlock, answer, reflection, finish, storage, editor, chart } from './helpers.js';
test.beforeEach(async ({
  page
}) => {
  await page.goto('./');
});
test('landing is separate and a normal experiment keeps chart, key control and action together', async ({
  page
}, testInfo) => {
  await expect(page.locator('#landing')).toBeVisible();
  await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.locator('[data-start-lab]')).toHaveCount(4);
  await start(page);
  await expect(page.locator('#landing')).toBeHidden();
  await page.locator('#task-select').selectOption('3');
  await predict(page);
  const boxes = await page.evaluate(() => {
    const r = s => {
      const a = document.querySelector(s).getBoundingClientRect();
      return {
        top: a.top,
        bottom: a.bottom,
        width: a.width,
        left: a.left
      };
    };
    return {
      width: innerWidth,
      height: innerHeight,
      chart: r('#chart'),
      control: r('#histogram-count'),
      action: r('#record-experiment'),
      board: r('.learning-board'),
      page: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  });
  expect(boxes.overflow).toBe(false);
  expect(boxes.chart.width).toBeGreaterThan(250);
  if (boxes.width >= 768) {
    expect(boxes.action.bottom).toBeLessThanOrEqual(boxes.height + 1);
    expect(boxes.control.top).toBeLessThan(boxes.chart.bottom + 170);
    expect(boxes.page).toBeLessThan(1450);
  }
  const primary = page.locator('#stage button.primary:visible');
  await expect(primary).toHaveCount(1);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-workspace.png`,
    fullPage: true
  });
});
test('revisiting steps, snapshots, modes and home retains answers and experimental state', async ({
  page
}) => {
  await start(page);
  await unlock(page);
  await answer(page, 'compare-reason', ['a']);
  await reflection(page, 'ข้อความร่างที่ต้องรักษา');
  await step(page, 'feedback');
  await page.locator('[data-explain-target="question"]').click();
  await expect(page.locator('#question-compare-reason')).toBeVisible();
  await step(page, 'experiment');
  await page.locator('#chart-source').selectOption('pie');
  await expect(page.locator('#kind')).toBeDisabled();
  await expect(page.locator('#chart .pie-label')).toHaveCount(4);
  await page.locator('[data-source="current"]').click();
  await expect(page.locator('#kind')).toHaveValue('bar');
  await adjust(page, 'labels', false);
  await step(page, 'predict');
  await expect(page.locator('#prediction')).toHaveValue('pie');
  await expect(page.locator('#prediction')).toBeDisabled();
  await start(page, 'free');
  await editor(page);
  await page.getByLabel('ชื่อข้อมูล แถว 1', {
    exact: true
  }).fill('ร่างที่ยังไม่นำไปใช้');
  await start(page);
  await step(page, 'explain');
  await page.locator('[data-question-index="2"]').click();
  await expect(page.locator('#reflection')).toHaveValue('ข้อความร่างที่ต้องรักษา');
  await page.locator('[data-question-index="0"]').click();
  await expect(page.locator('.question-mastery')).toContainText('ส่งแล้ว 1 ครั้ง · ตอบผิด 1 ครั้ง');
  await page.locator('#go-home').click();
  await expect(page.locator('#landing')).toBeVisible();
  await page.locator('#resume-learning').click();
  await expect(page.locator('.question-mastery')).toContainText('ส่งแล้ว 1 ครั้ง');
  await start(page, 'free');
  await editor(page);
  await expect(page.getByLabel('ชื่อข้อมูล แถว 1', {
    exact: true
  })).toHaveValue('ร่างที่ยังไม่นำไปใช้');
});
test('rotation and narrower layouts keep the active input, question and progress without nested vertical scrolling', async ({
  page
}) => {
  await start(page);
  await unlock(page);
  await answer(page, 'compare-reason', ['b']);
  await reflection(page, 'เหตุผลเดิม');
  const original = page.viewportSize();
  await page.setViewportSize({
    width: original.height,
    height: original.width
  });
  await expect(page.locator('#reflection')).toHaveValue('เหตุผลเดิม');
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
  await step(page, 'experiment');
  await adjust(page, 'labels', false);
  await page.locator('#labels').focus();
  await page.locator('#labels').press('Space');
  await expect(page.locator('#labels')).toBeFocused();
  const nested = await page.evaluate(() => [...document.querySelectorAll('#workspace *')].filter(e => {
    const s = getComputedStyle(e);
    return e.getBoundingClientRect().height > 0 && ['auto', 'scroll'].includes(s.overflowY) && e.scrollHeight > e.clientHeight + 4;
  }).map(e => e.id || e.className));
  expect(nested).toEqual([]);
});
test('step and question resume after opt-in while reload still starts at the landing page', async ({
  page
}) => {
  await start(page);
  await unlock(page);
  await page.locator('[data-question-index="1"]').click();
  await page.locator('input[value="a"]').check();
  await storage(page);
  await page.locator('#enable-storage').click();
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();
  await expect(page.locator('#landing')).toBeVisible();
  await page.locator('#resume-learning').click();
  await expect(page.locator('#question-compare-alternatives input[value="a"]')).toBeChecked();
  await expect(page.locator('.question-mastery')).toContainText('ส่งแล้ว 0 ครั้ง');
});
test('Free drafts require an explicit discard when changing datasets and remain independent of assessment', async ({
  page
}) => {
  await start(page, 'free');
  await editor(page);
  await page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  }).fill('99');
  page.once('dialog', d => d.dismiss());
  await page.locator('#dataset-select').selectOption('soil');
  await expect(page.locator('#dataset-select')).toHaveValue('groups');
  await expect(page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  })).toHaveValue('99');
  page.once('dialog', d => d.accept());
  await page.locator('#dataset-select').selectOption('soil');
  await expect(page.locator('#chart svg')).toBeVisible();
  await expect(page.locator('[data-question-form]')).toHaveCount(0);
  await start(page);
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
});
test('browser history and skip links preserve learning and do not change the active screen unexpectedly', async ({
  page
}) => {
  await start(page);
  await unlock(page);
  await answer(page, 'compare-reason', ['a']);
  await page.locator('#go-home').click();
  await expect(page.locator('#landing')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('.question-mastery')).toContainText('ส่งแล้ว 1 ครั้ง · ตอบผิด 1 ครั้ง');
  await page.goForward();
  await expect(page.locator('#landing')).toBeVisible();
  await page.locator('.skip-link').focus();
  await page.locator('.skip-link').press('Enter');
  await expect(page.locator('#page-title')).toBeFocused();
  await page.locator('#resume-learning').click();
  await page.locator('#show-summary').click();
  await page.locator('.skip-link').focus();
  await page.locator('.skip-link').press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
  await expect(page.locator('.summary-metrics')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.question-mastery')).toContainText('ส่งแล้ว 1 ครั้ง');
});
test('chart sources are retained per step and Free controls cannot alter Guided feedback', async ({
  page
}) => {
  test.setTimeout(90000);
  await start(page);
  await unlock(page);
  await step(page, 'experiment');
  await page.locator('#chart-source').selectOption('pie');
  await step(page, 'explain');
  await page.locator('#chart-source').selectOption('comparison');
  await step(page, 'experiment');
  await expect(page.locator('#chart-source')).toHaveValue('pie');
  await step(page, 'explain');
  await expect(page.locator('#chart-source')).toHaveValue('comparison');
  await answer(page, 'compare-reason', ['b']);
  await answer(page, 'compare-alternatives', ['a', 'b']);
  await reflection(page);
  await finish(page);
  const feedback = await page.locator('#completion-feedback').textContent();
  await start(page, 'free');
  await adjust(page, 'labels', false);
  await start(page);
  await expect(page.locator('#completion-feedback')).toHaveText(feedback);
  await expect(page.locator('#progress')).toHaveAttribute('value', '2');
});
