import test from 'node:test';
import assert from 'node:assert/strict';
import { labs } from '../src/content/labs.js';
import { questions, validateQuestionDefinitions } from '../src/content/questions.js';
import { createState, current, selectLab, resetGuided, resetChart, completedLabs } from '../src/state.js';
import { evaluateAnswer, evaluateDesign } from '../src/learning/evaluate.js';
import { savePrediction, recordExperiment, experimentComplete } from '../src/learning/experiments.js';
import { questionCounts, submitAnswer, retryQuestion, completeTask, taskMastered } from '../src/learning/practice.js';
import { buildLearningSummary } from '../src/learning/report.js';
import { questionHtml } from '../src/ui/practice.js';

function unlock(task, draft) {
  draft.prediction = 'คาดการณ์ที่อาจไม่ถูกต้อง';
  savePrediction(draft);
  for (const slot of task.experiment) {
    if (slot.design) Object.assign(draft.config, { kind: 'dot', palette: 'uniform', baseline: 70 });
    else for (const [key, values] of Object.entries(slot.match)) draft.config[key] = values[0];
    assert.equal(recordExperiment(task, draft).accepted, true);
  }
}

function master(task, draft) {
  for (const id of task.questionIds) {
    draft.questions[id].selectedOptionIds = [...questions[id].correctOptionIds];
    assert.equal(submitAnswer(task, draft, id).correct, true);
  }
}

test('all ten question definitions and task references are complete and unique', () => {
  assert.deepEqual(validateQuestionDefinitions(), []);
  const ids = labs.flatMap(lab => lab.tasks.flatMap(task => task.questionIds));
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  assert.ok(ids.every(id => questions[id]));
  const bad = structuredClone(questions);
  bad['compare-reason'].options[0].id = 'b';
  bad['time-design'].correctOptionIds = ['missing'];
  bad['color-focus'].options[0].retryFeedback = '';
  assert.ok(validateQuestionDefinitions(bad).length >= 3);
});

test('single-answer evaluation is pure and rejects malformed selections', () => {
  const question = questions['compare-reason'];
  const original = JSON.stringify(question);
  assert.deepEqual(evaluateAnswer(question, ['b']), { valid: true, correct: true });
  assert.deepEqual(evaluateAnswer(question, ['a']), { valid: true, correct: false });
  for (const selected of [[], null, 'b', ['a', 'b'], ['b', 'b'], ['unknown'], [1]]) assert.equal(evaluateAnswer(question, selected).valid, false);
  assert.equal(JSON.stringify(question), original);
});

test('multiple-select requires exact set, accepts reordered keys, rejects duplicates', () => {
  const question = questions['compare-alternatives'];
  assert.equal(evaluateAnswer(question, ['b', 'a']).correct, true);
  for (const selected of [['a'], ['a', 'b', 'c'], ['c', 'd']]) assert.deepEqual(evaluateAnswer(question, selected), { valid: true, correct: false });
  for (const selected of [[], ['a', 'a'], ['x']]) assert.equal(evaluateAnswer(question, selected).valid, false);
});

test('prediction and explicit comparison evidence gate submissions', () => {
  const state = createState();
  const { task, draft } = current(state);
  const id = task.questionIds[0];
  draft.questions[id].selectedOptionIds = ['b'];
  assert.equal(recordExperiment(task, draft).accepted, false);
  assert.equal(savePrediction(draft).accepted, false);
  assert.equal(submitAnswer(task, draft, id).accepted, false);
  assert.equal(draft.questions[id].history.length, 0);
  draft.prediction = 'pie';
  assert.equal(savePrediction(draft).accepted, true);
  assert.equal(experimentComplete(task, draft), false);
  assert.equal(recordExperiment(task, draft).accepted, true);
  draft.config.labels = false;
  assert.equal(recordExperiment(task, draft).accepted, false);
  assert.equal(submitAnswer(task, draft, id).accepted, false);
  draft.config.kind = 'bar';
  assert.equal(recordExperiment(task, draft).accepted, true);
  assert.equal(experimentComplete(task, draft), true);
  assert.equal(submitAnswer(task, draft, id).correct, true);
  assert.equal(draft.prediction, 'pie'); // Wrong prediction has no effect on mastery.
});

