import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('./'); });

async function predict(page, value = 'bar') {
  if (await page.locator('#prediction').evaluate(element => element.tagName === 'TEXTAREA')) await page.locator('#prediction').fill('ควรปรับชนิดกราฟ แกน และสี');
  else await page.locator('#prediction').selectOption(value);
  await page.locator('#save-prediction').click();
}

async function unlockComparison(page) {
  await predict(page, 'pie');
  await page.locator('#record-experiment').click();
  await page.locator('#kind').selectOption('bar');
  await page.locator('#record-experiment').click();
  await expect(page.locator('#reasoning')).toBeVisible();
}

async function answer(page, id, values) {
  const question = page.locator(`#question-${id}`);
  for (const value of values) await question.locator(`input[value="${value}"]`).check();
  await question.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click();
}

test('prediction, comparison gate and wrong-wrong-correct retries count only submissions', async ({ page }) => {
  await expect(page.locator('#kind')).toBeDisabled();
  await expect(page.locator('#reasoning')).toBeHidden();
  await page.locator('#save-prediction').click();
  await expect(page.locator('#prediction-message')).toContainText('ก่อนทดลอง');
  await predict(page, 'pie');
  await page.locator('#record-experiment').click();
  await page.locator('#labels').uncheck();
  await page.locator('#record-experiment').click();
  await expect(page.locator('#experiment-message')).toContainText('บันทึกรูปแบบนี้แล้ว');
  await expect(page.locator('#reasoning')).toBeHidden();
  await page.locator('#kind').selectOption('bar');
  await page.locator('#record-experiment').click();
  const question = page.locator('#question-compare-reason');
  await question.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click();
  await expect(question.locator('.question-mastery')).toContainText('ส่งแล้ว 0 ครั้ง');
  await expect(question.locator('.form-message')).toContainText('เลือกคำตอบ');
  await question.locator('input[value="d"]').check();
  await question.locator('input[value="a"]').check();
  await expect(question.locator('.question-mastery')).toContainText('ส่งแล้ว 0 ครั้ง');
  await question.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click();
  await expect(question.locator('.answer-feedback')).toContainText('ลองทบทวน');
  await expect(question.locator('.answer-feedback')).not.toContainText('เหตุผลของแต่ละตัวเลือก');
  await expect(question.getByRole('button', { name: 'ส่งคำตอบ', exact: true })).toBeDisabled();
  await question.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
  await question.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click();
  await question.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
  await answer(page, 'compare-reason', ['b']);
  await expect(question.locator('.question-mastery')).toContainText('ส่งแล้ว 3 ครั้ง · ตอบผิด 2 ครั้ง');
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
  await question.getByRole('button', { name: 'ฝึกซ้ำ', exact: true }).click();
  await answer(page, 'compare-reason', ['a']);
  await expect(question.locator('.question-mastery')).toContainText('เคยตอบถูกแล้ว');
  await expect(question.locator('.question-mastery')).toContainText('ส่งแล้ว 4 ครั้ง · ตอบผิด 3 ครั้ง');
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
});

test('multiple-select gives hints without revealing missing or correct subsets', async ({ page }) => {
  await unlockComparison(page);
  await answer(page, 'compare-alternatives', ['a', 'c']);
  const question = page.locator('#question-compare-alternatives');
  await expect(question.locator('.answer-feedback')).toContainText('ลองทบทวน');
  await expect(question.locator('.answer-feedback')).not.toContainText('เหตุผลของแต่ละตัวเลือก');
  await expect(question.locator('.answer-feedback')).not.toContainText('ตำแหน่งจุดบนแกนร่วมช่วยเปรียบเทียบ');
  await question.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
  await question.locator('input[value="c"]').uncheck();
  await answer(page, 'compare-alternatives', ['b']);
  await expect(question.locator('.question-mastery')).toContainText('ส่งแล้ว 2 ครั้ง · ตอบผิด 1 ครั้ง');
  await expect(question.locator('.answer-feedback')).toContainText('เหตุผลของแต่ละตัวเลือก');
});

