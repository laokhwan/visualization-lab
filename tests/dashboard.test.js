import test from 'node:test';
import assert from 'node:assert/strict';
import { labs } from '../src/content/labs.js';
import { createState } from '../src/state.js';
import { prepareTask } from './helpers/learning.js';
import { buildLearningSummary } from '../src/learning/report.js';
import { assessmentManifest, serializeProgress, restoreProgress } from '../src/storage/schema.js';

test('all five Choose tasks are foundation without invalidating earlier V2 assessment manifests', () => {
  const choose = labs.find(l => l.id === 'choose');
  assert.equal(choose.tasks.length, 5);
  assert.ok(choose.tasks.every(t => t.section === 'foundation'));
  const state = createState();
  prepareTask(state, 'choose', 'scatter-relationship');
  const payload = serializeProgress(state);
  // Reconstruct the earlier curriculum labels: assessment identity must be unchanged.
  try {
    choose.tasks.slice(2).forEach(t => { t.section = 'extension'; });
    assert.deepEqual(assessmentManifest(), payload.assessmentManifest);
  } finally {
    choose.tasks.forEach(t => { t.section = 'foundation'; });
  }
  const restored = restoreProgress(payload);
  assert.equal(restored.status, 'restored');
  assert.deepEqual(serializeProgress(restored.state).tasks, payload.tasks);
});

test('foundation completion is independent of extension completion and mastery alone', () => {
  const state = createState();
  const untouched = buildLearningSummary(state);
  assert.equal(untouched.sections[0].taskCount, 8);
  assert.equal(untouched.sections[1].taskCount, 9);
  assert.equal(untouched.sections[0].questionCount, 16);
  assert.ok(untouched.labs.every(l => l.tasks.every(t => !t.started)));
  prepareTask(state, 'choose', 'compare', { complete: false });
  let task = buildLearningSummary(state).labs[0].tasks[0];
  assert.equal(task.masteryStatus, 'mastered');
  assert.equal(task.completionStatus, 'incomplete');
  assert.equal(task.started, true);
  const completeState = createState();
  for (const lab of labs) for (const task of lab.tasks.filter(t => t.section === 'foundation')) prepareTask(completeState, lab.id, task.id);
  const summary = buildLearningSummary(completeState);
  assert.equal(summary.sections[0].completedTaskCount, 8);
  assert.equal(summary.sections[1].completedTaskCount, 0);
  assert.equal(summary.labs.filter(l => l.tasks.filter(t => t.section === 'foundation').every(t => t.completionStatus === 'complete')).length, 4);
  assert.equal(summary.totals.completedLabCount, 1); // Full-lab completion still includes extensions.
});
