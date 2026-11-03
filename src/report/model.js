import { labs, predictions } from '../content/labs.js';
import { th } from '../content/locales/th.js';
import { buildLearningSummary } from '../learning/report.js';

export const reportWarning = 'ผลจากเบราว์เซอร์สามารถแก้ไขได้ ไม่ใช่ผลการเรียนที่ผ่านการยืนยัน';

export function buildLearningReport(state, { includeDrafts = false, generatedAt = new Date().toISOString() } = {}) {
  const evidence = labs.flatMap(lab => lab.tasks.map(task => {
    const draft = state.guided[lab.id][task.id];
    const saved = draft.completion;
    const prediction = saved?.prediction ?? (includeDrafts ? draft.prediction : '');
    const predictionText = !prediction ? '' : task.prediction === 'text' ? prediction : (predictions[task.prediction] || th.prediction).find(([id]) => id === prediction)?.[1] || prediction;
    return {
      labId: lab.id, taskId: task.id, labTitle: lab.title, mission: task.mission,
      source: saved ? 'completed' : 'in-progress',
      experiments: saved?.experiments || draft.experiments,
      finalChart: saved ? { config: saved.config, dataset: saved.dataset } : null,
      prediction: predictionText,
      reflections: saved?.reflections || (includeDrafts ? [draft.note, ...(task.secondPrompt ? [draft.note2] : [])] : []),
      reflectionEvaluation: 'not-evaluated',
    };
  }));
  return structuredClone({ reportSchemaVersion: 1, generatedAt, contentVersion: buildLearningSummary(state).contentVersion, integrity: 'browser-unverified', includeDrafts, summary: buildLearningSummary(state), evidence });
}