test('all four labs, ten questions and five tasks complete and review', async ({ page }) => {
  // This journey completes five activities, not a single interaction.
  test.setTimeout(60000);
  const scenarios = [
    { lab: 'choose', task: 0, prediction: 'pie', controls: [['kind', 'bar']], answers: [['compare-reason', ['b']], ['compare-alternatives', ['a', 'b']]] },
    { lab: 'choose', task: 1, prediction: 'bar', controls: [['kind', 'line']], answers: [['time-design', ['a']], ['time-interpretation', ['a', 'b']]] },
    { lab: 'color', prediction: 'uniform', controls: [['palette', 'highlight']], answers: [['color-focus', ['c']], ['color-meaning', ['a', 'b', 'c']]] },
    { lab: 'misleading', prediction: 'same', controls: [['baseline', '0']], answers: [['axis-perception', ['d']], ['axis-principles', ['a', 'b']]] },
    { lab: 'redesign', controls: [['baseline', '0'], ['palette', 'uniform']], answers: [['redesign-choice', ['b']], ['redesign-principles', ['a', 'b', 'c']]] },
  ];
  for (const scenario of scenarios) {
    await page.locator(`[data-lab="${scenario.lab}"]`).click();
    if (scenario.task === 1) await page.locator('[data-task="1"]').click();
    await predict(page, scenario.prediction);
    await page.locator('#record-experiment').click();
    for (const [id, value] of scenario.controls) {
      if (id === 'baseline') { await page.locator('#baseline').fill(value); await page.locator('#baseline').blur(); }
      else await page.locator(`#${id}`).selectOption(value);
    }
    await page.locator('#record-experiment').click();
    await expect(page.locator('#reasoning')).toBeVisible();
    for (const [id, values] of scenario.answers) await answer(page, id, values);
    await page.locator('#complete-task').click();
    await expect(page.locator('#completion-feedback')).toContainText('ยังทำกิจกรรมไม่ครบ');
    await page.locator('#reflection').fill(`สะท้อนคิดสถานการณ์ ${scenario.lab}`);
    if (scenario.lab === 'redesign') {
      await page.locator('#complete-task').click();
      await expect(page.locator('#completion-feedback')).toContainText('ยังทำกิจกรรมไม่ครบ');
      await page.locator('#reflection-2').fill('ใช้สีอย่างมีจุดประสงค์เพื่อให้เปรียบเทียบง่ายขึ้น');
    }
    await page.locator('#complete-task').click();
    await expect(page.locator('#completion-feedback')).toContainText('ทำกิจกรรมครบแล้ว');
  }
  await expect(page.locator('#progress')).toHaveAttribute('value', '10');
  await expect(page.locator('#completion-text')).toContainText('5 / 5 สถานการณ์ · 4 / 4 แล็บ');
  await page.locator('#show-summary').click();
  await expect(page.locator('.summary-metrics')).toContainText('10 / 10');
  await expect(page.locator('.summary-lab')).toHaveCount(4);
  await page.locator('[data-review-lab="choose"][data-review-task="compare"]').click();
  await page.locator('#completed-review summary').first().click();
  await expect(page.locator('#completed-review')).toContainText('สะท้อนคิดสถานการณ์ choose');
  await page.locator('#kind').selectOption('line');
  await expect(page.locator('#completed-review [data-evidence="completion"] rect.mark')).toHaveCount(4);
  await page.locator('#complete-task').click();
  await expect(page.locator('#completion-feedback')).toContainText('ผลที่เคยทำครบและหลักฐานเดิมยังคงอยู่');
  await page.locator('#reset-chart').click();
  await expect(page.locator('#kind')).toHaveValue('pie');
  await expect(page.locator('#progress')).toHaveAttribute('value', '10');
  await expect(page.locator('#completed-review')).toContainText('สะท้อนคิดสถานการณ์ choose');
});

test('session reset confirmation and mode isolation preserve free exploration', async ({ page }) => {
  await unlockComparison(page);
  await answer(page, 'compare-reason', ['b']);
  await page.locator('#reflection').fill('บันทึกข้อความเดิม');
  await page.locator('[data-mode="free"]').click();
  await expect(page.locator('#guided-progress')).toBeHidden();
  await expect(page.locator('[data-question-form]')).toHaveCount(0);
  await page.locator('#data-editor summary').click();
  await page.getByLabel('ค่าข้อมูล แถว 1', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'นำข้อมูลไปใช้', exact: true }).click();
  await page.locator('[data-mode="guided"]').click();
  await expect(page.locator('#reflection')).toHaveValue('บันทึกข้อความเดิม');
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#reset-guided').click();
  await expect(page.locator('#progress')).toHaveAttribute('value', '1');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#reset-guided').click();
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
  await expect(page.locator('#prediction')).toHaveValue('');
  await expect(page.locator('#reasoning')).toBeHidden();
  await page.locator('[data-mode="free"]').click();
  await page.locator('#data-editor summary').click();
  await expect(page.getByLabel('ค่าข้อมูล แถว 1', { exact: true })).toHaveValue('10');
});

