import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, current, resetGuided } from '../src/state.js';
import { taskUi, visitStep, canVisitStep } from '../src/workspace.js';
import { prepareTask } from './helpers/learning.js';
import { serializeProgress, restoreProgress, assessmentManifest } from '../src/storage/schema.js';
import { buildLearningSummary } from '../src/learning/report.js';
import { chartSvg } from '../src/charts/render.js';
import { copyDataset } from '../src/content/datasets.js';
import { initialConfig } from '../src/data/view.js';
test('steps cannot bypass prediction or experiment evidence', () => {
  const state = createState(),
    {
      lab,
      task,
      draft
    } = current(state);
  assert.equal(state.ui.screen, 'landing');
  assert.equal(taskUi(state, lab.id, task).step, 'predict');
  for (const step of ['experiment', 'explain', 'feedback', 'unknown']) assert.equal(visitStep(state, lab.id, task, step), false);
  draft.predictionSaved = true;
  assert.equal(canVisitStep(task, draft, 'experiment'), true);
  assert.equal(visitStep(state, lab.id, task, 'feedback'), false);
});
test('navigating steps and question cards never changes attempts, mastery, or frozen evidence', () => {
  const state = createState(),
    {
      task
    } = prepareTask(state),
    before = JSON.stringify(state.guided),
    summary = buildLearningSummary(state),
    manifest = assessmentManifest();
  for (const step of ['predict', 'experiment', 'explain', 'feedback']) assert.equal(visitStep(state, 'choose', task, step), true);
  taskUi(state, 'choose', task).questionIndex = 1;
  taskUi(state, 'choose', task).source = 'original';
  assert.equal(JSON.stringify(state.guided), before);
  assert.deepEqual(buildLearningSummary(state), summary);
  assert.deepEqual(assessmentManifest(), manifest);
});
test('optional navigation restores safely without changing schema or old payload compatibility', () => {
  const state = createState(),
    {
      task
    } = prepareTask(state);
  visitStep(state, 'choose', task, 'explain');
  taskUi(state, 'choose', task).questionIndex = 1;
  const payload = serializeProgress(state);
  assert.equal(payload.storageSchemaVersion, 2);
  assert.equal(payload.lastLocation.step, 'explain');
  let restored = restoreProgress(payload);
  assert.equal(restored.status, 'restored');
  assert.equal(restored.state.ui.screen, 'landing');
  assert.equal(taskUi(restored.state, 'choose', task).questionIndex, 1);
  delete payload.lastLocation.step;
  delete payload.lastLocation.questionIndex;
  restored = restoreProgress(payload);
  assert.equal(restored.status, 'restored');
  assert.equal(taskUi(restored.state, 'choose', task).step, 'feedback');
  const empty = serializeProgress(createState());
  empty.lastLocation.step = 'feedback';
  empty.lastLocation.questionIndex = 999;
  restored = restoreProgress(empty);
  assert.equal(restored.status, 'restored');
  assert.equal(taskUi(restored.state, 'choose', task).step, 'predict');
  assert.equal(taskUi(restored.state, 'choose', task).questionIndex, 0);
});
test('guided reset clears only guided presentation cursors and retains Free draft state', () => {
  const state = createState(),
    {
      task
    } = prepareTask(state);
  taskUi(state, 'choose', task).questionIndex = 2;
  state.free.editorDraft = {
    title: 'ร่างจำลอง'
  };
  state.ui.freeView = 'data';
  resetGuided(state);
  assert.deepEqual(state.ui.tasks, {});
  assert.equal(state.free.editorDraft.title, 'ร่างจำลอง');
  assert.equal(state.ui.freeView, 'data');
});
test('each step retains its chart context independently', () => {
  const state = createState(),
    {
      task
    } = prepareTask(state),
    ui = taskUi(state, 'choose', task);
  visitStep(state, 'choose', task, 'experiment');
  assert.equal(ui.source, 'current');
  ui.source = 'pie';
  visitStep(state, 'choose', task, 'explain');
  assert.equal(ui.source, 'current');
  ui.source = 'comparison';
  visitStep(state, 'choose', task, 'experiment');
  assert.equal(ui.source, 'pie');
  visitStep(state, 'choose', task, 'feedback');
  assert.equal(ui.source, 'completion');
  visitStep(state, 'choose', task, 'explain');
  assert.equal(ui.source, 'comparison');
});
test('responsive SVG remains finite with narrow containers and PDF defaults remain deterministic', () => {
  for (const id of ['groups', 'shade', 'soil', 'dualResearch']) {
    const data = copyDataset(id),
      config = initialConfig(data);
    for (const width of [300, 440, 700, 1000]) {
      const svg = chartSvg(data, config, 'test', {
        width,
        compact: true
      });
      assert.match(svg, new RegExp(`viewBox="0 0 ${width} `));
      assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    }
    const before = chartSvg(data, config, 'export');
    chartSvg(data, config, 'live', {
      width: 300,
      compact: true
    });
    assert.equal(chartSvg(data, config, 'export'), before);
  }
});
