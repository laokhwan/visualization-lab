import { test, expect } from '@playwright/test';

async function seed(page, mode = 'normal') {
  await page.evaluate(async mode => {
    const { createState } = await import('./src/state.js');
    const { prepareTask } = await import('./tests/helpers/learning.js');
    const { serializeProgress } = await import('./src/storage/schema.js');
    const { openDatabase, writeDatabase, storageNames } = await import('./src/storage/database.js');
    const state = createState(); prepareTask(state); prepareTask(state, 'color', 'focus');
    const payload = serializeProgress(state);
    if (mode === 'corrupt') payload.tasks['choose/compare'].note = 5;
    if (mode === 'content') payload.assessmentManifest['choose/compare'].fingerprint = 'changed';
    if (mode === 'future') payload.storageSchemaVersion = 99;
    const names = storageNames(new URL('./', location.href).pathname);
    const db = await openDatabase(names.database);
    await writeDatabase(db, payload, 0);
    db.close(); localStorage.setItem(names.preference, 'true');
  }, mode);
  await page.reload();
}

test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('opt-in autosave restores attempts, evidence, drafts and completion after reload', async ({ page }) => {
  await page.locator('#prediction').selectOption('pie'); await page.locator('#save-prediction').click();
  await page.locator('#record-experiment').click(); await page.locator('#kind').selectOption('bar'); await page.locator('#record-experiment').click();
  for (const [id, values] of [['compare-reason', ['b']], ['compare-alternatives', ['a', 'b']]]) {
    const q = page.locator(`#question-${id}`);
    for (const value of values) await q.locator(`input[value="${value}"]`).check();
    await q.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click();
  }
  await page.locator('#reflection').fill('เหตุผลภาษาไทยที่บันทึกเมื่อทำครบ'); await page.locator('#complete-task').click();
  await page.locator('#enable-storage').click();
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.locator('#reflection').fill('ข้อความร่างหลังทำครบ');
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();
  await expect(page.locator('#storage-status')).toContainText('กู้คืน');
  await expect(page.locator('#progress')).toHaveAttribute('value', '2');
  await expect(page.locator('#reflection')).toHaveValue('ข้อความร่างหลังทำครบ');
  await page.locator('#completed-review summary').first().click();
  await expect(page.locator('#completed-review')).toContainText('เหตุผลภาษาไทยที่บันทึกเมื่อทำครบ');
  await expect(page.locator('#question-compare-reason .question-mastery')).toContainText('ส่งแล้ว 1 ครั้ง');
  await page.locator('[data-mode="free"]').click();
  await expect(page.locator('#storage-panel')).toBeHidden();
  await expect(page.locator('[data-question-form]')).toHaveCount(0);
});

for (const mode of ['corrupt', 'content']) test(`${mode} saved task is quarantined until explicit recovery`, async ({ page }) => {
  await seed(page, mode);
  await expect(page.locator('#accept-recovery')).toBeVisible();
  await expect(page.locator('#progress')).toHaveAttribute('value', '2'); // Color survives.
  await expect(page.locator('#reasoning')).toBeHidden();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#accept-recovery').click();
  await expect(page.locator('#storage-status')).toContainText('รักษาส่วนที่กู้คืน');
  await page.reload();
  await expect(page.locator('#accept-recovery')).toHaveCount(0);
  await expect(page.locator('#progress')).toHaveAttribute('value', '2');
});

test('unsupported schema is not overwritten and confirmed reset cannot resurrect data', async ({ page }) => {
  await seed(page, 'future');
  await expect(page.locator('#storage-status')).toContainText('ยังไม่รองรับ');
  const schema = await page.evaluate(async () => {
    const { storageNames, openDatabase, readDatabase } = await import('./src/storage/database.js');
    const db = await openDatabase(storageNames(new URL('./', location.href).pathname).database); const value = await readDatabase(db); db.close(); return value.storageSchemaVersion;
  });
  expect(schema).toBe(99);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#reset-guided').click();
  await expect(page.locator('#storage-status')).toContainText('ล้างความคืบหน้า');
  await page.reload();
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
  await expect(page.locator('#storage-status')).toContainText('กู้คืน');
  page.once('dialog', dialog => dialog.accept()); await page.locator('#disable-storage').click();
  await expect(page.locator('#storage-status')).toContainText('ลบความคืบหน้า');
  await page.reload();
  await expect(page.locator('#enable-storage')).toBeVisible();
});