test('free data validation, axes, inspection and pie controls', async ({ page }) => {
  await page.locator('[data-mode="free"]').click();
  await page.locator('#baseline').fill('70');
  await page.locator('#baseline').blur();
  await expect(page.locator('#chart')).toContainText('ยังไม่สามารถแสดงกราฟ');
  await page.locator('#fit-axis').click();
  await expect(page.locator('#baseline')).toHaveValue('0');
  await page.locator('#chart [data-point="2"]').click();
  await expect(page.locator('#inspection')).toContainText('ห้อง C');
  await page.locator('#data-editor summary').click();
  await page.getByLabel('ค่าข้อมูล แถว 1', { exact: true }).fill('');
  await page.getByRole('button', { name: 'นำข้อมูลไปใช้', exact: true }).click();
  await expect(page.locator('#data-errors')).toContainText('ค่าข้อมูลต้องเป็นตัวเลข');
  await page.getByLabel('ค่าข้อมูล แถว 1', { exact: true }).fill('10');
  await page.locator('#edit-title').fill('ข้อมูลทดลองใหม่');
  await page.getByRole('button', { name: 'นำข้อมูลไปใช้', exact: true }).click();
  await expect(page.locator('#chart-title')).toHaveText('ข้อมูลทดลองใหม่');
  await page.locator('#kind').selectOption('pie');
  await expect(page.locator('#baseline')).toBeDisabled();
  await expect(page.locator('#chart .pie-label').first()).toBeVisible();
  await page.locator('#labels').uncheck();
  await expect(page.locator('#chart .pie-label')).toHaveCount(0);
  await expect(page.locator('#legend')).toContainText('ห้อง A');
  await page.locator('#add-row').click();
  await page.getByLabel('ชื่อข้อมูล แถว 5', { exact: true }).fill('ห้อง E');
  await page.getByRole('button', { name: 'นำข้อมูลไปใช้', exact: true }).click();
  await expect(page.locator('#legend')).toContainText('ห้อง E');
});

test('numeric data supports inspection and rejects invalid edits', async ({ page }) => {
  await page.locator('[data-mode="free"]').click();
  await page.locator('[data-dataset="relationship"]').click();
  await page.locator('#kind').selectOption('dot');
  await page.locator('#chart [data-point="2"]').click();
  await expect(page.locator('#inspection')).toContainText('ชั่วโมงทบทวน 3');
  await page.locator('#chart [data-point="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspection')).toContainText('ชั่วโมงทบทวน 2');
  await page.locator('#data-editor summary').click();
  await page.getByLabel('ค่าแกนนอน แถว 1', { exact: true }).fill('');
  await page.getByRole('button', { name: 'นำข้อมูลไปใช้', exact: true }).click();
  await expect(page.locator('#data-errors')).toContainText('ค่าของแกนนอนต้องเป็นตัวเลข');
  await page.getByLabel('ค่าแกนนอน แถว 1', { exact: true }).fill('0.5');
  await page.getByLabel('ค่าข้อมูล แถว 1', { exact: true }).fill('-10');
  await page.getByRole('button', { name: 'นำข้อมูลไปใช้', exact: true }).click();
  await expect(page.locator('#baseline')).toHaveValue('-10');
  await page.locator('#kind').selectOption('pie');
  await expect(page.locator('#chart')).toContainText('กราฟวงกลมต้องใช้ค่าที่ไม่ติดลบ');
  await page.locator('#kind').selectOption('bar');
  await expect(page.locator('#chart svg')).toBeVisible();
});

test('responsive question controls, keyboard, report and session-only privacy', async ({ page, baseURL }, testInfo) => {
  const errors = [], external = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(new URL(baseURL).origin)) external.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failed.push(response.url()); });
  await page.reload();
  await unlockComparison(page);
  await page.locator('#reflection').fill('ข้อความเดิม');
  await page.locator('#labels').focus();
  await page.locator('#labels').press('Space');
  await expect(page.locator('#labels')).toBeFocused();
  await expect(page.locator('#reflection')).toHaveValue('ข้อความเดิม');
  await page.locator('#chart [data-point="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspection')).toContainText('ห้อง A');
  const question = page.locator('#question-compare-reason');
  await question.locator('input[value="b"]').focus();
  await page.keyboard.press('Space');
  await question.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#compare-reason-feedback')).toBeFocused();
  const minTarget = await question.locator('.answer-option').evaluateAll(elements => Math.min(...elements.map(element => element.getBoundingClientRect().height)));
  expect(minTarget).toBeGreaterThanOrEqual(44);
  await question.screenshot({ path: `artifacts/${testInfo.project.name}-practice.png` });
  await page.locator('#show-summary').click();
  await expect(page.locator('.summary-metrics')).toContainText('1 / 10');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#stage').screenshot({ path: `artifacts/${testInfo.project.name}-summary.png` });
  await page.locator('[data-mode="free"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
  await page.reload();
  await expect(page.locator('#progress')).toHaveAttribute('value', '0');
  await expect(page.locator('#prediction')).toHaveValue('');
  const duplicates = await page.locator('[id]').evaluateAll(elements => {
    const ids = elements.map(element => element.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicates).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
});
