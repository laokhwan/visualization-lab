import { datasets } from '../content/datasets.js';
import { validateChart } from '../charts/validation.js';

export function evaluate(task, draft) {
  const criteria = task.criteria.map(rule => ({
    label: rule.label,
    hint: rule.hint,
    passed: rule.test === 'honestAxis'
      ? draft.config.kind !== 'bar' || draft.config.baseline === 0
      : rule.values.includes(draft.config[rule.key]),
  }));
  const errors = validateChart(datasets[task.dataset], draft.config);
  criteria.push({ label: 'ช่วงแกนและข้อมูลแสดงได้ถูกต้อง', passed: errors.length === 0, hint: errors.join(' · ') });
  criteria.push({ label: 'บันทึกการคาดการณ์ก่อนสรุปผล', passed: Boolean(draft.prediction.trim()), hint: 'บันทึกสิ่งที่คาดไว้ คำคาดการณ์ไม่จำเป็นต้องถูกต้อง' });
  criteria.push({ label: 'เขียนคำอธิบายจากการทดลอง', passed: Boolean(draft.note.trim()), hint: 'อธิบายสิ่งที่สังเกตและเหตุผลของการเลือก' });
  if (task.secondPrompt) criteria.push({ label: 'เขียนคำอธิบายประเด็นที่ 2', passed: Boolean(draft.note2.trim()), hint: 'ระบุการปรับปรุงอีกประเด็นและผลต่อการตีความ' });
  return { passed: criteria.every(item => item.passed), criteria };
}

export function submit(task, draft) {
  draft.attempts += 1;
  draft.feedback = evaluate(task, draft);
  draft.dirty = false;
  if (draft.feedback.passed) draft.everPassed = true;
  return draft.feedback;
}
