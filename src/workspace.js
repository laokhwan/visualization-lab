// Presentation state never participates in assessment, attempts, or mastery.
export const steps = [['predict', 'คาดการณ์'], ['experiment', 'ทดลอง'], ['explain', 'อธิบาย'], ['feedback', 'คำแนะนำ']];
export function createUiState() {
  return {
    screen: 'landing',
    tasks: {},
    freeView: 'chart',
    freeGroups: null
  };
}
export function comparisonsReady(task, draft) {
  return task.experiment.every(slot => draft.experiments.some(item => item.slotId === slot.id));
}
export function canVisitStep(task, draft, step) {
  if (step === 'predict') return true;
  if (step === 'experiment') return draft.predictionSaved;
  return ['explain', 'feedback'].includes(step) && comparisonsReady(task, draft);
}
export function taskUi(state, labId, task) {
  state.ui ??= createUiState();
  const key = `${labId}/${task.id}`,
    draft = state.guided[labId][task.id];
  if (!state.ui.tasks[key]) {
    const first = task.questionIds.findIndex(id => draft.questions[id].masteryStatus !== 'mastered');
    state.ui.tasks[key] = {
      step: draft.completion ? 'feedback' : comparisonsReady(task, draft) ? 'explain' : draft.predictionSaved ? 'experiment' : 'predict',
      questionIndex: first < 0 ? task.questionIds.length : first,
      source: draft.completion ? 'completion' : 'current',
      sources: {},
      groups: null
    };
  }
  const ui = state.ui.tasks[key];
  if (!canVisitStep(task, draft, ui.step)) ui.step = 'predict';
  return ui;
}
export function visitStep(state, labId, task, step) {
  const draft = state.guided[labId][task.id];
  if (!canVisitStep(task, draft, step)) return false;
  const ui = taskUi(state, labId, task);
  ui.sources[ui.step] = ui.source;
  ui.step = step;
  ui.source = ui.sources[step] ?? (step === 'feedback' && draft.completion ? 'completion' : 'current');
  return true;
}
