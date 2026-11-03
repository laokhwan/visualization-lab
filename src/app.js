import { dataView, isResearch, initialConfig } from './data/view.js';
import { getPath, setPath } from './data/config.js';
import { researchAnalysis, analysisLines } from './charts/research.js';
import { researchEditor, readResearchPage } from './ui/research.js';
import { datasets, copyDataset } from './content/datasets.js';
import { labs } from './content/labs.js';
import { createState, current, selectLab, resetGuided, resetChart } from './state.js';
import { submitAnswer, retryQuestion, completeTask } from './learning/practice.js';
import { savePrediction, recordExperiment, experimentComplete } from './learning/experiments.js';
import { buildLearningSummary } from './learning/report.js';
import { chartSvg, legendHtml } from './charts/render.js';
import { validateDataset, validateChart, suitability } from './charts/validation.js';
import { normalizedConfig, yDomain, formatNumber } from './charts/scales.js';
import { navigationHtml, stageHtml, tableHtml } from './ui/views.js';
import { questionHtml, experimentsHtml, reflectionStatus, completionFeedbackHtml, completionReviewHtml } from './ui/practice.js';
import { summaryHtml } from './ui/summary.js';
import { syncCapabilities, editorRow, controlsHtml } from './ui/controls.js';
import { escapeHtml as esc, options } from './ui/html.js';
import { createPersistence } from './storage/controller.js';
import { storageHtml } from './ui/storage.js';
import { requestHint } from './learning/feedback.js';
import { buildLearningReport } from './report/model.js';
import { reportHtml } from './ui/report.js';
import { createReportController } from './report/controller.js';

const state = createState();
const $ = id => document.getElementById(id);
let ready = false;
const persistence = createPersistence({ state, basePath: new URL('../', import.meta.url).pathname, onChange: info => {
  $('storage-panel').innerHTML = storageHtml({ ...info, canRecover: persistence.getInfo().canRecover });
} });
const reportController = createReportController({ state, stage: $('stage'), flush: () => persistence.flush() });

function active() {
  const { task, draft } = current(state);
  return state.mode === 'free' ? { data: state.free.dataset, config: state.free.config } : { data: datasets[task.dataset], config: draft.config };
}