test('progressive hints never add attempts or expose answer explanations early', async ({ page }) => {
  await seed(page);
  const q = page.locator('#question-compare-reason');
  await q.getByRole('button', { name: 'ฝึกซ้ำ' }).click();
  await q.locator('input[value="a"]').check(); await q.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click();
  await expect(q.locator('.answer-feedback')).toContainText('ระดับ 1');
  await q.getByRole('button', { name: 'ดูคำใบ้เพิ่มเติม' }).click();
  await expect(q.locator('.answer-feedback')).toContainText('ระดับ 2');
  await q.getByRole('button', { name: 'ดูคำใบ้เพิ่มเติม' }).click();
  await expect(q.locator('.answer-feedback')).toContainText('ระดับ 3');
  await expect(q.locator('.question-mastery')).toContainText('ส่งแล้ว 2 ครั้ง · ตอบผิด 1 ครั้ง');
  await expect(q.locator('.answer-feedback')).not.toContainText('เหตุผลของแต่ละตัวเลือก');
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();
  await expect(page.locator('#compare-reason-feedback')).toContainText('ระดับ 3');
});

test('PDF download contains a real file with Thai evidence and no external service', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await seed(page);
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4174/') && !request.url().startsWith('blob:')) external.push(request.url()); });
  await page.locator('#show-summary').click();
  await page.locator('#preview-report').click();
  await expect(page.locator('#report-preview')).toContainText('หลักฐานเมื่อทำครบ');
  await page.locator('#generate-pdf').click();
  await expect(page.locator('#pdf-actions')).toBeVisible({ timeout: 60000 });
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download-pdf').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^visualization-lab-report-\d+\.pdf$/);
  const path = `artifacts/${testInfo.project.name}-report.pdf`;
  await download.saveAs(path);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10000);
  await page.locator('.report-panel').screenshot({ path: `artifacts/${testInfo.project.name}-pdf-panel.png` });
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('quota failure keeps the draft in memory and retry does not add attempts', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    globalThis.failWrites = true;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (globalThis.failWrites) throw new DOMException('Quota full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.locator('#reflection').fill('ข้อความที่ต้องรักษาเมื่อพื้นที่เต็ม');
  await expect(page.locator('#storage-status')).toContainText('บันทึกไม่สำเร็จ');
  await expect(page.locator('#reflection')).toHaveValue('ข้อความที่ต้องรักษาเมื่อพื้นที่เต็ม');
  await expect(page.locator('#progress')).toHaveAttribute('value', '4');
  await page.evaluate(() => globalThis.failWrites = false);
  await page.locator('#retry-storage').click();
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();
  await expect(page.locator('#reflection')).toHaveValue('ข้อความที่ต้องรักษาเมื่อพื้นที่เต็ม');
  await expect(page.locator('#question-compare-reason .question-mastery')).toContainText('ส่งแล้ว 1 ครั้ง');
});

test('a stale tab cannot overwrite a newer tab', async ({ page, context }) => {
  await seed(page);
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.locator('#storage-status')).toContainText('กู้คืน');
  await page.locator('#reflection').fill('ฉบับใหม่จากแท็บแรก');
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await second.locator('#reflection').fill('ฉบับเก่าจากแท็บที่สอง');
  await expect(second.locator('#storage-status')).toContainText('อีกแท็บ');
  await second.reload();
  await expect(second.locator('#reflection')).toHaveValue('ฉบับใหม่จากแท็บแรก');
  await second.close();
});

test('PDF load failure allows retry without changing mastery', async ({ page }) => {
  test.setTimeout(60000);
  await seed(page);
  await page.locator('#show-summary').click();
  await page.route('**/vendor/pdfmake.min.js', route => route.abort());
  await page.locator('#generate-pdf').click();
  await expect(page.locator('#pdf-status')).toContainText('สร้าง PDF ไม่สำเร็จ');
  await expect(page.locator('#progress')).toHaveAttribute('value', '4');
  await page.unroute('**/vendor/pdfmake.min.js');
  await page.locator('#generate-pdf').click();
  await expect(page.locator('#pdf-actions')).toBeVisible({ timeout: 45000 });
  await expect(page.locator('#progress')).toHaveAttribute('value', '4');
});
