import { test, expect } from '@playwright/test';
import { start } from './helpers.js';

async function seedDashboard(page, complete) {
  await page.goto('./');
  await page.evaluate(async complete => {
    const { createState } = await import('./src/state.js');
    const { labs } = await import('./src/content/labs.js');
    const { prepareTask } = await import('./tests/helpers/learning.js');
    const { serializeProgress } = await import('./src/storage/schema.js');
    const { storageNames, openDatabase, writeDatabase } = await import('./src/storage/database.js');
    const state = createState();
    if (complete) {
      for (const lab of labs) for (const task of lab.tasks.filter(t => t.section === 'foundation')) prepareTask(state, lab.id, task.id);
    } else {
      const { draft } = prepareTask(state, 'choose', 'compare', { complete: false });
      draft.note = '';
      prepareTask(state, 'color', 'focus');
    }
    const names = storageNames(new URL('./', location.href).pathname);
    const db = await openDatabase(names.database);
    await writeDatabase(db, serializeProgress(state), 0);
    db.close();
    localStorage.setItem(names.preference, 'true');
  }, complete);
  await page.reload();
  await start(page);
  await page.locator('#show-summary').click();
}

test('dashboard distinguishes mastered questions, unfinished foundation tasks and optional extensions', async ({ page }, testInfo) => {
  await seedDashboard(page, false);
  await expect(page.locator('.summary-lab')).toHaveCount(4);
  await expect(page.locator('.summary-metrics')).toContainText('1 / 8');
  await expect(page.locator('.summary-metrics')).toContainText('1 / 4');
  const choose = page.locator('.summary-lab[data-lab-id="choose"]');
  await expect(choose.locator('.dashboard-task')).toHaveCount(5);
  await expect(choose.locator('.lab-completion')).toContainText('0 / 5');
  await expect(choose.locator('.dashboard-task').first()).toContainText('ตอบผ่านแล้ว · กิจกรรมยังไม่ครบ');
  await expect(choose.locator('.dashboard-task').first()).toContainText('กรอกสะท้อนคิด');
  await expect(choose.locator('.dashboard-extra')).toHaveCount(0);
  await expect(page.locator('.summary-lab[data-lab-id="color"]')).toContainText('พื้นฐานครบแล้ว');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-dashboard.png`, fullPage: true });
  await choose.locator('.dashboard-foundation > summary').click();
  await choose.locator('[data-review-task="compare"]').click();
  await expect(page.locator('#task-select')).toHaveValue('0');
  await expect(page.locator('#stage-title')).toContainText('เลือกกราฟ');
});

test('all four foundation labs can be complete while nine extensions remain unstarted', async ({ page }) => {
  await seedDashboard(page, true);
  await expect(page.locator('.summary-metrics')).toContainText('8 / 8');
  await expect(page.locator('.summary-metrics')).toContainText('4 / 4');
  await expect(page.locator('.summary-metrics')).toContainText('16 / 16');
  await expect(page.locator('.dashboard-lab.is-complete')).toHaveCount(4);
  await expect(page.locator('.dashboard-extra')).toHaveCount(3);
  await page.locator('.summary-lab[data-lab-id="color"] .dashboard-extra > summary').click();
  await expect(page.locator('.summary-lab[data-lab-id="color"] .dashboard-extra')).toContainText('ทำครบ 0/3');
  await page.locator('.summary-lab[data-lab-id="choose"] .dashboard-foundation > summary').click();
  await page.locator('.summary-lab[data-lab-id="choose"] [data-review-task="boxplot-groups"]').click();
  await expect(page.locator('#chart-source')).toHaveValue('completion');
});
