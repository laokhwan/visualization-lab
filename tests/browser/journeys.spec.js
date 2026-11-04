import { test, expect } from '@playwright/test';
import { start, step, predict, adjust, answer, reflection, finish, unlock, selectTask, editor, chart } from './helpers.js';
test.beforeEach(async ({
  page
}) => {
  await page.goto('./');
  await start(page);
});
test('prediction, comparison gate and wrong-wrong-correct retries count only submissions', async ({
  page
}) => {
  await expect(page.locator('.step-nav [data-step="experiment"]')).toBeDisabled();
  await expect(page.locator('.step-nav [data-step="explain"]')).toBeDisabled();
  await page.locator('#save-prediction').click();
  await expect(page.locator('#prediction-message')).toContainText('ก่อนทดลอง');
  await predict(page);
  await page.locator('#record-experiment').click();
  await adjust(page, 'labels', false);
  await page.locator('#record-experiment').click();
  await expect(page.locator('#experiment-message')).toContainText('บันทึกรูปแบบนี้แล้ว');
  await expect(page.locator('.step-nav [data-step="explain"]')).toBeDisabled();
  await adjust(page, 'kind', 'bar');
  await page.locator('#record-experiment').click();
  await step(page, 'explain');
  const q = page.locator('#question-compare-reason');
  await q.getByRole('button', {
    name: 'ส่งคำตอบ',
    exact: true
  }).click();
  await expect(q.locator('.form-message')).toContainText('เลือกคำตอบ');
  await q.locator('input[value="d"]').check();
  await q.locator('input[value="a"]').check();
  await expect(q.locator('.question-mastery')).toContainText('ส่งแล้ว 0 ครั้ง');
  await q.getByRole('button', {
    name: 'ส่งคำตอบ',
    exact: true
  }).click();
  await expect(q.locator('.answer-feedback')).toContainText('ลองทบทวน');
  await expect(q.locator('.answer-feedback')).not.toContainText('เหตุผลของแต่ละตัวเลือก');
  await expect(q.getByRole('button', {
    name: 'ส่งคำตอบ',
    exact: true
  })).toHaveCount(0);
  await q.getByRole('button', {
    name: 'ลองอีกครั้ง',
    exact: true
  }).click();
  await q.getByRole('button', {
    name: 'ส่งคำตอบ',
    exact: true
  }).click();
  await q.getByRole('button', {
    name: 'ลองอีกครั้ง',
    exact: true
  }).click();
  await answer(page, 'compare-reason', ['b']);
  await expect(q.locator('.question-mastery')).toContainText('ส่งแล้ว 3 ครั้ง · ตอบผิด 2 ครั้ง');
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
  await q.getByRole('button', {
    name: 'ฝึกซ้ำ',
    exact: true
  }).click();
  await answer(page, 'compare-reason', ['a']);
  await expect(q.locator('.question-mastery')).toContainText('เคยตอบถูกแล้ว');
  await expect(q.locator('.question-mastery')).toContainText('ส่งแล้ว 4 ครั้ง · ตอบผิด 3 ครั้ง');
});
test('multiple-select gives hints without revealing missing or correct subsets', async ({
  page
}) => {
  await unlock(page);
  await answer(page, 'compare-alternatives', ['a', 'c']);
  const q = page.locator('#question-compare-alternatives');
  await expect(q.locator('.answer-feedback')).toContainText('ลองทบทวน');
  await expect(q.locator('.answer-feedback')).not.toContainText('ตำแหน่งจุดบนแกนร่วมช่วยเปรียบเทียบ');
  await q.getByRole('button', {
    name: 'ลองอีกครั้ง'
  }).click();
  await q.locator('input[value="c"]').uncheck();
  await answer(page, 'compare-alternatives', ['b']);
  await expect(q.locator('.question-mastery')).toContainText('ส่งแล้ว 2 ครั้ง · ตอบผิด 1 ครั้ง');
  await expect(q.locator('.answer-feedback')).toContainText('เหตุผลของแต่ละตัวเลือก');
});
test('all four labs, ten foundation questions and five tasks complete and review', async ({
  page
}) => {
  test.setTimeout(120000);
  const scenarios = [['choose', 0, 'pie', [['kind', 'bar']], [['compare-reason', ['b']], ['compare-alternatives', ['a', 'b']]]], ['choose', 1, 'bar', [['kind', 'line']], [['time-design', ['a']], ['time-interpretation', ['a', 'b']]]], ['color', 0, 'uniform', [['palette', 'highlight']], [['color-focus', ['c']], ['color-meaning', ['a', 'b', 'c']]]], ['misleading', 0, 'same', [['baseline', '0']], [['axis-perception', ['d']], ['axis-principles', ['a', 'b']]]], ['redesign', 0, '', [['baseline', '0'], ['palette', 'uniform']], [['redesign-choice', ['b']], ['redesign-principles', ['a', 'b', 'c']]]]];
  for (const [lab, index, pred, changes, answers] of scenarios) {
    await selectTask(page, lab, index);
    await predict(page, pred);
    await page.locator('#record-experiment').click();
    for (const [id, value] of changes) await adjust(page, id, value);
    await page.locator('#record-experiment').click();
    for (const [id, values] of answers) await answer(page, id, values);
    await step(page, 'feedback');
    await expect(page.locator('#completion-feedback')).toContainText('ยังทำกิจกรรมไม่ครบ');
    await reflection(page, `สะท้อนคิดสถานการณ์ ${lab}`);
    await finish(page);
  }
  await expect(page.locator('#progress')).toHaveAttribute('value', '10');
  await expect(page.locator('#completion-text')).toContainText('5 / 17 สถานการณ์');
  await page.locator('#show-summary').click();
  await expect(page.locator('.summary-metrics')).toContainText('10 / 34');
  await expect(page.locator('.summary-lab')).toHaveCount(4);
  await page.locator('.summary-lab[data-lab-id="choose"] .dashboard-foundation > summary').click();
  await page.locator('.summary-lab[data-lab-id="choose"] [data-review-task="compare"]').click();
  await expect(page.locator('#chart-source')).toHaveValue('completion');
  await page.locator('#completed-review > summary').click();
  await expect(page.locator('#completed-review')).toContainText('สะท้อนคิดสถานการณ์ choose');
  await step(page, 'experiment');
  await page.locator('#chart-source').selectOption('current');
  await adjust(page, 'kind', 'line');
  await step(page, 'feedback');
  await page.locator('#complete-task').click();
  await expect(page.locator('#completion-feedback')).toContainText('ผลที่เคยทำครบและหลักฐานเดิมยังคงอยู่');
  await step(page, 'experiment');
  await page.locator('#chart-source').selectOption('current');
  await page.locator('#reset-chart').click();
  await expect(page.locator('#kind')).toHaveValue('pie');
  await expect(page.locator('#progress')).toHaveAttribute('value', '10');
});
test('session reset confirmation and mode isolation preserve free exploration', async ({
  page
}) => {
  await unlock(page);
  await answer(page, 'compare-reason', ['b']);
  await reflection(page, 'บันทึกข้อความเดิม');
  await start(page, 'free');
  await editor(page);
  await page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  }).fill('10');
  await page.getByRole('button', {
    name: 'นำข้อมูลไปใช้',
    exact: true
  }).click();
  await start(page);
  await expect(page.locator('#reflection')).toHaveValue('บันทึกข้อความเดิม');
  await page.locator('#guided-progress > summary').click();
  page.once('dialog', d => d.dismiss());
  await page.locator('#reset-guided').click();
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
  page.once('dialog', d => d.accept());
  await page.locator('#reset-guided').click();
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
  await expect(page.locator('#prediction')).toHaveValue('');
  await start(page, 'free');
  await editor(page);
  await expect(page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  })).toHaveValue('10');
});
test('free data validation, axes, inspection and pie controls', async ({
  page
}) => {
  await start(page, 'free');
  await adjust(page, 'baseline', '70');
  await expect(page.locator('#chart')).toContainText('ยังไม่สามารถแสดงกราฟ');
  await page.locator('#fit-axis').click();
  await expect(page.locator('#baseline')).toHaveValue('0');
  await page.locator('#chart [data-point="2"]').click();
  await expect(page.locator('#inspection')).toContainText('ห้อง C');
  await editor(page);
  await page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  }).fill('');
  await page.getByRole('button', {
    name: 'นำข้อมูลไปใช้',
    exact: true
  }).click();
  await expect(page.locator('#data-errors')).toContainText('ค่าข้อมูลต้องเป็นตัวเลข');
  await page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  }).fill('10');
  await page.locator('#edit-title').fill('ข้อมูลทดลองใหม่');
  await page.getByRole('button', {
    name: 'นำข้อมูลไปใช้',
    exact: true
  }).click();
  await chart(page);
  await expect(page.locator('#chart-title')).toHaveText('ข้อมูลทดลองใหม่');
  await adjust(page, 'kind', 'pie');
  await expect(page.locator('#chart .pie-label').first()).toBeVisible();
  await adjust(page, 'labels', false);
  await expect(page.locator('#chart .pie-label')).toHaveCount(0);
  await expect(page.locator('#legend')).toContainText('ห้อง A');
  await editor(page);
  await page.locator('#add-row').click();
  await page.getByLabel('ชื่อข้อมูล แถว 5', {
    exact: true
  }).fill('ห้อง E');
  await page.getByRole('button', {
    name: 'นำข้อมูลไปใช้',
    exact: true
  }).click();
  await chart(page);
  await expect(page.locator('#legend')).toContainText('ห้อง E');
});
test('numeric data supports inspection and rejects invalid edits', async ({
  page
}) => {
  await start(page, 'free');
  await page.locator('#dataset-select').selectOption('relationship');
  await adjust(page, 'kind', 'dot');
  await page.locator('#chart [data-point="2"]').click();
  await expect(page.locator('#inspection')).toContainText('ชั่วโมงทบทวน 3');
  await page.locator('#chart [data-point="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspection')).toContainText('ชั่วโมงทบทวน 2');
  await editor(page);
  await page.getByLabel('ค่าแกนนอน แถว 1', {
    exact: true
  }).fill('');
  await page.getByRole('button', {
    name: 'นำข้อมูลไปใช้',
    exact: true
  }).click();
  await expect(page.locator('#data-errors')).toContainText('ค่าของแกนนอนต้องเป็นตัวเลข');
  await page.getByLabel('ค่าแกนนอน แถว 1', {
    exact: true
  }).fill('0.5');
  await page.getByLabel('ค่าข้อมูล แถว 1', {
    exact: true
  }).fill('-10');
  await page.getByRole('button', {
    name: 'นำข้อมูลไปใช้',
    exact: true
  }).click();
  await chart(page);
  await adjust(page, 'kind', 'pie');
  await expect(page.locator('#chart')).toContainText('กราฟวงกลมต้องใช้ค่าที่ไม่ติดลบ');
  await adjust(page, 'kind', 'bar');
  await expect(page.locator('#chart svg')).toBeVisible();
});
test('responsive question controls, keyboard, summary and session-only privacy', async ({
  page,
  baseURL
}, testInfo) => {
  const errors = [],
    external = [],
    failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    if (!r.url().startsWith(new URL(baseURL).origin)) external.push(r.url());
  });
  page.on('response', r => {
    if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) failed.push(r.url());
  });
  await unlock(page);
  const q = page.locator('#question-compare-reason');
  await q.locator('input[value="b"]').focus();
  await page.keyboard.press('Space');
  await q.getByRole('button', {
    name: 'ส่งคำตอบ',
    exact: true
  }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#compare-reason-feedback')).toBeFocused();
  expect(await q.locator('.answer-option').evaluateAll(es => Math.min(...es.map(e => e.getBoundingClientRect().height)))).toBeGreaterThanOrEqual(44);
  await q.screenshot({
    path: `artifacts/${testInfo.project.name}-practice.png`
  });
  await page.locator('#show-summary').click();
  await expect(page.locator('.summary-metrics')).toContainText('1 / 34');
  await page.locator('#stage').screenshot({
    path: `artifacts/${testInfo.project.name}-summary.png`
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
  await page.reload();
  await expect(page.locator('#landing')).toBeVisible();
  await start(page);
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
  await expect(page.locator('#prediction')).toHaveValue('');
  const duplicates = await page.locator('[id]').evaluateAll(es => {
    const ids = es.map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicates).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
});
