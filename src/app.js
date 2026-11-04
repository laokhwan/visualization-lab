import { dataView, isResearch, initialConfig } from './data/view.js';
import { setPath } from './data/config.js';
import { researchAnalysis, analysisLines } from './charts/research.js';
import { researchEditor, readResearchPage } from './ui/research.js';
import { datasets, copyDataset } from './content/datasets.js';
import { labs } from './content/labs.js';
import { createState, current, selectLab, resetGuided, resetChart } from './state.js';
import { taskUi, visitStep } from './workspace.js';
import { submitAnswer, retryQuestion, completeTask } from './learning/practice.js';
import { savePrediction, recordExperiment, experimentComplete } from './learning/experiments.js';
import { buildLearningSummary } from './learning/report.js';
import { chartSvg, legendHtml } from './charts/render.js';
import { validateDataset, validateChart, suitability } from './charts/validation.js';
import { normalizedConfig, yDomain, formatNumber } from './charts/scales.js';
import { tableHtml } from './ui/views.js';
import { contextHtml, workspaceHtml } from './ui/workspace.js';
import { reflectionStatus } from './ui/practice.js';
import { groupedControls } from './ui/control-groups.js';
import { summaryHtml } from './ui/summary.js';
import { syncCapabilities, editorRow } from './ui/controls.js';
import { escapeHtml as esc } from './ui/html.js';
import { createPersistence } from './storage/controller.js';
import { storageHtml } from './ui/storage.js';
import { requestHint } from './learning/feedback.js';
import { buildLearningReport } from './report/model.js';
import { reportHtml } from './ui/report.js';
import { createReportController } from './report/controller.js';
const state = createState(),
  $ = id => document.getElementById(id);
let ready = false,
  plotWidth = 0,
  previousView;
