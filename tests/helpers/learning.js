import { labs } from '../../src/content/labs.js';
import { questions } from '../../src/content/questions.js';
import { savePrediction, recordExperiment } from '../../src/learning/experiments.js';
import { submitAnswer, completeTask } from '../../src/learning/practice.js';

export function prepareTask(state, labId = 'choose', taskId = 'compare', { complete = true, longText = false } = {}) {
  const task = labs.find(lab => lab.id === labId).tasks.find(task => task.id === taskId);
  const draft = state.guided[labId][taskId];
  draft.prediction = task.prediction === 'text' ? 'ปรับแกนและสีเพื่อเปรียบเทียบข้อมูล' : task.prediction === 'color' ? 'uniform' : task.prediction === 'axis' ? 'same' : 'pie';
  savePrediction(draft);
  for (const slot of task.experiment) {
    if (slot.design) Object.assign(draft.config, { kind: 'dot', palette: 'uniform', baseline: 70 });
    else for (const [key, values] of Object.entries(slot.match)) draft.config[key] = values[0];
    recordExperiment(task, draft);
  }
  for (const id of task.questionIds) { draft.questions[id].selectedOptionIds = [...questions[id].correctOptionIds]; submitAnswer(task, draft, id); }
  draft.note = 'สังเกตว่ารูปแบบการนำเสนอเปลี่ยนการรับรู้ แต่ค่าข้อมูลไม่เปลี่ยน จึงควรตรวจแกน หน่วย และวัตถุประสงค์ก่อนตีความ';
  if (longText) draft.note = (draft.note + ' ').repeat(14).slice(0, 1950);
  draft.note2 = 'ใช้สีอย่างมีความหมายและระบุหน่วยให้ชัดเจน เพื่อให้ผู้อ่านเปรียบเทียบข้อมูลได้อย่างเหมาะสม';
  if (complete) completeTask(task, draft);
  return { task, draft };
}
