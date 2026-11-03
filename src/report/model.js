import { labs, predictions } from '../content/labs.js';
import { th } from '../content/locales/th.js';
import { buildLearningSummary } from '../learning/report.js';
import { isResearch } from '../data/view.js';
import { researchAnalysis } from '../charts/research.js';

export const reportWarning = 'ผลจากเบราว์เซอร์สามารถแก้ไขได้ ไม่ใช่ผลการเรียนที่ผ่านการยืนยัน';

export function buildLearningReport(state, { includeDrafts = false, generatedAt = new Date().toISOString(), labIds = labs.map(lab=>lab.id) } = {}) {
  const evidence = labs.filter(lab=>labIds.includes(lab.id)).flatMap(lab => lab.tasks.map(task => {
    const draft = state.guided[lab.id][task.id];
    const saved = draft.completion;
    const prediction = saved?.prediction ?? (includeDrafts ? draft.prediction : '');
    const predictionText = !prediction ? '' : task.prediction === 'text' ? prediction : (predictions[task.prediction] || th.prediction).find(([id]) => id === prediction)?.[1] || prediction;
    return {
      labId: lab.id, taskId: task.id, labTitle: lab.title, taskTitle: task.title || task.mission, section: task.section || 'foundation', mission: task.mission,
      source: saved ? 'completed' : 'in-progress',
      experiments: (saved?.experiments || draft.experiments).map(snapshot=>({...snapshot,...(isResearch(snapshot.dataset)?{analysis:researchAnalysis(snapshot.dataset,snapshot.config)}:{})})),
      finalChart: saved ? { config: saved.config, dataset: saved.dataset, ...(isResearch(saved.dataset)?{analysis:researchAnalysis(saved.dataset,saved.config)}:{}) } : null,
      prediction: predictionText,
      reflections: saved?.reflections || (includeDrafts ? [draft.note, ...(task.secondPrompt ? [draft.note2] : [])] : []),
      reflectionEvaluation: 'not-evaluated',
    };
  }));
  return structuredClone({ reportSchemaVersion: 2, generatedAt, contentVersion: buildLearningSummary(state).contentVersion, integrity: 'browser-unverified', includeDrafts, evidenceLabIds:labIds, summary: buildLearningSummary(state), evidence });
}