const persistence = createPersistence({
  state,
  basePath: new URL('../', import.meta.url).pathname,
  onChange: info => {
    $('storage-panel').innerHTML = storageHtml({
      ...info,
      canRecover: persistence.getInfo().canRecover
    });
    const captions = {
      off: 'อยู่ในหน้านี้',
      pending: 'รอบันทึก',
      saving: 'กำลังบันทึก',
      saved: 'บันทึกแล้ว',
      restored: 'กู้คืนแล้ว',
      loading: 'กำลังกู้คืน',
      error: 'บันทึกมีปัญหา',
      recovery: 'ตรวจข้อมูลเดิม',
      ready: 'เปิดบันทึกแล้ว'
    };
    $('save-indicator').textContent = captions[info.status] || info.message;
    $('storage-toggle').setAttribute('aria-label', `ความคืบหน้า: ${info.message}`);
    if (info.status === 'error' || info.blocked) setStorageOpen(true);
  }
});
const reportController = createReportController({
  state,
  stage: $('stage'),
  flush: () => persistence.flush()
});
function save(options) {
  if (ready && state.mode === 'guided') return persistence.save(options);
}
function ui() {
  const {
    lab,
    task
  } = current(state);
  return taskUi(state, lab.id, task);
}
function active() {
  const {
    task,
    draft
  } = current(state);
  return state.mode === 'free' ? {
    data: state.free.dataset,
    config: state.free.config
  } : {
    data: datasets[task.dataset],
    config: draft.config
  };
}
function displayed() {
  if (state.mode === 'free') return active();
  const {
      task,
      draft
    } = current(state),
    source = ui().source;
  if (source === 'original') return {
    data: datasets[task.dataset],
    config: task.config
  };
  const snapshot = source === 'completion' ? draft.completion : draft.experiments.find(s => s.slotId === source);
  return snapshot ? {
    data: snapshot.dataset,
    config: snapshot.config
  } : active();
}
function setStorageOpen(open) {
  $('storage-panel').hidden = !open;
  $('storage-toggle').setAttribute('aria-expanded', String(open));
}
function renderNavigation() {
  const summary = buildLearningSummary(state),
    {
      totals,
      sections
    } = summary;
  $('progress-text').textContent = `เคยผ่าน ${totals.masteredQuestionCount} / ${totals.questionCount} ข้อ`;
  $('completion-text').textContent = `ทำครบ ${totals.completedTaskCount} / ${totals.taskCount} สถานการณ์ · ${totals.completedLabCount} / ${totals.labCount} แล็บ · ${sections.map(s => `${s.section === 'foundation' ? 'พื้นฐาน' : 'เพิ่มเติม'} ${s.masteredQuestionCount}/${s.questionCount} ข้อ`).join(' · ')}`;
  $('progress').max = totals.questionCount;
  $('progress').value = totals.masteredQuestionCount;
  const landing = state.ui.screen === 'landing';
  document.body.dataset.screen = landing ? 'landing' : 'workspace';
  document.querySelector('.skip-link').href = landing ? '#page-title' : '#workspace';
  $('landing').hidden = !landing;
  $('landing-labs').hidden = !landing;
  $('landing-lab-list').innerHTML = labs.map(lab => `<button class="secondary landing-lab" data-start-lab="${lab.id}"><strong>${esc(lab.title)}</strong><span>${esc(lab.intro)}</span><small>${lab.tasks.length} สถานการณ์</small></button>`).join('');
  $('workspace').hidden = landing;
  $('app-actions').hidden = landing;
  $('guided-progress').hidden = state.mode === 'free';
  $('show-summary').hidden = state.mode === 'free';
  $('storage-toggle').hidden = state.mode === 'free';
  if (state.mode === 'free') setStorageOpen(false);
  $('context-bar').innerHTML = contextHtml(state);
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  $('resume-learning').hidden = !labs.some(l => l.tasks.some(t => {
    const d = state.guided[l.id][t.id];
    return d.predictionSaved || d.prediction || d.experiments.length;
  }));
  $('resume-note').hidden = $('resume-learning').hidden;
  $('resume-note').textContent = persistence.getInfo().enabled ? 'พบความคืบหน้าบนเครื่องนี้ ตรวจว่าเป็นการฝึกของคุณก่อนเรียนต่อ โดยเฉพาะเครื่องที่ใช้ร่วมกัน' : 'ความคืบหน้าอยู่ในหน้านี้ หากยังไม่เปิดบันทึก ข้อมูลจะหายเมื่อโหลดใหม่';
}
function mountControls() {
  const host = $('control-fields');
  if (!host) return;
  const {
      data,
      config
    } = active(),
    {
      lab,
      task
    } = current(state),
    free = state.mode === 'free';
  const preferred = state.mode === 'guided' && lab.id === 'color' ? 'color' : ['histogram', 'box'].includes(config.kind) ? 'distribution' : ['misleading', 'redesign'].includes(lab.id) && !free ? 'axes' : undefined;
  host.innerHTML = groupedControls(data, config, free ? ['kind', 'palette', 'highlight', 'baseline'] : lab.controls, free, free ? state.ui.freeGroups : ui().groups, preferred);
  syncCapabilities(host, config);
}
function chartWarnings(data, config, errors) {
  if (errors.length) return '';
  const messages = suitability(data, config).filter(m => !m.startsWith('ข้อมูลจำลอง'));
  // Keep interpretive caveats visible; lengthy method descriptions remain in the data disclosure.
  const important = messages.filter(m => !m.startsWith('ช่วงชั้น') && !m.startsWith('ควอร์ไทล์'));
  if (isResearch(data)) {
    const a = researchAnalysis(data, config);
    if (a.timeContext) important.unshift(`ช่วงที่แสดง ${a.timeContext.selectedRange.map(formatNumber).join('–')} จากช่วงเต็ม ${a.timeContext.fullRange.map(formatNumber).join('–')}`);
    if (a.histogram) important.unshift(a.histogram.density ? 'ความสูง = ความถี่ / ความกว้าง · พื้นที่แทนจำนวนข้อมูล' : 'ความสูงแทนจำนวนข้อมูลในช่วงชั้น');
    if (a.groups.length) important.unshift('Box Plot: R type 7 · หนวดเป็นค่าจริงในขอบเขต 1.5 IQR');
    if (a.base) important.unshift(`ดัชนีฐาน 100 · วันฐาน ${formatNumber(a.base.x)} · ค่า / ค่าแรก × 100`);
  }
  return important.length ? `<div class="notice">${important.map(m => `<p>${esc(m)}</p>`).join('')}</div>` : '';
}
function updateChart({
  preserveInspection = false
} = {}) {
  if (!$('chart')) return;
  const {
      data,
      config
    } = displayed(),
    oldInspection = $('inspection').textContent;
  const focused = document.activeElement?.closest?.('[data-point], [data-bin], [data-box]');
  const selector = focused ? ['point', 'bin', 'box'].filter(k => focused.dataset[k] !== undefined).map(k => `[data-${k}="${focused.dataset[k]}"]`)[0] : null;
  const width = Math.max(280, Math.floor($('chart').clientWidth));
  plotWidth = width;
  $('chart-title').textContent = data.title;
  $('chart-context').textContent = `ข้อมูลจำลอง · ${isResearch(data) ? data.records.length : data.rows.length} รายการ${isResearch(data) ? '' : ` · ${data.unit}`}`;
  $('chart').innerHTML = chartSvg(data, config, 'live-svg', {
    width,
    compact: true,
    height: config.presentation === 'small-multiples' ? 420 : matchMedia('(orientation:portrait)').matches && innerWidth >= 650 ? 300 : 320
  });
  $('legend').innerHTML = legendHtml(data, config);
  $('legend').hidden = isResearch(data) && (['histogram', 'box'].includes(config.kind) || config.color.schemeType === 'uniform') && !['dual', 'small-multiples', 'indexed'].includes(config.presentation);
  $('data-table').innerHTML = tableHtml(data, config);
  $('inspection').textContent = preserveInspection ? oldInspection : 'แตะหรือเลือกจุดข้อมูลเพื่ออ่านค่า';
  const errors = validateChart(data, config);
  $('chart-notice').innerHTML = chartWarnings(data, config, errors);
  try {
    $('axis-range').textContent = isResearch(data) ? analysisLines(data, config).join(' · ') : config.kind === 'pie' ? 'กราฟวงกลมแสดงสัดส่วน' : `ช่วงแกนตั้ง ${formatNumber(yDomain(data, config).min)} ถึง ${formatNumber(yDomain(data, config).max)} ${data.unit}`;
  } catch {
    $('axis-range').textContent = 'ปรับการตั้งค่าให้ถูกต้องเพื่ออ่านสถิติ';
  }
  if ($('control-errors')) $('control-errors').innerHTML = errors.length ? `<p class="form-message">${errors.map(esc).join(' · ')}</p>` : '';
  if ($('chart-readonly')) $('chart-readonly').textContent = ui().step === 'experiment' && ui().source === 'current' ? 'ปรับได้' : ui().source === 'current' ? 'อ่านกราฟ · ปรับในขั้นทดลอง' : 'หลักฐานอ่านอย่างเดียว';
  if (selector) $('chart').querySelector(selector)?.focus({
    preventScroll: true
  });
}
const chartObserver = new ResizeObserver(() => {
  if ($('chart') && Math.abs($('chart').clientWidth - plotWidth) > 8) updateChart({
    preserveInspection: true
  });
});
function mountEditor() {
  const form = $('data-form') || $('research-data-form');
  if (!form) return;
  form.closest('details').open = true;
  if ($('edit-rows')) relabelRows();
}
function renderStage(focus = false) {
  if (previousView === 'report' && (state.view !== 'report' || state.ui.screen === 'landing')) reportController.dispose();
  previousView = state.view;
  renderNavigation();
  chartObserver.disconnect();
  if (state.ui.screen === 'landing') {
    $('stage').replaceChildren();
    if (focus) $('page-title').focus({
      preventScroll: true
    });
    return;
  }
  if (state.mode === 'guided' && state.view === 'summary') $('stage').innerHTML = summaryHtml(buildLearningSummary(state));else if (state.mode === 'guided' && state.view === 'report') $('stage').innerHTML = '<h2 id="stage-title" tabindex="-1">รายงานการเรียนรู้</h2><button id="back-summary" class="secondary">กลับสรุป</button>' + reportHtml(buildLearningReport(state));else {
    $('stage').innerHTML = workspaceHtml(state);
    mountControls();
    mountEditor();
    if ($('chart')) {
      updateChart();
      chartObserver.observe($('chart'));
    }
  }
  if (focus) {
    ($('step-title') || $('stage-title')).focus({
      preventScroll: true
    });
    window.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  }
}
function rememberPage(replace = false) {
  const target = state.ui.screen === 'landing' ? 'home' : state.view === 'activity' ? 'workspace' : state.view;
  history[replace ? 'replaceState' : 'pushState']({
    screen: state.ui.screen,
    view: state.view,
    mode: state.mode
  }, '', `#${target}`);
}
function enter(mode, {
  view = 'activity',
  historyEntry = true
} = {}) {
  if (!ready) return;
  stashEditor();
  if (state.mode === 'guided' && state.ui.screen === 'workspace') persistence.flush();
  state.mode = mode;
  state.view = view;
  state.ui.screen = 'workspace';
  if (historyEntry) rememberPage();
  renderStage(true);
}
function goHome() {
  if (!ready) return;
  stashEditor();
  if (state.mode === 'guided') persistence.flush();
  state.ui.screen = 'landing';
  rememberPage();
  renderStage(true);
}
function moveStep(step) {
  const {
    lab,
    task
  } = current(state);
  if (!visitStep(state, lab.id, task, step)) return;
  save();
  renderStage(true);
}
function moveTask(direction) {
  const {
      lab
    } = current(state),
    index = labs.indexOf(lab),
    next = state.taskIndex + direction;
  if (next >= 0 && next < lab.tasks.length) state.taskIndex = next;else if (direction > 0 && index === labs.length - 1) {
    enter('guided', {
      view: 'summary'
    });
    return;
  } else if (labs[index + direction]) {
    state.labId = labs[index + direction].id;
    state.taskIndex = direction < 0 ? labs[index - 1].tasks.length - 1 : 0;
  }
  save();
  renderStage(true);
}
function inspectPoint(target) {
  const mark = target.closest('[data-point], [data-bin], [data-box]');
  if (!mark) return;
  const {
    data,
    config
  } = displayed();
  let message;
  if (isResearch(data)) {
    const a = researchAnalysis(data, config);
    if (mark.dataset.bin !== undefined) {
      const b = a.histogram.bins[Number(mark.dataset.bin)];
      message = `[${formatNumber(b.lo)}, ${formatNumber(b.hi)}${b.last ? ']' : ')'}: ${b.count} รายการ · ความสูง ${formatNumber(b.height)}`;
    } else if (mark.dataset.box !== undefined) {
      const g = a.groups[Number(mark.dataset.box)];
      message = `${g.label}: n=${g.n} · Q1=${formatNumber(g.q1)} · มัธยฐาน=${formatNumber(g.median)} · Q3=${formatNumber(g.q3)} · IQR=${formatNumber(g.iqr)} · หนวด ${g.whiskers.map(formatNumber).join('–')} · ค่านอกเกณฑ์ ${g.outliers.map(formatNumber).join(', ') || 'ไม่มี'}`;
    } else {
      const rows = dataView(data, config).rows,
        r = rows[Number(mark.dataset.point)],
        overlap = config.kind === 'scatter' ? rows.filter(other => other.x === r.x && other.value === r.value).length : 1;
      message = `${r.label} · ${a.variables.x}: ${r.x} · ${a.variables.y}: ${formatNumber(r.value)}${r.secondValue !== undefined ? ` · ${a.variables.secondY}: ${formatNumber(r.secondValue)}` : ''}${overlap > 1 ? ` · ตำแหน่งซ้อนกัน ${overlap} รายการ` : ''}`;
    }
  } else {
    const row = data.rows[Number(mark.dataset.point)];
    message = `${row.label}${data.xType !== 'category' ? ` · ${data.xLabel} ${formatNumber(row.x)}` : ''}: ${formatNumber(row.value)} ${data.unit}`;
  }
  $('inspection').textContent = message;
}
function relabelRows() {
  const rows = [...$('edit-rows').rows];
  rows.forEach((row, i) => {
    for (const [col, label] of [['label', 'ชื่อข้อมูล'], ['value', 'ค่าข้อมูล'], ['x', 'ค่าแกนนอน']]) row.querySelector(`[data-col="${col}"]`)?.setAttribute('aria-label', `${label} แถว ${i + 1}`);
    const remove = row.querySelector('[data-remove-row]');
    remove.setAttribute('aria-label', `ลบแถว ${i + 1}`);
    remove.disabled = rows.length <= 2;
  });
  $('add-row').disabled = rows.length >= 8;
}
function stashEditor() {
  if (state.mode !== 'free') return;
  if ($('research-data-form')) {
    state.free.editorDraft ??= structuredClone(state.free.dataset);
    readResearchPage($('research-data-form'), state.free.editorDraft);
  } else if ($('data-form')) {
    const form = new FormData($('data-form'));
    state.free.editorDraft = {
      ...state.free.dataset,
      title: String(form.get('title')),
      unit: String(form.get('unit')),
      xLabel: String(form.get('xLabel')),
      rows: [...$('edit-rows').rows].map(row => {
        const value = row.querySelector('[data-col="value"]').value,
          x = row.querySelector('[data-col="x"]')?.value;
        return {
          label: row.querySelector('[data-col="label"]').value,
          value: value.trim() ? Number(value) : NaN,
          ...(x !== undefined ? {
            x: x.trim() ? Number(x) : NaN
          } : {})
        };
      })
    };
  }
}
function selectDataset(id) {
  if (!datasets[id]) return;
  stashEditor();
  if (state.free.editorDirty && !window.confirm('เปลี่ยนชุดข้อมูลและทิ้งข้อมูลร่างที่ยังไม่นำไปใช้หรือไม่')) {
    $('dataset-select').value = state.free.dataset.id;
    return;
  }
  const wasResearch = isResearch(state.free.dataset);
  state.free.dataset = copyDataset(id);
  state.free.config = isResearch(state.free.dataset) ? initialConfig(state.free.dataset) : normalizedConfig(state.free.dataset, wasResearch ? initialConfig(state.free.dataset) : state.free.config);
  state.free.editorDraft = null;
  state.free.editorDirty = false;
  state.free.editorPage = 0;
  state.ui.freeView = 'chart';
  state.ui.freeGroups = null;
  renderStage(true);
}
function changeConfig(input) {
  const key = input.dataset.config,
    {
      config
    } = active(),
    value = input.type === 'checkbox' ? input.checked : input.dataset.valueType === 'numbers' ? input.value.split(',').map(v => v.trim() ? Number(v) : NaN) : input.dataset.valueType === 'number' || ['baseline', 'upper', 'highlight'].includes(key) ? input.value === '' ? key === 'upper' ? null : NaN : Number(input.value) : input.value;
  if (state.mode === 'guided' && (ui().step !== 'experiment' || ui().source !== 'current')) return;
  setPath(config, key, value);
  if (isResearch(active().data)) {
    if (key === 'kind') {
      if (!Number.isFinite(config.baseline)) config.baseline = 0;
      if (config.upper !== null && (!Number.isFinite(config.upper) || config.upper <= config.baseline)) config.upper = null;
      config.presentation = config.kind === 'line' && active().data.encoding.secondY ? 'small-multiples' : '2d';
    }
    if (key === 'color.schemeType') {
      const type = value === 'categorical' ? 'nominal' : 'quantitative',
        fields = active().data.fields.filter(f => f.type === type);
      if (!fields.some(f => f.id === config.color.field) && fields.length) config.color.field = fields[0].id;
    }
  }
  if (['kind', 'presentation', 'histogram.mode', 'color.schemeType', 'windowMode', 'encoding.x'].includes(key)) {
    const focusId = input.id;
    mountControls();
    $(focusId)?.focus({
      preventScroll: true
    });
  } else if ($('control-fields')) syncCapabilities($('control-fields'), config);
  if (state.mode === 'guided') current(state).draft.completionFeedback = null;
  updateChart();
  save();
}
$('page-title').tabIndex = -1;
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  const target = state.ui.screen === 'landing' ? $('page-title') : $('workspace');
  target.focus({
    preventScroll: true
  });
  target.scrollIntoView({
    behavior: 'auto',
    block: 'start'
  });
});
$('go-home').addEventListener('click', event => {
  event.preventDefault();
  goHome();
});
$('home-button').addEventListener('click', goHome);
$('start-guided').addEventListener('click', () => enter('guided'));
$('resume-learning').addEventListener('click', () => enter('guided'));
$('start-free').addEventListener('click', () => enter('free'));
$('landing-lab-list').addEventListener('click', event => {
  const button = event.target.closest('[data-start-lab]');
  if (button) {
    selectLab(state, button.dataset.startLab);
    enter('guided');
  }
});
$('show-summary').addEventListener('click', () => enter('guided', {
  view: 'summary'
}));
$('storage-toggle').addEventListener('click', () => setStorageOpen($('storage-panel').hidden));
$('reset-guided').addEventListener('click', async () => {
  if (!window.confirm('เริ่มการฝึกใหม่ทั้งหมดหรือไม่ คำคาดการณ์ หลักฐาน คำตอบ จำนวนครั้ง และ Mastery จะถูกล้าง โดยไม่เปลี่ยนการทดลองอิสระ')) return;
  resetGuided(state);
  await persistence.reset();
  renderStage(true);
});
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => enter(button.dataset.mode)));
$('storage-panel').addEventListener('click', async event => {
  const id = event.target.closest('button')?.id;
  if (id === 'enable-storage') await persistence.enable();else if (id === 'disable-storage' && window.confirm('ลบความคืบหน้าที่บันทึกบนเครื่องนี้หรือไม่ ไฟล์ PDF ที่บันทึกไปแล้วจะไม่ถูกลบ')) await persistence.disable();else if (id === 'retry-storage') await persistence.flush();else if (id === 'reload-progress') location.reload();else if (id === 'accept-recovery' && window.confirm('เริ่มเฉพาะสถานการณ์ที่อ่านไม่ได้หรือเกณฑ์เปลี่ยน โดยรักษาส่วนที่กู้คืนได้หรือไม่')) {
    await persistence.acceptRecovery();
    renderStage();
  }
});
$('context-bar').addEventListener('change', event => {
  if (event.target.id === 'lab-select') {
    selectLab(state, event.target.value);
    save();
    renderStage(true);
  } else if (event.target.id === 'task-select') {
    state.taskIndex = Number(event.target.value);
    save();
    renderStage(true);
  } else if (event.target.id === 'dataset-select') selectDataset(event.target.value);
});
$('stage').addEventListener('toggle', event => {
  const node = event.target;
  if (!node.matches('[data-control-group]') || !node.isConnected) return;
  if (node.open) for (const other of $('stage').querySelectorAll('[data-control-group]')) if (other !== node) other.open = false;
  const open = [...$('stage').querySelectorAll('[data-control-group][open]')].map(d => d.dataset.controlGroup);
  if (state.mode === 'free') state.ui.freeGroups = open;else ui().groups = open;
}, true);
$('stage').addEventListener('change', event => {
  const input = event.target,
    form = input.closest('[data-question-form]');
  if (form && state.mode === 'guided') {
    const p = current(state).draft.questions[form.dataset.questionForm];
    if (!p.editing) return;
    p.selectedOptionIds = [...form.querySelectorAll('input:checked')].map(i => i.value);
    p.validationMessage = '';
    $(`${form.dataset.questionForm}-validation`).textContent = '';
    save();
    return;
  }
  if (input.matches('[data-config]')) changeConfig(input);else if (input.id === 'prediction' && state.mode === 'guided' && !current(state).draft.predictionSaved) {
    current(state).draft.prediction = input.value;
    save();
  } else if (input.id === 'chart-source') {
    ui().source = input.value;
    renderStage();
    $('chart-source').focus({
      preventScroll: true
    });
  }
});
$('stage').addEventListener('input', event => {
  const key = {
    prediction: 'prediction',
    reflection: 'note',
    'reflection-2': 'note2'
  }[event.target.id];
  if (key && state.mode === 'guided') {
    const {
      task,
      draft
    } = current(state);
    if (key === 'prediction' ? draft.predictionSaved : !experimentComplete(task, draft)) return;
    draft[key] = event.target.value;
    draft.completionFeedback = null;
    if (key !== 'prediction') $(`reflection-status-${key === 'note' ? '1' : '2'}`).textContent = reflectionStatus(draft[key]);
    save({
      draft: true
    });
  }
  if (state.mode === 'free' && event.target.closest('#free-editor-host')) {
    state.free.editorDirty = true;
    stashEditor();
  }
});
$('stage').addEventListener('focusout', event => {
  if (state.mode === 'guided' && event.target.matches('textarea')) persistence.flush();
});
$('stage').addEventListener('click', event => {
  if (event.target.closest('[data-point], [data-bin], [data-box]')) inspectPoint(event.target);
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.step) {
    const selected = current(state);
    if (button.dataset.explainTarget === 'question') ui().questionIndex = selected.task.questionIds.findIndex(id => selected.draft.questions[id].masteryStatus !== 'mastered');else if (button.dataset.explainTarget === 'reflection') ui().questionIndex = selected.task.questionIds.length;
    if (button.hasAttribute('data-edit-chart')) ui().sources.experiment = 'current';
    moveStep(button.dataset.step);
    return;
  }
  if (button.dataset.source) {
    ui().source = button.dataset.source;
    renderStage();
    $('chart-source').focus({
      preventScroll: true
    });
    return;
  }
  if (button.dataset.questionIndex !== undefined) {
    ui().questionIndex = Number(button.dataset.questionIndex);
    save();
    renderStage(true);
    return;
  }
  if (button.hasAttribute('data-question-next')) {
    ui().questionIndex = Math.min(current(state).task.questionIds.length, ui().questionIndex + 1);
    save();
    renderStage(true);
    return;
  }
  const {
    task,
    draft
  } = current(state);
  if (button.id === 'save-prediction') {
    const result = savePrediction(draft);
    if (result.accepted) {
      ui().step = 'experiment';
      ui().source = 'current';
      save();
      renderStage(true);
    } else $('prediction-message').textContent = result.message;
  } else if (button.id === 'record-experiment') {
    const result = recordExperiment(task, draft);
    if (result.accepted) {
      save();
      renderStage();
      ($('record-experiment') || $('stage').querySelector('.panel-actions .primary'))?.focus({
        preventScroll: true
      });
    }
    $('experiment-message').textContent = result.message;
  } else if (button.dataset.moreHint) {
    requestHint(draft.questions[button.dataset.moreHint]);
    save();
    renderStage();
    $(`${button.dataset.moreHint}-feedback`).focus({
      preventScroll: true
    });
  } else if (button.dataset.retry) {
    retryQuestion(draft.questions[button.dataset.retry]);
    save();
    renderStage();
    $(`question-${button.dataset.retry}`).querySelector('input').focus({
      preventScroll: true
    });
  } else if (button.id === 'complete-task') {
    completeTask(task, draft);
    if (draft.completion) ui().source = 'completion';
    save();
    renderStage();
    $('completion-feedback').focus({
      preventScroll: true
    });
  } else if (button.id === 'previous') moveTask(-1);else if (button.id === 'next') moveTask(1);else if (button.id === 'return-activity') enter('guided');else if (button.id === 'open-report') enter('guided', {
    view: 'report'
  });else if (button.id === 'back-summary') enter('guided', {
    view: 'summary'
  });else if (button.dataset.reviewLab) {
    selectLab(state, button.dataset.reviewLab);
    state.taskIndex = current(state).lab.tasks.findIndex(t => t.id === button.dataset.reviewTask);
    const view = ui(),
      selected = current(state);
    if (button.dataset.reviewQuestion) {
      visitStep(state, selected.lab.id, selected.task, 'explain');
      view.questionIndex = selected.task.questionIds.indexOf(button.dataset.reviewQuestion);
    } else if (selected.draft.completion) {
      visitStep(state, selected.lab.id, selected.task, 'feedback');
      view.source = 'completion';
    }
    state.view = 'activity';
    save();
    renderStage(true);
  } else if (button.id === 'edit-data') {
    state.ui.freeView = 'data';
    state.free.editorDraft ??= structuredClone(state.free.dataset);
    renderStage(true);
  } else if (button.id === 'back-to-chart') {
    stashEditor();
    state.ui.freeView = 'chart';
    renderStage(true);
  } else if (button.dataset.editorPage !== undefined) {
    stashEditor();
    state.free.editorPage = Number(button.dataset.editorPage);
    $('free-editor-host').innerHTML = researchEditor(state.free.editorDraft, state.free.editorPage);
    mountEditor();
    $('free-editor-host').querySelector('input')?.focus({
      preventScroll: true
    });
  } else if (button.id === 'show-data') {
    const details = $('stage').querySelector('.chart-details');
    details.open = !details.open;
    if (details.open) details.querySelector('summary').focus();
  } else if (button.id === 'reset-chart') {
    if (state.mode === 'free') {
      if (state.free.editorDirty && !window.confirm('คืนชุดข้อมูลตัวอย่างและทิ้งข้อมูลร่างหรือไม่')) return;
      state.free.dataset = copyDataset(state.free.dataset.id);
      state.free.config = isResearch(state.free.dataset) ? initialConfig(state.free.dataset) : normalizedConfig(state.free.dataset, {
        ...initialConfig(state.free.dataset),
        highlight: 2
      });
      state.free.editorDraft = null;
      state.free.editorDirty = false;
      state.ui.freeGroups = null;
    } else resetChart(task, draft);
    save();
    renderStage();
    $('reset-chart').focus({
      preventScroll: true
    });
  } else if (button.id === 'fit-axis') {
    const {
      data,
      config
    } = active();
    Object.assign(config, normalizedConfig(data, config));
    mountControls();
    updateChart();
    save();
    $('fit-axis').focus({
      preventScroll: true
    });
  } else if (button.id === 'add-row') {
    const rows = $('edit-rows').rows;
    if (rows.length >= 8) return;
    $('edit-rows').insertAdjacentHTML('beforeend', editorRow({
      label: `รายการ ${rows.length + 1}`,
      x: '',
      value: 0
    }, rows.length, state.free.dataset.xType));
    state.free.editorDirty = true;
    relabelRows();
    stashEditor();
    $('edit-rows').lastElementChild.querySelector('input').focus();
  } else if (button.hasAttribute('data-remove-row')) {
    if ($('edit-rows').rows.length <= 2) return;
    const row = button.closest('tr'),
      next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    state.free.editorDirty = true;
    relabelRows();
    stashEditor();
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
  const id = event.target.dataset.questionForm;
  if (id) {
    event.preventDefault();
    const {
        task,
        draft
      } = current(state),
      result = submitAnswer(task, draft, id);
    if (!result.accepted) {
      $(`${id}-validation`).textContent = result.message;
      return;
    }
    save();
    renderStage();
    $(`${id}-feedback`).focus({
      preventScroll: true
    });
    $('practice-announcement').textContent = result.correct ? 'คำตอบผ่านเกณฑ์แล้ว' : 'บันทึกความพยายามแล้ว ลองทบทวนและฝึกใหม่ได้';
    return;
  }
  if (!event.target.matches('#data-form, #research-data-form')) return;
  event.preventDefault();
  stashEditor();
  const data = state.free.editorDraft,
    errors = validateDataset(data);
  if (errors.length) {
    $('data-errors').textContent = errors.join(' · ');
    return;
  }
  state.free.dataset = structuredClone(data);
  state.free.editorDirty = false;
  if (!isResearch(data)) state.free.config = normalizedConfig(data, state.free.config);
  event.target.querySelectorAll('[aria-readonly="true"]').forEach(input => {
    input.value = data.records[Number(input.dataset.record)][input.dataset.field] ?? '';
  });
  $('data-errors').textContent = 'นำข้อมูลไปใช้แล้ว กลับกราฟเพื่อดูผล';
});
window.addEventListener('storage', event => {
  if (event.key === persistence.getInfo().preferenceKey) persistence.pauseForOtherTab();
});
window.addEventListener('popstate', event => {
  stashEditor();
  if (state.mode === 'guided') persistence.flush();
  const page = event.state;
  state.ui.screen = page?.screen === 'workspace' ? 'workspace' : 'landing';
  if (['activity', 'summary', 'report'].includes(page?.view)) state.view = page.view;
  if (['guided', 'free'].includes(page?.mode)) state.mode = page.mode;
  renderStage(true);
});
document.addEventListener('visibilitychange', () => {
  if (ready && document.visibilityState === 'hidden' && state.mode === 'guided') persistence.flush();
});
await persistence.initialize();
ready = true;
for (const id of ['start-guided', 'start-free', 'resume-learning']) $(id).disabled = false;
$('initial-status').hidden = true;
$('workspace').removeAttribute('aria-busy');
rememberPage(true);
renderStage();
