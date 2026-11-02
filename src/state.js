import { labs } from './content/labs.js';
import { copyDataset } from './content/datasets.js';

export function createDraft(task) {
  return { config: { ...task.config }, prediction: '', note: '', note2: '', attempts: 0, everPassed: false, feedback: null, dirty: false };
}

export function createState() {
  return {
    mode: 'guided', labId: labs[0].id, taskIndex: 0,
    guided: Object.fromEntries(labs.map(lab => [lab.id, lab.tasks.map(createDraft)])),
    free: { dataset: copyDataset('groups'), config: { kind: 'bar', palette: 'uniform', highlight: 2, labels: true, baseline: 0, upper: null } },
  };
}

export function current(state) {
  const lab = labs.find(item => item.id === state.labId);
  const task = lab.tasks[state.taskIndex];
  return { lab, task, draft: state.guided[lab.id][state.taskIndex] };
}

export function selectLab(state, id) {
  if (!labs.some(lab => lab.id === id)) return;
  state.mode = 'guided';
  state.labId = id;
  state.taskIndex = 0;
}

export function completedLabs(state) {
  return labs.filter(lab => state.guided[lab.id].every(draft => draft.everPassed)).length;
}

export function markChanged(draft) {
  if (draft.feedback) draft.dirty = true;
}