test('wrong comparison or invalid geometry cannot unlock questions', () => {
  const state = createState();
  selectLab(state, 'misleading');
  const { task, draft } = current(state);
  draft.prediction = 'same';
  savePrediction(draft);
  draft.config.baseline = 100;
  assert.equal(recordExperiment(task, draft).accepted, false);
  draft.config.baseline = 60;
  assert.equal(recordExperiment(task, draft).accepted, false);
  assert.equal(experimentComplete(task, draft), false);
});

test('wrong-wrong-correct tracks three attempts, two errors and immutable history', () => {
  const state = createState();
  const { task, draft } = current(state);
  unlock(task, draft);
  const id = task.questionIds[0], progress = draft.questions[id];
  progress.selectedOptionIds = ['a'];
  assert.equal(questionCounts(progress).attemptCount, 0);
  assert.equal(submitAnswer(task, draft, id).correct, false);
  assert.equal(submitAnswer(task, draft, id).accepted, false); // Double submit.
  retryQuestion(progress);
  assert.equal(submitAnswer(task, draft, id).correct, false); // Intentional same answer.
  retryQuestion(progress);
  progress.selectedOptionIds = ['b'];
  assert.equal(submitAnswer(task, draft, id).correct, true);
  progress.selectedOptionIds.push('c');
  assert.deepEqual(progress.history[2].selectedOptionIds, ['b']);
  assert.deepEqual(questionCounts(progress), { attemptCount: 3, incorrectAttemptCount: 2 });
  assert.equal(progress.firstMasteredAttempt, 3);
  assert.equal(progress.masteryStatus, 'mastered');
  assert.equal(progress.history[0].experimentSnapshotIds.length, 2);
});

test('invalid answer does not count and deliberate practice never removes mastery', () => {
  const { task, draft } = current(createState());
  unlock(task, draft);
  const id = task.questionIds[0], progress = draft.questions[id];
  assert.equal(submitAnswer(task, draft, id).accepted, false);
  assert.deepEqual(questionCounts(progress), { attemptCount: 0, incorrectAttemptCount: 0 });
  progress.selectedOptionIds = ['b'];
  submitAnswer(task, draft, id);
  retryQuestion(progress);
  progress.selectedOptionIds = ['a'];
  submitAnswer(task, draft, id);
  assert.equal(progress.masteryStatus, 'mastered');
  assert.equal(progress.firstMasteredAttempt, 1);
  assert.equal(progress.history.at(-1).correct, false);
  assert.equal(questionCounts(progress).incorrectAttemptCount, 1);
});

test('incorrect feedback never labels correct subsets or exposes explanations', () => {
  const { task, draft } = current(createState());
  unlock(task, draft);
  const id = task.questionIds[1], progress = draft.questions[id];
  progress.selectedOptionIds = ['a', 'c'];
  submitAnswer(task, draft, id);
  const html = questionHtml(id, progress, 1);
  assert.match(html, /ลองทบทวน/);
  for (const option of questions[id].options) assert.ok(!html.includes(option.explanation));
  assert.ok(!html.includes('correctOptionIds'));
  retryQuestion(progress);
  progress.selectedOptionIds = ['a', 'b'];
  submitAnswer(task, draft, id);
  assert.ok(questionHtml(id, progress, 1).includes(questions[id].options[0].explanation));
});

test('all five scenarios unlock and complete without grading free text', () => {
  const state = createState();
  for (const lab of labs) for (const task of lab.tasks) {
    const draft = state.guided[lab.id][task.id];
    unlock(task, draft);
    master(task, draft);
    assert.equal(taskMastered(task, draft), true);
    assert.equal(completeTask(task, draft).accepted, false);
    draft.note = 'เหตุผลที่ครูและผู้เรียนจะพิจารณาร่วมกัน';
    if (task.secondPrompt) {
      assert.equal(completeTask(task, draft).accepted, false);
      draft.note2 = 'การปรับปรุงประเด็นที่สอง';
    }
    assert.equal(completeTask(task, draft).accepted, true);
  }
  assert.equal(completedLabs(state), 4);
  assert.deepEqual(buildLearningSummary(state).totals, { questionCount: 10, masteredQuestionCount: 10, taskCount: 5, completedTaskCount: 5, labCount: 4, completedLabCount: 4, attemptCount: 10, incorrectAttemptCount: 0 });
});

