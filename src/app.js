import { datasets, copyDataset } from './content/datasets.js';
import { labs } from './content/labs.js';
import { createState, current, selectLab, completedLabs, markChanged } from './state.js';
import { submit } from './learning/evaluate.js';
import { chartSvg, legendHtml } from './charts/render.js';
import { validateDataset, validateChart, suitability } from './charts/validation.js';
import { normalizedConfig, yDomain, formatNumber } from './charts/scales.js';
import { navigationHtml, stageHtml, tableHtml, feedbackHtml } from './ui/views.js';
import { syncCapabilities, editorRow } from './ui/controls.js';
import { escapeHtml as esc, options } from './ui/html.js';

const state = createState();
const $ = id => document.getElementById(id);

function active() {
  const { task, draft } = current(state);
  return state.mode === 'free' ? { data: state.free.dataset, config: state.free.config } : { data: datasets[task.dataset], config: draft.config };
}

function renderNavigation() {
  $('navigation').innerHTML = navigationHtml(state);
  const count = completedLabs(state);
  $('progress-text').textContent = `กิจกรรมที่เคยผ่านเกณฑ์ ${count} / ${labs.length}`;
  $('progress').max = labs.length;
  $('progress').value = count;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
}

function renderFeedback() {
  if ($('feedback')) $('feedback').innerHTML = feedbackHtml(current(state).draft);
}

function updateChart() {
  const { data, config } = active();
  $('chart-title').textContent = data.title;
  $('chart').innerHTML = chartSvg(data, config);
  $('legend').innerHTML = legendHtml(data, config);
  $('data-table').innerHTML = tableHtml(data);
  $('inspection').textContent = 'เลือกแท่ง จุด หรือส่วนของกราฟเพื่ออ่านค่า';
  const errors = validateChart(data, config);
  const notices = errors.length ? [] : suitability(data, config);
  $('chart-notice').innerHTML = notices.length ? `<div class="notice"><strong>ข้อสังเกต</strong><ul>${notices.map(message => `<li>${esc(message)}</li>`).join('')}</ul></div>` : '';
  $('axis-range').textContent = errors.length || config.kind === 'pie' ? '' : (() => {
    const domain = yDomain(data, config);
    return `ช่วงแกนตั้ง: ${formatNumber(domain.min)} ถึง ${formatNumber(domain.max)} ${data.unit}`;
  })();
  syncCapabilities($('controls'), config);
}

function renderStage(focus = false) {
  renderNavigation();
  $('stage').innerHTML = stageHtml(state);
  updateChart();
  renderFeedback();
  if (focus) {
    $('stage-title').focus({ preventScroll: true });
    $('workspace').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}

function changeMode(mode, focus = true) {
  state.mode = mode;
  renderStage(focus);
}

function changed() {
  if (state.mode === 'guided') {
    const { draft } = current(state);
    if (draft.feedback && !draft.dirty) {
      markChanged(draft);
      renderFeedback();
    }
  }
}

function syncControlValues() {
  const { config } = active();
  $('controls').querySelectorAll('[data-config]').forEach(input => {
    const value = config[input.dataset.config];
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value ?? '';
  });
}

function moveTask(direction) {
  const { lab } = current(state);
  const index = labs.indexOf(lab);
  const next = state.taskIndex + direction;
  if (next >= 0 && next < lab.tasks.length) state.taskIndex = next;
  else if (direction > 0 && index === labs.length - 1) state.mode = 'free';
  else if (labs[index + direction]) {
    state.labId = labs[index + direction].id;
    state.taskIndex = direction < 0 ? labs[index - 1].tasks.length - 1 : 0;
  }
  renderStage(true);
}

function inspectPoint(target) {
  const mark = target.closest('[data-point]');
  if (!mark) return;
  const { data } = active();
  const row = data.rows[Number(mark.dataset.point)];
  if (!row) return;
  const output = mark.closest('#original-chart') ? $('original-inspection') : $('inspection');
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
$('navigation').addEventListener('click', event => {
  const lab = event.target.closest('[data-lab]');
  const dataset = event.target.closest('[data-dataset]');
  if (lab) selectLab(state, lab.dataset.lab);
  else if (dataset) {
    state.free.dataset = copyDataset(dataset.dataset.dataset);
    state.free.config = normalizedConfig(state.free.dataset, state.free.config);
  } else return;
  renderStage(true);
});

$('stage').addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('[data-config]')) return;
  const key = input.dataset.config;
  const { config } = active();
  config[key] = input.type === 'checkbox' ? input.checked : ['baseline', 'upper', 'highlight'].includes(key)
    ? (input.value === '' ? (key === 'upper' ? null : NaN) : Number(input.value)) : input.value;
  changed();
  updateChart();
});

$('stage').addEventListener('input', event => {
  const keys = { prediction: 'prediction', reflection: 'note', 'reflection-2': 'note2' };
  const key = keys[event.target.id];
  if (key && state.mode === 'guided') {
    current(state).draft[key] = event.target.value;
    changed();
  }
});
$('stage').addEventListener('change', event => {
  if (event.target.id === 'prediction' && state.mode === 'guided') {
    current(state).draft.prediction = event.target.value;
    changed();
  }
});

$('stage').addEventListener('click', event => {
  const target = event.target.closest('button');
  if (event.target.closest('[data-point]')) inspectPoint(event.target);
  if (!target) return;
  if (target.hasAttribute('data-task')) {
    state.taskIndex = Number(target.dataset.task);
    renderStage(true);
  } else if (target.id === 'check') {
    const { task, draft } = current(state);
    submit(task, draft);
    renderFeedback();
    renderNavigation();
  } else if (target.id === 'reset-chart') {
    if (state.mode === 'free') {
      const data = copyDataset(state.free.dataset.id);
      state.free.dataset = data;
      state.free.config = normalizedConfig(data, { kind: 'bar', palette: 'uniform', highlight: 2, baseline: 0, upper: null, labels: true });
      // Rebuild the editor because reset also restores the sample data.
      renderStage();
      $('reset-chart').focus({ preventScroll: true });
    } else {
      const { task, draft } = current(state);
      draft.config = { ...task.config };
      changed();
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
  if (event.target.closest('[data-point]') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    inspectPoint(event.target);
  }
});

$('stage').addEventListener('submit', event => {
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

renderStage();
