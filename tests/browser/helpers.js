import { expect } from '@playwright/test';
export async function start(page, mode = 'guided') {
  if (await page.locator('#landing').isVisible()) await page.locator(mode === 'free' ? '#start-free' : '#start-guided').click();else if ((await page.locator(`[data-mode="${mode}"]`).getAttribute('aria-pressed')) !== 'true') await page.locator(`[data-mode="${mode}"]`).click();
}
export async function selectTask(page, lab, index = 0) {
  await start(page);
  await page.locator('#lab-select').selectOption(lab);
  await page.locator('#task-select').selectOption(String(index));
}
export async function step(page, id) {
  const b = page.locator(`.step-nav [data-step="${id}"]`);
  if ((await b.getAttribute('aria-current')) !== 'step') await b.click();
}
export async function predict(page, value = 'pie') {
  const input = page.locator('#prediction');
  if (await input.evaluate(e => e.tagName === 'TEXTAREA')) await input.fill('ตรวจชนิดข้อมูล แกน สี และบริบทก่อนสรุป');else await input.selectOption(value);
  await page.locator('#save-prediction').click();
  await expect(page.locator('.step-nav [aria-current]')).toHaveAttribute('data-step', 'experiment');
}
export async function reveal(page, id) {
  await page.locator(`#${id}`).evaluate(e => {
    for (let p = e.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  });
  await expect(page.locator(`#${id}`)).toBeVisible();
}
export async function adjust(page, id, value) {
  await reveal(page, id);
  const input = page.locator(`#${id}`),
    tag = await input.evaluate(e => e.tagName);
  if (tag === 'SELECT') await input.selectOption(String(value));else if (typeof value === 'boolean') await input.setChecked(value);else {
    await input.fill(String(value));
    await input.blur();
  }
}
export async function answer(page, id, values) {
  await step(page, 'explain');
  const index = await page.evaluate(async id => {
    const {
      labs
    } = await import('./src/content/labs.js');
    return labs.find(l => l.id === document.querySelector('#lab-select').value).tasks[Number(document.querySelector('#task-select').value)].questionIds.indexOf(id);
  }, id);
  await page.locator(`[data-question-index="${index}"]`).click();
  const q = page.locator(`#question-${id}`);
  for (const value of values) await q.locator(`input[value="${value}"]`).check();
  await q.getByRole('button', {
    name: 'ส่งคำตอบ',
    exact: true
  }).click();
}
export async function reflection(page, note = 'กราฟเปลี่ยนการรับรู้ แต่ค่าข้อมูลและข้อจำกัดต้องตรวจร่วมกัน', note2 = note) {
  await step(page, 'explain');
  await page.locator('[data-question-index="2"]').click();
  await page.locator('#reflection').fill(note);
  if (await page.locator('#reflection-2').count()) await page.locator('#reflection-2').fill(note2);
}
export async function finish(page) {
  await step(page, 'feedback');
  await page.locator('#complete-task').click();
  await expect(page.locator('#completion-feedback')).toContainText('ทำกิจกรรมครบ');
}
export async function unlock(page) {
  await predict(page);
  await page.locator('#record-experiment').click();
  await adjust(page, 'kind', 'bar');
  await page.locator('#record-experiment').click();
  await step(page, 'explain');
}
export async function storage(page) {
  if (await page.locator('#storage-panel').isHidden()) await page.locator('#storage-toggle').click();
}
export async function editor(page) {
  if ((await page.locator('#free-editor-host').count()) === 0) await page.locator('#edit-data').click();
}
export async function chart(page) {
  if (await page.locator('#back-to-chart').count()) await page.locator('#back-to-chart').click();
}
export async function report(page) {
  await page.locator('#show-summary').click();
  await page.locator('#open-report').click();
}
