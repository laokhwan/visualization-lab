import { labs } from './content/labs.js';
import { copyDataset } from './content/datasets.js';
import { createQuestionProgress } from './learning/practice.js';
import { createUiState } from './workspace.js';
export function createDraft(task) {
  return {
    config: structuredClone(task.config),
    prediction: '',
    predictionSaved: false,
    note: '',
    note2: '',
    experiments: [],
    questions: Object.fromEntries(task.questionIds.map(id => [id, createQuestionProgress()])),
    completion: null,
    completionFeedback: null
  };
}
function createGuided() {
  return Object.fromEntries(labs.map(lab => [lab.id, Object.fromEntries(lab.tasks.map(task => [task.id, createDraft(task)]))]));
}
export function createState() {
  return {
    mode: 'guided',
    view: 'activity',
    labId: labs[0].id,
    taskIndex: 0,
    ui: createUiState(),
    guided: createGuided(),
    free: {
      dataset: copyDataset('groups'),
      config: {
        kind: 'bar',
        palette: 'uniform',
        highlight: 2,
        labels: true,
        baseline: 0,
        upper: null
      }
    }
  };
}
export function current(state) {
  const lab = labs.find(item => item.id === state.labId);
  const task = lab.tasks[state.taskIndex];
  return {
    lab,
    task,
    draft: state.guided[lab.id][task.id]
  };
}
export function selectLab(state, id) {
  if (!labs.some(lab => lab.id === id)) return;
  state.mode = 'guided';
  state.view = 'activity';
  state.labId = id;
  state.taskIndex = 0;
}
export function completedLabs(state) {
  return labs.filter(lab => lab.tasks.every(task => Boolean(state.guided[lab.id][task.id].completion))).length;
}
export function resetGuided(state) {
  state.guided = createGuided();
  state.ui.tasks = {};
  state.view = 'activity';
}
export function resetChart(task, draft) {
  draft.config = structuredClone(task.config);
  draft.completionFeedback = null;
}
