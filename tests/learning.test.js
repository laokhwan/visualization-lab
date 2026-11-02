import test from 'node:test';
import assert from 'node:assert/strict';
import { labs } from '../src/content/labs.js';
import { createState, current, selectLab, completedLabs, markChanged } from '../src/state.js';
import { submit } from '../src/learning/evaluate.js';

test('incorrect chart never counts as successful', () => {
  const state = createState();
  const { task, draft } = current(state);
  draft.prediction = 'pie';
  draft.note = 'เขียนคำอธิบายครบ แต่เลือกกราฟไม่ตรงเป้าหมาย';
  assert.equal(submit(task, draft).passed, false);
  assert.equal(draft.attempts, 1);
  assert.equal(draft.everPassed, false);
  assert.equal(completedLabs(state), 0);
});

test('every scenario must pass before a lab counts as completed', () => {
  const state = createState();
  for (const [i, task] of labs[0].tasks.entries()) {
    const draft = state.guided.choose[i];
    draft.config.kind = i === 0 ? 'dot' : 'line';
    draft.prediction = 'bar'; // Prediction is recorded, not graded as correct.
    draft.note = 'อธิบายผลจากการทดลอง';
    assert.equal(submit(task, draft).passed, true);
    assert.equal(completedLabs(state), i === 0 ? 0 : 1);
  }
});

test('free exploration and separate labs preserve independent drafts', () => {
  const state = createState();
  current(state).draft.note = 'บันทึกเดิม';
  current(state).draft.config.kind = 'dot';
  state.mode = 'free';
  state.free.dataset.rows[0].value = 999;
  state.free.config.kind = 'line';
  selectLab(state, 'misleading');
  assert.equal(current(state).task.dataset, 'scores');
  assert.equal(current(state).draft.config.baseline, 70);
  selectLab(state, 'choose');
  assert.equal(current(state).draft.note, 'บันทึกเดิม');
  assert.equal(current(state).draft.config.kind, 'dot');
});

test('redesign requires two explanations and valid axes', () => {
  const state = createState();
  selectLab(state, 'redesign');
  const { task, draft } = current(state);
  Object.assign(draft.config, { kind: 'dot', palette: 'uniform', baseline: 70 });
  draft.prediction = 'ปรับสีและแกน';
  draft.note = 'ใช้สีเดียว';
  assert.equal(submit(task, draft).passed, false);
  draft.note2 = 'ใช้ตำแหน่งจุดเปรียบเทียบ และระบุช่วงแกน';
  assert.equal(submit(task, draft).passed, true);
  draft.config.baseline = 100;
  markChanged(draft);
  assert.equal(draft.dirty, true);
  assert.equal(submit(task, draft).passed, false);
  assert.equal(draft.everPassed, true); // History is not a claim about current settings.
});
