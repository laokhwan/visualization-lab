import { labs } from '../../src/content/labs.js';
import { questions } from '../../src/content/questions.js';
import { savePrediction, recordExperiment } from '../../src/learning/experiments.js';
import { submitAnswer, completeTask } from '../../src/learning/practice.js';
import { setPath } from '../../src/data/config.js';

export function prepareExperiments(task,draft) {
  for (const [index,slot] of task.experiment.entries()) {
    if (slot.design) Object.assign(draft.config, task.id === 'redesign-distribution' ? {kind:'histogram'} : task.id === 'redesign-time-context' ? {presentation:'small-multiples'} : {kind:'dot',palette:'uniform',baseline:70});
    else for (const [key,values] of Object.entries(slot.match)) setPath(draft.config,key,values[0]);
    if (index && slot.distinct?.includes('histogram')) draft.config.histogram.count += 3;
    const result=recordExperiment(task,draft);
    if (!result.accepted) throw new Error(`${task.id}/${slot.id}: ${result.message}`);
  }
}

export function prepareTask(state, labId = 'choose', taskId = 'compare', { complete = true, longText = false } = {}) {
  const task = labs.find(lab => lab.id === labId).tasks.find(task => task.id === taskId);
  const draft = state.guided[labId][taskId];
  draft.prediction = task.prediction === 'text' ? 'ปรับแกนและสีเพื่อเปรียบเทียบข้อมูล' : task.prediction === 'color' ? 'uniform' : task.prediction === 'axis' ? 'same' : 'pie';
  savePrediction(draft);
  prepareExperiments(task,draft);
  for (const id of task.questionIds) { draft.questions[id].selectedOptionIds = [...questions[id].correctOptionIds]; submitAnswer(task, draft, id); }
  draft.note = 'สังเกตว่ารูปแบบการนำเสนอเปลี่ยนการรับรู้ แต่ค่าข้อมูลไม่เปลี่ยน จึงควรตรวจแกน หน่วย และวัตถุประสงค์ก่อนตีความ';
  if (longText) draft.note = (draft.note + ' ').repeat(14).slice(0, 1950);
  draft.note2 = 'ใช้สีอย่างมีความหมายและระบุหน่วยให้ชัดเจน เพื่อให้ผู้อ่านเปรียบเทียบข้อมูลได้อย่างเหมาะสม';
  if (complete) completeTask(task, draft);
  return { task, draft };
}
