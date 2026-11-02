import { copyDataset, datasets } from '../content/datasets.js';
import { validateChart } from '../charts/validation.js';
import { evaluateDesign } from './evaluate.js';

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
  const slot = task.experiment.find(item => item.design
    ? evaluateDesign(task, draft.config).passed
    : Object.entries(item.match).every(([key, values]) => values.includes(draft.config[key])));
  if (!slot) return { accepted: false, message: 'รูปแบบนี้ยังไม่ตรงกับคู่เปรียบเทียบ โปรดตรวจรายการที่ต้องบันทึก' };
  if (draft.experiments.some(snapshot => snapshot.slotId === slot.id)) return { accepted: false, message: 'บันทึกรูปแบบนี้แล้ว ลองรูปแบบอื่นในรายการ การเปลี่ยนเฉพาะป้ายตัวเลขไม่นับเป็นรูปแบบใหม่' };
  draft.experiments.push({ id: `${task.id}:${slot.id}`, slotId: slot.id, label: slot.label, config: { ...draft.config }, dataset: copyDataset(task.dataset) });
  return { accepted: true, message: `บันทึก${slot.label}แล้ว (${draft.experiments.length}/${task.experiment.length})` };
}
