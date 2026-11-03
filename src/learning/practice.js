import { questions } from '../content/questions.js';
import { copyDataset, datasets } from '../content/datasets.js';
import { snapshotConfig } from '../data/config.js';
import { evaluateAnswer, evaluateDesign } from './evaluate.js';
import { experimentComplete } from './experiments.js';

export function createQuestionProgress() {
  return { selectedOptionIds: [], masteryStatus: 'not-mastered', firstMasteredAttempt: null, history: [], editing: true, requestedHintLevel: 0, validationMessage: '' };
}

export function questionCounts(progress) {
  return { attemptCount: progress.history.length, incorrectAttemptCount: progress.history.filter(attempt => !attempt.correct).length };
}

export function taskMastered(task, draft) {
  return task.questionIds.every(id => draft.questions[id].masteryStatus === 'mastered');
}

export function submitAnswer(task, draft, questionId) {
  const question = questions[questionId];
  const progress = draft.questions[questionId];
  if (!question || !progress || !task.questionIds.includes(questionId)) return { accepted: false, message: 'ไม่พบคำถาม' };
  if (!experimentComplete(task, draft) || !draft.predictionSaved) return { accepted: false, message: 'บันทึกการทดลองให้ครบก่อนตอบคำถาม' };
  if (!progress.editing) return { accepted: false, message: 'กดลองอีกครั้งก่อนส่งคำตอบใหม่' };
  const result = evaluateAnswer(question, progress.selectedOptionIds);
  if (!result.valid) {
    progress.validationMessage = result.message;
    return { accepted: false, message: result.message };
  }
  const attemptNumber = progress.history.length + 1;
  progress.history.push({ attemptNumber, selectedOptionIds: [...progress.selectedOptionIds], correct: result.correct, experimentSnapshotIds: draft.experiments.map(snapshot => snapshot.id) });
  progress.validationMessage = '';
  progress.editing = false;
  if (result.correct) progress.requestedHintLevel = 0;
  if (result.correct && progress.masteryStatus !== 'mastered') {
    progress.masteryStatus = 'mastered';
    progress.firstMasteredAttempt = attemptNumber;
  }
  return { accepted: true, correct: result.correct };
}

export function retryQuestion(progress) {
  if (!progress.history.length) return;
  progress.editing = true;
  progress.validationMessage = '';
}

export function completionCriteria(task, draft) {
  return [
    { label: 'บันทึกคำคาดการณ์', passed: draft.predictionSaved },
    { label: 'บันทึกกราฟเปรียบเทียบครบ 2 รูปแบบ', passed: experimentComplete(task, draft) },
    { label: 'ผ่านคำถามประเมินครบทุกข้อ', passed: taskMastered(task, draft) },
    ...evaluateDesign(task, draft.config).criteria,
    { label: 'กรอกสะท้อนคิดประเด็นที่ 1 (ยังไม่ประเมินเหตุผล)', passed: Boolean(draft.note.trim()) },
    ...(task.secondPrompt ? [{ label: 'กรอกสะท้อนคิดประเด็นที่ 2 (ยังไม่ประเมินเหตุผล)', passed: Boolean(draft.note2.trim()) }] : []),
  ];
}

export function completeTask(task, draft) {
  const criteria = completionCriteria(task, draft);
  const passed = criteria.every(item => item.passed);
  draft.completionFeedback = { passed, criteria, retainedEvidence: Boolean(draft.completion) };
  if (!passed) return { accepted: false, criteria };
  // Completion is historical: subsequent experiments cannot rewrite this evidence.
  if (!draft.completion) {
    draft.completion = {
      config: snapshotConfig(datasets[task.dataset],draft.config), dataset: copyDataset(task.dataset), prediction: draft.prediction,
      questionAttemptNumbers: Object.fromEntries(task.questionIds.map(id => [id, draft.questions[id].history.length])),
      reflections: [draft.note, ...(task.secondPrompt ? [draft.note2] : [])],
      experiments: structuredClone(draft.experiments),
    };
  }
  return { accepted: true, criteria };
}