function renderNavigation() {
  $('navigation').innerHTML = navigationHtml(state);
  $('guided-progress').hidden = state.mode === 'free';
  $('storage-panel').hidden = state.mode === 'free';
  if (state.mode === 'guided') {
    const { totals, sections } = buildLearningSummary(state);
    $('progress-text').textContent = `ข้อที่เคยตอบถูก ${totals.masteredQuestionCount} / ${totals.questionCount}`;
    $('completion-text').textContent = `ทำครบ ${totals.completedTaskCount} / ${totals.taskCount} สถานการณ์ · ${totals.completedLabCount} / ${totals.labCount} แล็บ · ${sections.map(s=>`${s.section==='foundation'?'พื้นฐาน':'เพิ่มเติม'} ${s.masteredQuestionCount}/${s.questionCount} ข้อ`).join(' · ')}`;
    $('progress').max = totals.questionCount;
    $('progress').value = totals.masteredQuestionCount;
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
}

function renderCompletion() {
  if ($('completion-feedback')) $('completion-feedback').innerHTML = completionFeedbackHtml(current(state).draft);
}

function updateChart() {
  const { data, config } = active();
  $('chart-title').textContent = data.title;
  $('chart').innerHTML = chartSvg(data, config);
  $('legend').innerHTML = legendHtml(data, config);
  $('data-table').innerHTML = tableHtml(data,config);
  if (isResearch(data)) {
    try { $('axis-range').textContent = analysisLines(data,config).join(' · '); } catch { $('axis-range').textContent = ''; }
  }
  $('inspection').textContent = 'เลือกแท่ง จุด หรือส่วนของกราฟเพื่ออ่านค่า';
  const errors = validateChart(data, config);
  const notices = errors.length ? [] : suitability(data, config);
  $('chart-notice').innerHTML = notices.length ? `<div class="notice"><strong>ข้อสังเกต</strong><ul>${notices.map(message => `<li>${esc(message)}</li>`).join('')}</ul></div>` : '';
  if (!isResearch(data)) $('axis-range').textContent = errors.length || config.kind === 'pie' ? '' : (() => {
    const domain = yDomain(data, config);
    return `ช่วงแกนตั้ง: ${formatNumber(domain.min)} ถึง ${formatNumber(domain.max)} ${data.unit}`;
  })();
  syncCapabilities($('controls'), config);
}

function renderStage(focus = false) {
  reportController.dispose();
  renderNavigation();
  if (state.mode === 'guided' && state.view === 'summary') $('stage').innerHTML = summaryHtml(buildLearningSummary(state)) + reportHtml(buildLearningReport(state));
  else {
    $('stage').innerHTML = stageHtml(state);
    updateChart();
    renderCompletion();
  }
  if (focus) {
    $('stage-title').focus({ preventScroll: true });
    $('workspace').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}

function changeMode(mode, focus = true) {
  if (!ready || state.mode === 'free' && mode === 'free') return;
  if (state.mode === 'guided') persistence.flush();
  if (state.mode === 'free' && mode !== 'free') { state.free.editorDraft=null; state.free.editorPage=0; }
  state.mode = mode;
  state.view = 'activity';
  renderStage(focus);
}

function changed() {
  if (state.mode === 'guided') {
    const { draft } = current(state);
    draft.completionFeedback = null;
    renderCompletion();
  }
}

function syncControlValues() {
  const { config } = active();
  $('controls').querySelectorAll('[data-config]').forEach(input => {
    const value = getPath(config,input.dataset.config);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value ?? '';
  });
}

function moveTask(direction) {
  const { lab } = current(state);
  const index = labs.indexOf(lab);
  const next = state.taskIndex + direction;
  if (next >= 0 && next < lab.tasks.length) state.taskIndex = next;
  else if (direction > 0 && index === labs.length - 1) state.view = 'summary';
  else if (labs[index + direction]) {
    state.labId = labs[index + direction].id;
    state.taskIndex = direction < 0 ? labs[index - 1].tasks.length - 1 : 0;
  }
  renderStage(true);
}

function inspectPoint(target) {
  const mark = target.closest('[data-point], [data-bin], [data-box]');
  if (!mark) return;
  const evidence = mark.closest('[data-evidence]');
  const { draft } = current(state);
  const saved = evidence ? evidence.dataset.evidence === 'completion' ? draft.completion : draft.experiments.find(item => item.slotId === evidence.dataset.evidence) : null;
  const data = saved?.dataset || active().data;
  if (isResearch(data)) {
    const config = saved?.config || (mark.closest('#original-chart') ? current(state).task.config : active().config);
    const output = evidence ? evidence.querySelector('.inspection') : mark.closest('#original-chart') ? $('original-inspection') : $('inspection');
    const a = researchAnalysis(data,config);
    if (mark.hasAttribute('data-bin')) { const b=a.histogram.bins[Number(mark.dataset.bin)]; output.textContent=`[${formatNumber(b.lo)}, ${formatNumber(b.hi)}${b.last?']':')'}: ${b.count} รายการ · ความสูง ${formatNumber(b.height)}`; }
    else if (mark.hasAttribute('data-box')) { output.textContent=analysisLines(data,config,a)[1+Number(mark.dataset.box)]; }
    else { const rows=dataView(data,config).rows,r=rows[Number(mark.dataset.point)],overlap=config.kind==='scatter'?rows.filter(other=>other.x===r.x&&other.value===r.value).length:1; output.textContent=`${r.label} · ${a.variables.x}: ${r.x} · ${a.variables.y}: ${formatNumber(r.value)}${r.secondValue!==undefined?` · ${a.variables.secondY}: ${formatNumber(r.secondValue)}`:''}${overlap>1?` · ตำแหน่งซ้อนกัน ${overlap} รายการ`:''}`; }
    return;
  }
  const row = data.rows[Number(mark.dataset.point)];
  if (!row) return;
  const output = evidence ? evidence.querySelector('.inspection') : mark.closest('#original-chart') ? $('original-inspection') : $('inspection');
  output.textContent = `${row.label}${data.xType !== 'category' ? ` · ${data.xLabel} ${formatNumber(row.x)}` : ''}: ${formatNumber(row.value)} ${data.unit}`;
}

function relabelRows() {
  const rows = [...$('edit-rows').rows];
  rows.forEach((row, i) => {
    row.querySelector('[data-col="label"]').setAttribute('aria-label', `ชื่อข้อมูล แถว ${i + 1}`);
    row.querySelector('[data-col="value"]').setAttribute('aria-label', `ค่าข้อมูล แถว ${i + 1}`);
    row.querySelector('[data-col="x"]')?.setAttribute('aria-label', `ค่าแกนนอน แถว ${i + 1}`);
    const remove = row.querySelector('[data-remove-row]');
    remove.setAttribute('aria-label', `ลบแถว ${i + 1}`);
    remove.disabled = rows.length <= 2;
  });
  $('add-row').disabled = rows.length >= 8;
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => changeMode(button.dataset.mode)));
$('start-guided').addEventListener('click', () => changeMode('guided'));
$('start-free').addEventListener('click', () => changeMode('free'));
$('show-summary').addEventListener('click', () => {
  state.view = 'summary';
  renderStage(true);
});
$('reset-guided').addEventListener('click', async () => {
  if (!window.confirm('เริ่มการฝึกใหม่ทั้งหมดหรือไม่ คำคาดการณ์ หลักฐาน คำตอบ จำนวนครั้ง และ Mastery ในกิจกรรมตามขั้นตอนจะถูกล้าง โดยไม่เปลี่ยนการทดลองอิสระ')) return;
  resetGuided(state);
  await persistence.reset();
  renderStage(true);
});
$('storage-panel').addEventListener('click', async event => {
  const id = event.target.closest('button')?.id;
  if (id === 'enable-storage') await persistence.enable();
  else if (id === 'disable-storage' && window.confirm('ลบความคืบหน้าที่บันทึกบนเครื่องนี้หรือไม่ ข้อมูลปัจจุบันยังใช้ต่อในหน้านี้ได้ แต่ไฟล์ PDF ที่เคยบันทึกจะไม่ถูกลบ')) await persistence.disable();
  else if (id === 'retry-storage') await persistence.flush();
  else if (id === 'reload-progress') window.location.reload();
  else if (id === 'accept-recovery' && window.confirm('เริ่มเฉพาะสถานการณ์ที่อ่านไม่ได้หรือเกณฑ์เปลี่ยนหรือไม่ ส่วนที่กู้คืนได้จะยังอยู่ และข้อมูลเดิมของส่วนที่เริ่มใหม่จะถูกลบ')) { await persistence.acceptRecovery(); renderStage(); }
});
window.addEventListener('storage', event => { if (event.key === persistence.getInfo().preferenceKey) persistence.pauseForOtherTab(); });
$('navigation').addEventListener('click', event => {
  const lab = event.target.closest('[data-lab]');
  const dataset = event.target.closest('[data-dataset]');
  if (lab) selectLab(state, lab.dataset.lab);
  else if (dataset) {
    const wasResearch=isResearch(state.free.dataset);
    state.free.dataset = copyDataset(dataset.dataset.dataset);
    state.free.config = isResearch(state.free.dataset) ? initialConfig(state.free.dataset) : normalizedConfig(state.free.dataset, wasResearch ? initialConfig(state.free.dataset) : state.free.config);
    state.free.editorDraft = null; state.free.editorPage = 0;
  } else return;
  renderStage(true);
});

$('stage').addEventListener('change', event => {
  const input = event.target;
  const questionForm = input.closest('[data-question-form]');
  if (questionForm && state.mode === 'guided') {
    const progress = current(state).draft.questions[questionForm.dataset.questionForm];
    if (!progress.editing) return;
    progress.selectedOptionIds = [...questionForm.querySelectorAll('input:checked')].map(item => item.value);
    progress.validationMessage = '';
    $(`${questionForm.dataset.questionForm}-validation`).textContent = '';
    return;
  }
  if (!input.matches('[data-config]')) return;
  if (state.mode === 'guided' && !current(state).draft.predictionSaved) return;
  const key = input.dataset.config;
  const { config } = active();
  const value = input.type === 'checkbox' ? input.checked : input.dataset.valueType === 'numbers' ? input.value.split(',').map(v => v.trim() ? Number(v) : NaN) : input.dataset.valueType === 'number' || ['baseline', 'upper', 'highlight'].includes(key) ? (input.value === '' ? (key === 'upper' ? null : NaN) : Number(input.value)) : input.value;
  setPath(config,key,value);
  if (isResearch(active().data)) {
    if (key === 'kind') {
      if (!Number.isFinite(config.baseline)) config.baseline=0;
      if (config.upper!==null && (!Number.isFinite(config.upper) || config.upper<=config.baseline)) config.upper=null;
      config.presentation = config.kind === 'line' && active().data.encoding.secondY ? 'small-multiples' : '2d'; }
    if (key === 'color.schemeType') { const type = value === 'categorical' ? 'nominal' : 'quantitative'; const fields = active().data.fields.filter(f => f.type === type); if (!fields.some(f => f.id === config.color.field) && fields.length) config.color.field = fields[0].id; }
    const panel = $('experiment-controls') || $('controls');
    panel.innerHTML = (state.mode === 'guided' ? '<legend class="sr-only">ตัวควบคุมกราฟ</legend>' : '')+controlsHtml(active().data,config,[],state.mode === 'free');
    $(input.id)?.focus({preventScroll:true});
  }
  changed();
  updateChart();
});

$('stage').addEventListener('input', event => {
  const keys = { prediction: 'prediction', reflection: 'note', 'reflection-2': 'note2' };
  const key = keys[event.target.id];
  if (key && state.mode === 'guided') {
    const { task, draft } = current(state);
    if (key === 'prediction' ? draft.predictionSaved : !experimentComplete(task, draft)) return;
    draft[key] = event.target.value;
    if (key === 'note' || key === 'note2') $(`reflection-status-${key === 'note' ? '1' : '2'}`).textContent = reflectionStatus(draft[key]);
    changed();
  }
});
$('stage').addEventListener('change', event => {
  if (event.target.id === 'prediction' && state.mode === 'guided') {
    if (current(state).draft.predictionSaved) return;
    current(state).draft.prediction = event.target.value;
    changed();
  }
});

$('stage').addEventListener('click', event => {
  const target = event.target.closest('button');
  if (event.target.closest('[data-point], [data-bin], [data-box]')) inspectPoint(event.target);
  if (!target) return;
  if (target.hasAttribute('data-editor-page') && state.mode === 'free') {
    state.free.editorDraft ??= structuredClone(state.free.dataset);
    readResearchPage($('research-data-form'),state.free.editorDraft);
    state.free.editorPage = Number(target.dataset.editorPage);
    $('data-editor').outerHTML=researchEditor(state.free.editorDraft,state.free.editorPage);
    return;
  }
  if (target.hasAttribute('data-task')) {
    state.taskIndex = Number(target.dataset.task);
    renderStage(true);
  } else if (target.id === 'save-prediction') {
    const { task, draft } = current(state);
    const result = savePrediction(draft);
    $('prediction-message').textContent = result.message;
    if (result.accepted) {
      $('prediction').disabled = true;
      target.disabled = true;
      target.textContent = 'บันทึกคำคาดการณ์แล้ว';
      $('experiment-controls').disabled = false;
      $('record-experiment').disabled = false;
      syncCapabilities($('controls'), draft.config);
    }
  } else if (target.id === 'record-experiment') {
    const { task, draft } = current(state);
    const result = recordExperiment(task, draft);
    $('experiment-message').textContent = result.message;
    if (result.accepted) {
      $('experiments-list').innerHTML = experimentsHtml(task, draft);
      const unlocked = experimentComplete(task, draft);
      $('reasoning-locked').hidden = unlocked;
      $('reasoning').hidden = !unlocked;
      $('reasoning-fields').disabled = !unlocked;
      if (unlocked) $('practice-announcement').textContent = 'บันทึกกราฟครบแล้ว เปิดคำถามและช่องสะท้อนคิดแล้ว';
    }
  } else if (target.hasAttribute('data-more-hint')) {
    const { task, draft } = current(state);
    const id = target.dataset.moreHint;
    requestHint(draft.questions[id]);
    $(`question-${id}`).innerHTML = questionHtml(id, draft.questions[id], task.questionIds.indexOf(id));
    $(`${id}-feedback`).focus({ preventScroll: true });
    $('practice-announcement').textContent = 'แสดงคำใบ้เพิ่มเติมแล้ว จำนวนครั้งตอบและ Mastery ไม่เปลี่ยน';
  } else if (target.hasAttribute('data-retry')) {
    const { task, draft } = current(state);
    const id = target.dataset.retry;
    retryQuestion(draft.questions[id]);
    $(`question-${id}`).innerHTML = questionHtml(id, draft.questions[id], task.questionIds.indexOf(id));
    $(`question-${id}`).querySelector('input').focus({ preventScroll: true });
  } else if (target.id === 'complete-task') {
    const { task, draft } = current(state);
    completeTask(task, draft);
    if (draft.completion) target.textContent = 'ตรวจเกณฑ์ปัจจุบัน';
    renderCompletion();
    $('completion-review').innerHTML = completionReviewHtml(task, draft);
    renderNavigation();
    $('completion-feedback').focus({ preventScroll: true });
    $('practice-announcement').textContent = draft.completionFeedback.retainedEvidence ? 'ตรวจฉบับปัจจุบันแล้ว ผลที่เคยทำครบและหลักฐานเดิมยังคงอยู่' : draft.completionFeedback.passed ? 'บันทึกกิจกรรมครบแล้ว' : 'ยังทำกิจกรรมไม่ครบ โปรดตรวจรายการ';
  } else if (target.id === 'return-activity') {
    state.view = 'activity';
    renderStage(true);
  } else if (target.hasAttribute('data-review-lab')) {
    selectLab(state, target.dataset.reviewLab);
    state.taskIndex = current(state).lab.tasks.findIndex(task => task.id === target.dataset.reviewTask);
    renderStage(true);
    if (target.dataset.reviewQuestion) $(`${target.dataset.reviewQuestion}-feedback`)?.focus();
  } else if (target.id === 'reset-chart') {
    if (state.mode === 'free') {
      const data = copyDataset(state.free.dataset.id);
      state.free.dataset = data;
      state.free.config = isResearch(data) ? initialConfig(data) : normalizedConfig(data, { kind: 'bar', palette: 'uniform', highlight: 2, baseline: 0, upper: null, labels: true });
      state.free.editorDraft = null; state.free.editorPage = 0;
      // Rebuild the editor because reset also restores the sample data.
      renderStage();
      $('reset-chart').focus({ preventScroll: true });
    } else {
      const { task, draft } = current(state);
      resetChart(task, draft);
      changed();
      if (isResearch(active().data)) { const panel=$('experiment-controls'); panel.innerHTML='<legend class="sr-only">ตัวควบคุมกราฟ</legend>'+controlsHtml(active().data,draft.config,[],false); }
      syncControlValues();
      updateChart();
    }
  } else if (target.id === 'fit-axis') {
    const { data, config } = active();
    Object.assign(config, normalizedConfig(data, config));
    changed();
    syncControlValues();
    updateChart();
  } else if (target.id === 'previous') moveTask(-1);
  else if (target.id === 'next') moveTask(1);
  else if (target.id === 'return-guided') changeMode('guided');
  else if (target.id === 'add-row') {
    const rows = $('edit-rows').rows;
    if (rows.length >= 8) return;
    $('edit-rows').insertAdjacentHTML('beforeend', editorRow({ label: `รายการ ${rows.length + 1}`, x: '', value: 0 }, rows.length, state.free.dataset.xType));
    relabelRows();
    $('edit-rows').lastElementChild.querySelector('input').focus();
  } else if (target.hasAttribute('data-remove-row')) {
    if ($('edit-rows').rows.length <= 2) return;
    const row = target.closest('tr');
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    relabelRows();
    next.querySelector('input').focus();
  }
});

$('stage').addEventListener('keydown', event => {
  if (event.target.closest('[data-point], [data-bin], [data-box]') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    inspectPoint(event.target);
  }
});

$('stage').addEventListener('submit', event => {
  const questionId = event.target.dataset.questionForm;
  if (questionId) {
    event.preventDefault();
    if (state.mode !== 'guided') return;
    const { task, draft } = current(state);
    const result = submitAnswer(task, draft, questionId);
    if (!result.accepted) {
      $(`${questionId}-validation`).textContent = result.message;
      return;
    }
    $(`question-${questionId}`).innerHTML = questionHtml(questionId, draft.questions[questionId], task.questionIds.indexOf(questionId));
    renderNavigation();
    changed();
    $(`${questionId}-feedback`).focus({ preventScroll: true });
    $('practice-announcement').textContent = result.correct ? 'คำตอบผ่านเกณฑ์แล้ว และบันทึกจำนวนครั้งแล้ว' : 'บันทึกความพยายามแล้ว โปรดทบทวนคำแนะนำและลองอีกครั้ง';
    return;
  }
  if (event.target.id === 'research-data-form' && state.mode === 'free') {
    event.preventDefault();
    state.free.editorDraft ??= structuredClone(state.free.dataset);
    readResearchPage(event.target,state.free.editorDraft);
    const errors = validateDataset(state.free.editorDraft);
    if (errors.length) { $('data-errors').textContent=errors.join(' · '); return; }
    state.free.dataset=structuredClone(state.free.editorDraft);
    event.target.querySelectorAll('[aria-readonly="true"]').forEach(input=>{input.value=state.free.dataset.records[Number(input.dataset.record)][input.dataset.field]??'';});
    updateChart();
    $('data-errors').textContent='นำข้อมูลไปใช้แล้ว; ค่าที่ขาดจะถูกแยกออกตามตัวแปรที่กราฟต้องใช้'; return;
  }
  if (event.target.id !== 'data-form') return;
  event.preventDefault();
  const form = new FormData(event.target);
  const data = {
    ...state.free.dataset,
    title: String(form.get('title')).trim(), unit: String(form.get('unit')).trim(), xLabel: String(form.get('xLabel')).trim(),
    rows: [...$('edit-rows').rows].map(row => {
      const value = row.querySelector('[data-col="value"]').value;
      const x = row.querySelector('[data-col="x"]')?.value;
      return { label: row.querySelector('[data-col="label"]').value.trim(), value: value.trim() ? Number(value) : NaN, ...(x !== undefined ? { x: x.trim() ? Number(x) : NaN } : {}) };
    }),
  };
  const errors = validateDataset(data);
  if (errors.length) {
    $('data-errors').textContent = errors.join(' · ');
    return;
  }
  state.free.dataset = data;
  state.free.config = normalizedConfig(data, state.free.config);
  if ($('highlight')) $('highlight').innerHTML = options(data.rows.map((row, i) => [i, row.label]), state.free.config.highlight);
  syncControlValues();
  updateChart();
  $('data-errors').textContent = 'นำข้อมูลไปใช้แล้ว และปรับช่วงแกนให้ครอบคลุมข้อมูล';
  relabelRows();
});

// Storage observes state-changing actions; chart inspection and Free are excluded.
document.addEventListener('input', event => {
  if (ready && state.mode === 'guided' && ['prediction', 'reflection', 'reflection-2'].includes(event.target.id)) persistence.save({ draft: true });
});
document.addEventListener('change', event => {
  if (ready && state.mode === 'guided' && (event.target.matches('[data-config], #prediction') || event.target.closest('[data-question-form]'))) persistence.save();
});
document.addEventListener('click', event => {
  if (ready && state.mode === 'guided' && event.target.closest('[data-task], [data-lab], #save-prediction, #record-experiment, [data-retry], [data-more-hint], #complete-task, #reset-chart, #fit-axis, #previous, #next')) persistence.save();
});
document.addEventListener('submit', event => { if (ready && state.mode === 'guided' && event.target.matches('[data-question-form]')) persistence.save(); });
document.addEventListener('focusout', event => { if (ready && state.mode === 'guided' && event.target.matches('textarea')) persistence.flush(); });
document.addEventListener('visibilitychange', () => { if (ready && document.visibilityState === 'hidden') persistence.flush(); });
await persistence.initialize();
ready = true;
$('workspace').removeAttribute('aria-busy');
renderStage();
