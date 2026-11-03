import { labs, predictions } from '../content/labs.js';
import { datasets } from '../content/datasets.js';
import { questions, contentVersion } from '../content/questions.js';
import { th } from '../content/locales/th.js';
import { createState, createDraft } from '../state.js';
import { recordExperiment, savePrediction } from '../learning/experiments.js';
import { submitAnswer, completeTask } from '../learning/practice.js';

export const storageSchemaVersion = 1;
// Increment when a non-declarative assessment algorithm changes.
const assessmentEngineVersion = 1;
export const taskAssessmentVersions = { 'choose/compare': 1, 'choose/time': 1, 'color/focus': 1, 'misleading/axis': 1, 'redesign/revision': 1 };
export const taskKey = (lab, task) => `${lab.id}/${task.id}`;
const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.length <= max ? value : fail('ข้อความไม่ถูกต้อง');

function fingerprint(value) {
  let hash = 2166136261;
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

export function assessmentManifest() {
  return Object.fromEntries(labs.flatMap(lab => lab.tasks.map(task => [taskKey(lab, task), {
    assessmentVersion: taskAssessmentVersions[taskKey(lab, task)],
    fingerprint: fingerprint({ engine: assessmentEngineVersion, dataset: datasets[task.dataset], config: task.config, criteria: task.criteria, experiment: task.experiment, prompt: task.prompt, secondPrompt: task.secondPrompt, prediction: task.prediction, questions: task.questionIds.map(id => {
      const { version, type, prompt, options, correctOptionIds } = questions[id];
      return { id, version, type, prompt, options: options.map(({ id, text }) => ({ id, text })), correctOptionIds };
    }) }),
  }])));
}

export function validConfig(raw, task, draft = false) {
  if (!object(raw) || !['bar', 'line', 'dot', 'pie'].includes(raw.kind) || !['uniform', 'highlight', 'categorical'].includes(raw.palette) || typeof raw.labels !== 'boolean' || !Number.isInteger(raw.highlight) || raw.highlight < 0 || raw.highlight >= datasets[task.dataset].rows.length) fail('การตั้งค่ากราฟไม่ถูกต้อง');
  const number = value => Number.isFinite(value) && Math.abs(value) <= 1e6;
  if (!(number(raw.baseline) || (draft && Number.isNaN(raw.baseline))) || !(raw.upper === null || number(raw.upper) || (draft && Number.isNaN(raw.upper)))) fail('ช่วงแกนไม่ถูกต้อง');
  return { kind: raw.kind, palette: raw.palette, highlight: raw.highlight, labels: raw.labels, baseline: raw.baseline, upper: raw.upper };
}

function prediction(raw, task) {
  const value = text(raw, 1000);
  if (task.prediction !== 'text' && !(predictions[task.prediction] || th.prediction).some(([id]) => id === value)) fail('คำคาดการณ์ไม่ถูกต้อง');
  return value;
}

export function restoreTask(task, raw) {
  if (!object(raw) || !Array.isArray(raw.experiments) || raw.experiments.length > task.experiment.length || !object(raw.questions) || typeof raw.predictionSaved !== 'boolean') fail('โครงสร้างสถานการณ์ไม่ถูกต้อง');
  const draft = createDraft(task);
  draft.prediction = prediction(raw.prediction, task);
  if (raw.predictionSaved && !savePrediction(draft).accepted) fail('คำคาดการณ์ว่าง');
  draft.note = text(raw.note, 2000);
  draft.note2 = text(raw.note2, 2000);
  for (const snapshot of raw.experiments) {
    if (!object(snapshot) || JSON.stringify(snapshot.dataset) !== JSON.stringify(datasets[task.dataset])) fail('ชุดข้อมูลของหลักฐานไม่ตรงกับเนื้อหา');
    draft.config = validConfig(snapshot.config, task);
    if (!recordExperiment(task, draft).accepted || draft.experiments.at(-1).id !== snapshot.id || draft.experiments.at(-1).slotId !== snapshot.slotId) fail('หลักฐานเปรียบเทียบไม่ถูกต้อง');
  }
  for (const id of task.questionIds) {
    const saved = raw.questions[id], progress = draft.questions[id];
    if (!object(saved) || !Array.isArray(saved.history) || !Array.isArray(saved.selectedOptionIds) || typeof saved.editing !== 'boolean') fail('ประวัติคำถามไม่ถูกต้อง');
    for (const [index, attempt] of saved.history.entries()) {
      if (!object(attempt) || attempt.attemptNumber !== index + 1 || !Array.isArray(attempt.experimentSnapshotIds) || JSON.stringify([...attempt.experimentSnapshotIds].sort()) !== JSON.stringify(draft.experiments.map(item => item.id).sort())) fail('ลำดับครั้งหรือการอ้างอิงหลักฐานไม่ถูกต้อง');
      progress.editing = true;
      progress.selectedOptionIds = attempt.selectedOptionIds;
      // Never trust persisted correctness, counts, or mastery flags.
      if (!submitAnswer(task, draft, id).accepted) fail('คำตอบที่บันทึกไม่ถูกต้องตามรูปแบบ');
    }
    if (new Set(saved.selectedOptionIds).size !== saved.selectedOptionIds.length || saved.selectedOptionIds.some(optionId => !questions[id].options.some(option => option.id === optionId)) || (questions[id].type === 'single' && saved.selectedOptionIds.length > 1)) fail('ตัวเลือกฉบับร่างไม่ถูกต้อง');
    if (!saved.editing && !progress.history.length) fail('สถานะส่งคำตอบไม่ถูกต้อง');
    if (!saved.editing && JSON.stringify(saved.selectedOptionIds) !== JSON.stringify(progress.history.at(-1).selectedOptionIds)) fail('คำตอบล่าสุดไม่ตรงกับประวัติ');
    progress.selectedOptionIds = [...saved.selectedOptionIds];
    progress.editing = saved.editing;
    progress.requestedHintLevel = Number.isInteger(saved.requestedHintLevel) && saved.requestedHintLevel >= 0 && saved.requestedHintLevel <= 3 ? saved.requestedHintLevel : 0;
  }
  if (raw.completion !== null) {
    const saved = raw.completion;
    if (!object(saved) || !object(saved.questionAttemptNumbers) || JSON.stringify(saved.dataset) !== JSON.stringify(datasets[task.dataset]) || !Array.isArray(saved.reflections) || saved.reflections.length !== (task.secondPrompt ? 2 : 1) || saved.prediction !== draft.prediction || JSON.stringify(saved.experiments) !== JSON.stringify(draft.experiments)) fail('หลักฐานเมื่อทำครบไม่ถูกต้อง');
    const checkpoint = structuredClone(draft);
    checkpoint.config = validConfig(saved.config, task);
    checkpoint.note = text(saved.reflections[0], 2000);
    checkpoint.note2 = task.secondPrompt ? text(saved.reflections[1], 2000) : '';
    for (const id of task.questionIds) {
      const count = saved.questionAttemptNumbers[id];
      if (!Number.isInteger(count) || count < 1 || count > draft.questions[id].history.length) fail('จุดบันทึกประวัติไม่ถูกต้อง');
      const progress = checkpoint.questions[id];
      progress.history = progress.history.slice(0, count);
      progress.masteryStatus = progress.history.some(item => item.correct) ? 'mastered' : 'not-mastered';
    }
    if (!completeTask(task, checkpoint).accepted) fail('หลักฐานไม่ผ่านเงื่อนไขการทำครบ');
    draft.completion = checkpoint.completion;
  }
  draft.config = validConfig(raw.config, task, true);
  return draft;
}

export function serializeProgress(state) {
  const records = {};
  for (const lab of labs) for (const task of lab.tasks) {
    const draft = structuredClone(state.guided[lab.id][task.id]);
    draft.completionFeedback = null;
    for (const progress of Object.values(draft.questions)) progress.validationMessage = '';
    records[taskKey(lab, task)] = draft;
  }
  return { storageSchemaVersion, contentVersion, assessmentManifest: assessmentManifest(), updatedAt: new Date().toISOString(), lastLocation: { labId: state.labId, taskId: labs.find(lab => lab.id === state.labId).tasks[state.taskIndex].id }, tasks: records };
}

export function restoreProgress(payload) {
  if (!object(payload) || !Number.isInteger(payload.storageSchemaVersion)) return { status: 'corrupt', blocked: true, warnings: ['โครงสร้างข้อมูลที่บันทึกไม่ถูกต้อง'] };
  if (payload.storageSchemaVersion !== storageSchemaVersion) return { status: 'unsupported', blocked: true, warnings: ['รุ่นข้อมูลนี้ยังไม่รองรับ จึงไม่เขียนทับข้อมูลเดิม'] };
  if (!object(payload.tasks) || !object(payload.assessmentManifest)) return { status: 'corrupt', blocked: true, warnings: ['ไม่พบข้อมูลสถานการณ์'] };
  if (payload.revision !== undefined && (!Number.isSafeInteger(payload.revision) || payload.revision < 0)) return { status: 'corrupt', blocked: true, warnings: ['revision ของข้อมูลไม่ถูกต้อง'] };
  const state = createState(), manifest = assessmentManifest(), issues = [];
  for (const lab of labs) for (const task of lab.tasks) {
    const key = taskKey(lab, task);
    if (JSON.stringify(payload.assessmentManifest[key]) !== JSON.stringify(manifest[key])) {
      issues.push({ key, reason: 'content', message: `${lab.title}: เนื้อหาหรือเกณฑ์เปลี่ยน ต้องเริ่มสถานการณ์นี้ใหม่` });
      continue;
    }
    try {
      if (payload.historyCounts && task.questionIds.some(id => payload.historyCounts[`${key}/${id}`] !== payload.tasks[key]?.questions?.[id]?.history?.length)) fail('จำนวนประวัติไม่ครบ');
      state.guided[lab.id][task.id] = restoreTask(task, payload.tasks[key]);
    }
    catch { issues.push({ key, reason: 'corrupt', message: `${lab.title}: อ่านข้อมูลสถานการณ์นี้ไม่ได้` }); }
  }
  const lab = labs.find(item => item.id === payload.lastLocation?.labId);
  const index = lab?.tasks.findIndex(task => task.id === payload.lastLocation?.taskId);
  if (lab && index >= 0) { state.labId = lab.id; state.taskIndex = index; }
  return { status: issues.length ? 'partial' : 'restored', blocked: issues.length > 0, state, issues, warnings: issues.map(item => item.message) };
}
