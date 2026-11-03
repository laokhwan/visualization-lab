import { copyDataset, datasets } from '../content/datasets.js';
import { validateChart } from '../charts/validation.js';
import { evaluateDesign } from './evaluate.js';
import { getPath, distinctConfig, snapshotConfig } from '../data/config.js';
import { calculationVersion, computeHistogram } from '../statistics/distribution.js';
import { dataView } from '../data/view.js';

export function experimentComplete(task, draft) {
  return task.experiment.every(slot => draft.experiments.some(snapshot => snapshot.slotId === slot.id));
}

export function savePrediction(draft) {
  if (draft.predictionSaved) return { accepted: false, message: 'บันทึกคำคาดการณ์แล้ว' };
  if (!draft.prediction.trim()) return { accepted: false, message: 'บันทึกคำคาดการณ์ก่อนทดลอง' };
  draft.predictionSaved = true;
  return { accepted: true, message: 'บันทึกคำคาดการณ์แล้ว คำคาดการณ์ไม่ถูกให้คะแนน' };
}

export function recordExperiment(task, draft) {
  if (!draft.predictionSaved) return { accepted: false, message: 'บันทึกคำคาดการณ์ก่อนบันทึกการทดลอง' };
  const errors = validateChart(datasets[task.dataset], draft.config);
  if (errors.length) return { accepted: false, message: errors.join(' · ') };
  const matches = item => (item.design
    ? evaluateDesign(task, draft.config).passed
    : Object.entries(item.match).every(([key, values]) => values.includes(getPath(draft.config, key))))
    && (!item.distinct?.length || draft.experiments.every(saved => {
      if (item.distinct.includes('histogram')) {
        const values = dataView(datasets[task.dataset],draft.config).rows.map(r=>r.value);
        return JSON.stringify(computeHistogram(values,saved.config.histogram).edges) !== JSON.stringify(computeHistogram(values,draft.config.histogram).edges);
      }
      return distinctConfig(saved.config, draft.config, item.distinct);
    }));
  const slot = task.experiment.find(item => !draft.experiments.some(saved => saved.slotId === item.id) && matches(item));
  if (!slot) return { accepted: false, message: 'บันทึกรูปแบบนี้แล้ว หรือยังไม่ตรงกับคู่เปรียบเทียบ ลองรูปแบบอื่นในรายการ การเปลี่ยนเฉพาะป้ายตัวเลขไม่นับเป็นรูปแบบใหม่' };
  draft.experiments.push({ id: `${task.id}:${slot.id}`, slotId: slot.id, label: slot.label, config: snapshotConfig(datasets[task.dataset],draft.config), dataset: copyDataset(task.dataset), ...(task.section === 'extension' ? { calculationVersion } : {}) });
  return { accepted: true, message: `บันทึก${slot.label}แล้ว (${draft.experiments.length}/${task.experiment.length})` };
}
