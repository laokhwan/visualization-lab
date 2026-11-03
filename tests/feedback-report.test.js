import test from 'node:test';
import assert from 'node:assert/strict';
import { hints } from '../src/content/hints.js';
import { questions } from '../src/content/questions.js';
import { createState } from '../src/state.js';
import { adaptiveFeedback, requestHint } from '../src/learning/feedback.js';
import { createQuestionProgress } from '../src/learning/practice.js';
import { buildLearningReport, reportWarning } from '../src/report/model.js';
import { buildPdfDefinition, exportChartSvg } from '../src/report/pdf.js';
import { prepareTask } from './helpers/learning.js';

test('all 34 questions have three levels and repeated answers receive new guidance', () => {
  for (const id of Object.keys(questions)) assert.equal(hints[id].length, 3);
  const progress = createQuestionProgress(), question = questions['compare-reason'];
  for (let i = 1; i <= 5; i++) {
    progress.history.push({ correct: false, selectedOptionIds: ['a'] });
    const result = adaptiveFeedback(question, progress);
    assert.equal(result.level, Math.min(3, i));
    if (i > 1) assert.equal(result.repeated, true);
    for (const option of question.options) assert.ok(!result.messages.includes(option.explanation));
  }
});

test('manual hints do not count attempts; a correct answer ends the struggle streak', () => {
  const progress = createQuestionProgress(), question = questions['compare-alternatives'];
  progress.history.push({ correct: false, selectedOptionIds: ['a'] });
  requestHint(progress);
  assert.equal(adaptiveFeedback(question, progress).level, 2);
  requestHint(progress);
  assert.equal(adaptiveFeedback(question, progress).level, 3);
  assert.equal(progress.history.length, 1);
  progress.history.push({ correct: true, selectedOptionIds: ['a', 'b'] });
  progress.requestedHintLevel = 0;
  progress.history.push({ correct: false, selectedOptionIds: ['c'] });
  assert.equal(adaptiveFeedback(question, progress).level, 1);
});

test('report uses frozen completed evidence, excludes drafts and Free by default', () => {
  const state = createState(); const { draft } = prepareTask(state);
  draft.note = 'UNSAVED_DRAFT'; draft.config.kind = 'line'; state.free.dataset.title = 'FREE_PRIVATE';
  state.guided.color.focus.note = 'OTHER_DRAFT';
  const report = buildLearningReport(state, { generatedAt: '2026-11-03T03:00:00Z' });
  assert.equal(report.reportSchemaVersion, 2);
  assert.equal(report.evidence[0].finalChart.config.kind, 'bar');
  assert.equal(report.evidence[0].reflectionEvaluation, 'not-evaluated');
  const json = JSON.stringify(report);
  for (const forbidden of ['UNSAVED_DRAFT', 'OTHER_DRAFT', 'FREE_PRIVATE', 'correctOptionIds', 'selectedOptionIds', 'email', 'studentId']) assert.ok(!json.includes(forbidden));
  assert.ok(JSON.stringify(buildLearningReport(state, { includeDrafts: true })).includes('OTHER_DRAFT'));
  state.guided.choose.compare.completion.reflections[0] = 'CHANGED_LATER';
  assert.ok(!JSON.stringify(report).includes('CHANGED_LATER'));
});

test('PDF definition includes warnings, all questions and standalone styled chart SVG', () => {
  const state = createState(); prepareTask(state);
  const definition = buildPdfDefinition(buildLearningReport(state));
  assert.equal(definition.pageSize, 'A4');
  assert.equal(definition.defaultStyle.font, 'Sarabun');
  assert.ok(JSON.stringify(definition.footer(1, 2)).includes(reportWarning));
  const contents = JSON.stringify(definition.content);
  for (const question of Object.values(questions)) assert.ok(contents.includes(question.prompt));
  const svg = exportChartSvg(state.guided.choose.compare.completion, 'export');
  assert.match(svg, /font-family:Sarabun/);
  assert.doesNotMatch(svg, /var\(--|tabindex|data-point|aria-/);
  assert.equal(buildPdfDefinition(buildLearningReport(createState())).content.filter(item => item.pageBreak === 'before').length, 0);
});