test('mastery is separate from current chart validation and historical completion', () => {
  const { task, draft } = current(createState());
  unlock(task, draft);
  master(task, draft);
  draft.note = 'ข้อความเดิม';
  draft.config.kind = 'pie';
  assert.equal(completeTask(task, draft).accepted, false);
  assert.equal(taskMastered(task, draft), true);
  draft.config.kind = 'dot';
  completeTask(task, draft);
  draft.note = 'แก้ข้อความ';
  draft.config.kind = 'line';
  draft.experiments[0].config.kind = 'bar';
  assert.equal(draft.completion.config.kind, 'dot');
  assert.equal(draft.completion.reflections[0], 'ข้อความเดิม');
  assert.equal(draft.completion.experiments[0].config.kind, 'pie');
  assert.equal(completeTask(task, draft).accepted, false);
  assert.equal(draft.completionFeedback.retainedEvidence, true);
  assert.equal(draft.completion.reflections[0], 'ข้อความเดิม');
});

test('chart reset retains evidence and mastery; guided reset leaves free untouched', () => {
  const state = createState(), { task, draft } = current(state);
  unlock(task, draft);
  master(task, draft);
  draft.note = 'บันทึกเดิม';
  completeTask(task, draft);
  const experiments = JSON.stringify(draft.experiments);
  resetChart(task, draft);
  assert.equal(draft.config.kind, 'pie');
  assert.equal(draft.note, 'บันทึกเดิม');
  assert.equal(JSON.stringify(draft.experiments), experiments);
  assert.equal(taskMastered(task, draft), true);
  assert.ok(draft.completion);
  state.free.dataset.rows[0].value = 999;
  const free = JSON.stringify(state.free);
  resetGuided(state);
  const fresh = current(state).draft;
  assert.equal(fresh.predictionSaved, false);
  assert.equal(fresh.note, '');
  assert.equal(fresh.experiments.length, 0);
  assert.equal(fresh.completion, null);
  assert.equal(taskMastered(task, fresh), false);
  assert.equal(JSON.stringify(state.free), free);
});

test('navigation preserves independent drafts by stable task IDs', () => {
  const state = createState();
  current(state).draft.note = 'ข้อความเดิม';
  current(state).draft.config.kind = 'dot';
  state.mode = 'free';
  state.free.config.kind = 'line';
  selectLab(state, 'misleading');
  assert.equal(current(state).draft.config.baseline, 70);
  selectLab(state, 'choose');
  assert.equal(current(state).draft.note, 'ข้อความเดิม');
  assert.equal(current(state).draft.config.kind, 'dot');
});

test('summary is deterministic, identity-free and includes unstarted questions', () => {
  const state = createState(), { task, draft } = current(state);
  assert.equal(buildLearningSummary(state).totals.questionCount, 10);
  unlock(task, draft);
  const id = task.questionIds[0], progress = draft.questions[id];
  progress.selectedOptionIds = ['a'];
  submitAnswer(task, draft, id);
  const unfinished = buildLearningSummary(state);
  assert.equal(unfinished.questionsNeedingPractice.length, 1);
  assert.equal(unfinished.repeatedAttemptQuestions.length, 1);
  retryQuestion(progress);
  progress.selectedOptionIds = ['b'];
  submitAnswer(task, draft, id);
  draft.note = 'PRIVATE_REFLECTION';
  const before = JSON.stringify(state);
  const summary = buildLearningSummary(state);
  assert.equal(summary.questionsNeedingPractice.length, 0);
  assert.equal(summary.repeatedAttemptQuestions.length, 1);
  assert.deepEqual(summary, buildLearningSummary(state));
  assert.equal(JSON.stringify(state), before);
  const json = JSON.stringify(summary);
  for (const forbidden of ['PRIVATE_REFLECTION', 'correctOptionIds', 'selectedOptionIds', 'history', 'studentId', 'email', 'prediction']) assert.ok(!json.includes(forbidden));
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.integrity, 'browser-unverified');
});

test('redesign accepts dot charts on a clearly specified range', () => {
  const task = labs.find(lab => lab.id === 'redesign').tasks[0];
  assert.equal(evaluateDesign(task, { ...task.config, kind: 'dot', palette: 'uniform', baseline: 70 }).passed, true);
});
