import { test, expect } from '@playwright/test';
import { start, step, predict, adjust, answer, reflection, finish, selectTask, storage, report, editor, chart } from './helpers.js';
const scenarios = {
  choose: [[2, 'scatter-relationship', [['kind', 'scatter']], ['b'], ['a', 'c']], [3, 'histogram-distribution', [['histogram-count', '6']], ['a'], ['b', 'd']], [4, 'boxplot-groups', [['grouped', true]], ['c'], ['a', 'b', 'd']]],
  color: [[1, 'categorical-colors', [['color-schemeType', 'categorical'], ['color-field', 'surface']], ['a'], ['b', 'c']], [2, 'sequential-colors', [['color-schemeType', 'sequential']], ['b'], ['a', 'd']], [3, 'diverging-reference', [['color-schemeType', 'diverging']], ['c'], ['a', 'b']]],
  misleading: [[1, 'perspective-3d', [['presentation', '2d']], ['b'], ['a', 'c']], [2, 'binning-context', [['histogram-count', '6']], ['c'], ['b', 'd']], [3, 'time-window', [['windowMode', 'recent']], ['a'], ['a', 'c']], [4, 'dual-axis', [['presentation', 'small-multiples']], ['b'], ['a', 'c', 'd']]],
  redesign: [[1, 'redesign-distribution', [['kind', 'histogram']], ['b'], ['a', 'c']], [2, 'redesign-time-context', [['presentation', 'indexed']], ['c'], ['a', 'b', 'd']]]
};
test.beforeEach(async ({
  page
}) => {
  await page.goto('./');
  await start(page);
});
for (const [lab, items] of Object.entries(scenarios)) test(`new ${lab} activities preserve the complete learning flow`, async ({
  page
}, testInfo) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const [index, id, changes, single, multiple] of items) {
    await selectTask(page, lab, index);
    await expect(page.locator('.step-nav [data-step="experiment"]')).toBeDisabled();
    await predict(page);
    await page.locator('#record-experiment').click();
    await expect(page.locator('#experiments-list')).toContainText('✓');
    await adjust(page, 'labels', false);
    await page.locator('#record-experiment').click();
    await expect(page.locator('.step-nav [data-step="explain"]')).toBeDisabled();
    for (const [control, value] of changes) await adjust(page, control, value);
    await expect(page.locator('#chart svg')).toBeVisible();
    await page.locator('#record-experiment').click();
    await answer(page, `${id}-reason`, single);
    await answer(page, `${id}-principles`, multiple);
    await reflection(page, 'อธิบายจากกราฟเปรียบเทียบและข้อมูลจำลอง โดยไม่สรุปเกินขอบเขตที่วัด');
    await finish(page);
    await page.locator('#completed-review > summary').click();
    await expect(page.locator('#chart-source')).toHaveValue('completion');
    await expect(page.locator('#completed-review')).toContainText('ยังไม่ได้ประเมินเหตุผล');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.locator('.preview').screenshot({
    path: `artifacts/${testInfo.project.name}-${lab}-research.png`
  });
  expect(errors).toEqual([]);
});
test('Free research editing pages, missing data, invalid bins and grayscale remain independent', async ({
  page
}) => {
  await start(page, 'free');
  await page.locator('#dataset-select').selectOption('soil');
  await editor(page);
  await expect(page.locator('[data-record]')).toHaveCount(40);
  await page.locator('[data-record="0"][data-field="minutes"]').fill('11');
  await page.locator('[data-editor-page="1"]').click();
  await page.locator('[data-record="20"][data-field="minutes"]').fill('');
  await page.locator('[data-editor-page="0"]').click();
  await expect(page.locator('[data-record="0"][data-field="minutes"]')).toHaveValue('11');
  await page.locator('#research-data-form button[type="submit"]').click();
  await chart(page);
  await expect(page.locator('#axis-range')).toContainText('ขาดข้อมูลที่จำเป็น 1');
  await adjust(page, 'histogram-mode', 'edges');
  await adjust(page, 'histogram-edges', '0,5,10,25');
  await expect(page.locator('#axis-range')).toContainText('ความสูง = ความถี่ / ความกว้าง');
  await page.locator('#chart [data-bin="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspection')).toContainText('รายการ');
  await adjust(page, 'histogram-edges', '0,5,5');
  await expect(page.locator('#chart')).toContainText('ขอบ bin');
  await adjust(page, 'histogram-edges', '0,5,10,25');
  await expect(page.locator('#chart svg')).toBeVisible();
  await page.locator('#dataset-select').selectOption('environment');
  await adjust(page, 'color-schemeType', 'sequential');
  await adjust(page, 'grayscale', true);
  await expect(page.locator('#legend')).toContainText('ขาวดำ');
  await expect(page.locator('[data-question-form]')).toHaveCount(0);
  await start(page);
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
});
test('V1 browser migration and V2 reload preserve old and new completed evidence', async ({
  page
}) => {
  await page.evaluate(async () => {
    const old = await (await fetch('./tests/fixtures/progress-v1.json')).json();
    const {
      openDatabase,
      writeDatabase,
      storageNames
    } = await import('./src/storage/database.js');
    const names = storageNames(new URL('./', location.href).pathname),
      db = await openDatabase(names.database);
    await writeDatabase(db, old, 0);
    db.close();
    localStorage.setItem(names.preference, 'true');
  });
  await page.reload();
  await start(page);
  await expect(page.locator('#storage-status')).toContainText('กู้คืน');
  await expect(page.locator('#completion-text')).toContainText('พื้นฐาน 4/10 ข้อ · เพิ่มเติม 0/24 ข้อ');
  await page.locator('#task-select').selectOption('4');
  await predict(page);
  await page.locator('#record-experiment').click();
  await adjust(page, 'grouped', true);
  await page.locator('#record-experiment').click();
  await answer(page, 'boxplot-groups-reason', ['c']);
  await answer(page, 'boxplot-groups-principles', ['a', 'b', 'd']);
  await reflection(page, 'มัธยฐาน IQR และค่านอกเกณฑ์แสดงคนละด้านของการกระจาย');
  await finish(page);
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();
  await start(page);
  await page.locator('#completed-review > summary').click();
  await expect(page.locator('#completed-review')).toContainText('มัธยฐาน IQR');
  await expect(page.locator('#completion-text')).toContainText('พื้นฐาน 4/10 ข้อ · เพิ่มเติม 2/24 ข้อ');
});
test('expanded PDF exports all chart semantics or scoped evidence entirely on the client', async ({
  page
}, testInfo) => {
  test.setTimeout(120000);
  const errors = [],
    external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    if (!r.url().startsWith('http://127.0.0.1:4174/') && !r.url().startsWith('blob:')) external.push(r.url());
  });
  await page.evaluate(async () => {
    const {
      createState
    } = await import('./src/state.js');
    const {
      labs
    } = await import('./src/content/labs.js');
    const {
      prepareTask
    } = await import('./tests/helpers/learning.js');
    const {
      serializeProgress
    } = await import('./src/storage/schema.js');
    const {
      openDatabase,
      writeDatabase,
      storageNames
    } = await import('./src/storage/database.js');
    const state = createState();
    for (const lab of labs) for (const task of lab.tasks) prepareTask(state, lab.id, task.id);
    const names = storageNames(new URL('./', location.href).pathname),
      db = await openDatabase(names.database);
    await writeDatabase(db, serializeProgress(state), 0);
    db.close();
    localStorage.setItem(names.preference, 'true');
  });
  await page.reload();
  await start(page);
  await expect(page.locator('#progress')).toHaveAttribute('value', '34');
  await report(page);
  await page.locator('#report-scope').selectOption('choose');
  await page.locator('#preview-report').click();
  await expect(page.locator('#report-preview details')).toHaveCount(5);
  await page.locator('#generate-pdf').click();
  await expect(page.locator('#pdf-actions')).toBeVisible({
    timeout: 60000
  });
  const downloaded = page.waitForEvent('download');
  await page.locator('#download-pdf').click();
  await (await downloaded).saveAs(`artifacts/${testInfo.project.name}-research-report.pdf`);
  await expect(page.locator('#progress')).toHaveAttribute('value', '34');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('hidden invalid controls do not corrupt saved comparisons and derived values update after applying edits', async ({
  page
}) => {
  test.setTimeout(60000);
  await page.locator('#task-select').selectOption('3');
  await predict(page);
  await adjust(page, 'histogram-count', '');
  await expect(page.locator('#chart')).toContainText('จำนวน bin');
  await adjust(page, 'histogram-mode', 'width');
  await page.locator('#record-experiment').click();
  await adjust(page, 'histogram-width', '3');
  await page.locator('#record-experiment').click();
  await answer(page, 'histogram-distribution-reason', ['a']);
  await answer(page, 'histogram-distribution-principles', ['b', 'd']);
  await reflection(page, 'ตรวจข้อมูลดิบและวิธีแบ่งช่วงร่วมกัน');
  await finish(page);
  await storage(page);
  await page.locator('#enable-storage').click();
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();
  await start(page);
  await page.locator('#completed-review > summary').click();
  await expect(page.locator('#completed-review')).toContainText('ตรวจข้อมูลดิบ');
  await expect(page.locator('#accept-recovery')).toHaveCount(0);
  await start(page, 'free');
  await page.locator('#dataset-select').selectOption('environment');
  await editor(page);
  const derived = page.locator('[data-record="0"][data-field="difference"]');
  await expect(derived).toHaveAttribute('readonly', '');
  await page.locator('[data-record="0"][data-field="temperature"]').fill('35');
  await page.locator('#research-data-form button[type="submit"]').click();
  await expect(derived).toHaveValue('5');
  await start(page);
  await expect(page.locator('#progress')).toHaveAttribute('value', '2');
});
