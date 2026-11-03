import { datasets } from '../content/datasets.js';
import { validateChart } from '../charts/validation.js';
import { designRule } from './design-rules.js';

export function evaluateDesign(task, config) {
  const criteria = task.criteria.map(rule => ({
    label: rule.label,
    hint: rule.hint,
    passed: rule.test === 'honestAxis'
      ? config.kind !== 'bar' || config.baseline === 0
      : rule.test ? designRule(rule.test, datasets[task.dataset], config) : rule.values.includes(config[rule.key]),
  }));
  const errors = validateChart(datasets[task.dataset], config);
  criteria.push({ label: 'ช่วงแกนและข้อมูลแสดงได้ถูกต้อง', passed: errors.length === 0, hint: errors.join(' · ') });
  return { passed: criteria.every(item => item.passed), criteria };
}

export function evaluateAnswer(question, selectedIds) {
  if (!Array.isArray(selectedIds) || !selectedIds.length || new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !question.options.some(option => option.id === id)) || (question.type === 'single' && selectedIds.length !== 1)) {
    return { valid: false, correct: false, message: question.type === 'single' ? 'เลือกคำตอบ 1 ข้อก่อนส่ง' : 'เลือกคำตอบอย่างน้อย 1 ข้อ โดยไม่เลือกซ้ำ' };
  }
  const correct = selectedIds.length === question.correctOptionIds.length && question.correctOptionIds.every(id => selectedIds.includes(id));
  return { valid: true, correct };
}
