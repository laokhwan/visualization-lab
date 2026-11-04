import { labs, predictions } from '../content/labs.js';
import { datasets } from '../content/datasets.js';
import { th } from '../content/locales/th.js';
import { current } from '../state.js';
import { steps, taskUi, canVisitStep, comparisonsReady } from '../workspace.js';
import { escapeHtml as esc, options } from './html.js';
import { questionHtml, reflectionStatus, completionFeedbackHtml } from './practice.js';
import { completionCriteria } from '../learning/practice.js';
import { editorHtml } from './controls.js';
import { isResearch } from '../data/view.js';
import { researchEditor } from './research.js';
const foundationTitles = {
  'choose/compare': 'เปรียบเทียบห้องเรียน',
  'choose/time': 'แนวโน้มตามเวลา',
  'color/focus': 'เน้นข้อมูลห้อง C',
  'misleading/axis': 'ผลของจุดเริ่มแกน',
  'redesign/revision': 'ปรับปรุงกราฟคะแนน'
};
export function contextHtml(state) {
  const {
    lab,
    task
  } = current(state);
  return `<div class="context-selects">${state.mode === 'guided' ? `<div class="field"><label for="lab-select">แล็บ</label><select id="lab-select">${options(labs.map(l => [l.id, l.title]), lab.id)}</select></div><div class="field"><label for="task-select">สถานการณ์</label><select id="task-select">${options(lab.tasks.map((t, i) => [i, `${i + 1}. ${t.title || foundationTitles[`${lab.id}/${t.id}`] || t.mission} (${t.section === 'extension' ? 'เพิ่มเติม' : 'พื้นฐาน'})`]), state.taskIndex)}</select></div>` : `<div class="field dataset-select"><label for="dataset-select">ชุดข้อมูล</label><select id="dataset-select">${options(Object.values(datasets).map(d => [d.id, d.title]), state.free.dataset.id)}</select></div><span class="context-caption">ทดลองอิสระ · ไม่มีการประเมิน</span>`}</div>`;
}
export function stepNavigation(state) {
  const {
      lab,
      task,
      draft
    } = current(state),
    ui = taskUi(state, lab.id, task);
  return `<nav class="step-nav" aria-label="ขั้นการเรียนรู้"><ol>${steps.map(([id, label], i) => `<li><button type="button" data-step="${id}"${ui.step === id ? ' aria-current="step"' : ''}${canVisitStep(task, draft, id) ? '' : ` disabled aria-describedby="step-lock"`}><span aria-hidden="true">${i + 1}</span>${label}</button></li>`).join('')}</ol></nav><p id="step-lock" class="sr-only">บันทึกคำคาดการณ์ก่อนทดลอง และบันทึกกราฟครบสองรูปแบบก่อนอธิบายผล</p>`;
}
export function sourceOptions(task, draft) {
  return [['current', 'กราฟที่กำลังปรับ'], ['original', 'กราฟเริ่มต้น'], ...draft.experiments.map((s, i) => [s.slotId, `แบบ ${'AB'[i]}: ${s.label}`]), ...(draft.completion ? [['completion', 'กราฟเมื่อทำครบ']] : [])];
}
function chartPane(state) {
  const {
      lab,
      task,
      draft
    } = current(state),
    free = state.mode === 'free',
    ui = free ? null : taskUi(state, lab.id, task);
  return `<section class="preview" aria-labelledby="chart-title"><div class="preview-header"><div><h3 id="chart-title"></h3><p class="help" id="chart-context"></p></div><button type="button" id="reset-chart" class="text-button"${!free && (ui.step !== 'experiment' || ui.source !== 'current') ? ' hidden' : ''}>คืนค่ากราฟ</button></div>${free ? '' : `<div class="source-picker"><label for="chart-source">กราฟที่แสดง</label><select id="chart-source">${options(sourceOptions(task, draft), ui.source)}</select><span id="chart-readonly" class="help"></span></div>`}<div id="chart" class="chart-scroll" tabindex="0" aria-label="กราฟโต้ตอบ มีตารางข้อมูลประกอบ"></div><ul id="legend" class="legend" aria-label="คำอธิบายข้อมูล"></ul><p id="inspection" class="inspection" role="status">แตะหรือเลือกจุดข้อมูลเพื่ออ่านค่า</p><div id="chart-notice" role="status"></div></section>`;
}
function prediction(task, draft) {
  const field = task.prediction === 'text' ? `<textarea id="prediction" maxlength="1000"${draft.predictionSaved ? ' disabled' : ''}>${esc(draft.prediction)}</textarea>` : `<select id="prediction"${draft.predictionSaved ? ' disabled' : ''}>${options(predictions[task.prediction] || th.prediction, draft.prediction)}</select>`;
  return `<h3 id="step-title" tabindex="-1">คาดการณ์ก่อนทดลอง</h3><div class="field"><label for="prediction">${esc(task.predict)}</label>${field}</div><p class="help">คำคาดการณ์ไม่ถูกให้คะแนน และไม่ลด Mastery</p><p id="prediction-message" role="status"></p><div class="panel-actions">${draft.predictionSaved ? '<p class="success">บันทึกคำคาดการณ์แล้ว</p><button class="primary" data-step="experiment">ไปทดลอง</button>' : '<button id="save-prediction" class="primary">บันทึกและเริ่มทดลอง</button>'}</div>`;
}
export function experimentChecklist(task, draft) {
  return `<details class="experiment-proof"><summary>คู่เปรียบเทียบและหลักฐาน</summary><ul class="experiment-checklist">${task.experiment.map((slot, i) => {
    const saved = draft.experiments.some(s => s.slotId === slot.id);
    return `<li>${saved ? `✓ <button class="text-button" data-source="${slot.id}">แบบ ${'AB'[i]}: ${esc(slot.label)}</button>` : `○ ${esc(slot.label)}`}</li>`;
  }).join('')}</ul></details>`;
}
function experiment(task, draft, ui) {
  const ready = comparisonsReady(task, draft),
    editable = ui.source === 'current';
  return `<h3 id="step-title" tabindex="-1">ทดลองและเปรียบเทียบ</h3><div id="controls"><fieldset id="experiment-controls" class="controls-fieldset"${editable ? '' : ' disabled'}><legend class="sr-only">ตัวควบคุมกราฟ</legend><div id="control-fields"></div></fieldset></div><p class="experiment-next">${ready ? '✓ บันทึกครบ 2 รูปแบบ' : `บันทึกแล้ว ${draft.experiments.length}/2 · ต่อไป: ${esc(task.experiment.find(slot => !draft.experiments.some(s => s.slotId === slot.id)).label)}`}</p><div class="panel-actions">${!editable ? '<button class="primary" data-source="current">กลับไปปรับกราฟ</button>' : ready ? '<button class="primary" data-step="explain">ไปอธิบายผล</button>' : '<button id="record-experiment" class="primary">บันทึกแบบเปรียบเทียบ</button>'}</div><p id="experiment-message" role="status"></p><div id="experiments-list">${experimentChecklist(task, draft)}</div>`;
}
export function explanationPanel(task, draft, ui) {
  const i = ui.questionIndex,
    id = task.questionIds[i];
  const nav = `<div class="question-nav" role="group" aria-label="ส่วนอธิบายผล">${task.questionIds.map((id, index) => `<button class="secondary" data-question-index="${index}" aria-pressed="${i === index}">ข้อ ${index + 1}${draft.questions[id].masteryStatus === 'mastered' ? ' ✓' : ''}</button>`).join('')}<button class="secondary" data-question-index="${task.questionIds.length}" aria-pressed="${i === task.questionIds.length}">สะท้อนคิด</button></div>`;
  if (id) return `<h3 id="step-title" tabindex="-1">อธิบายจากหลักฐาน</h3>${nav}<section id="reasoning"><section id="question-${id}" class="question-card" aria-labelledby="${id}-title">${questionHtml(id, draft.questions[id], i, {
    workspace: true,
    last: i === task.questionIds.length - 1
  })}</section></section>`;
  return `<h3 id="step-title" tabindex="-1">สะท้อนคิด</h3>${nav}<section id="reasoning"><div class="field"><label for="reflection">${esc(task.prompt)}</label><textarea id="reflection" maxlength="2000" aria-describedby="reflection-notice">${esc(draft.note)}</textarea><p id="reflection-status-1" class="help">${reflectionStatus(draft.note)}</p></div>${task.secondPrompt ? `<div class="field"><label for="reflection-2">${esc(task.secondPrompt)}</label><textarea id="reflection-2" maxlength="2000">${esc(draft.note2)}</textarea><p id="reflection-status-2" class="help">${reflectionStatus(draft.note2)}</p></div>` : ''}<p id="reflection-notice" class="help">ระบบตรวจเพียงการกรอกข้อความ ยังไม่ได้ประเมินเหตุผล</p><div class="panel-actions"><button class="primary" data-step="feedback">ตรวจความพร้อม</button></div></section>`;
}
function feedback(task, draft) {
  const criteria = completionCriteria(task, draft),
    passed = criteria.every(c => c.passed);
  const savedPrediction = draft.completion ? task.prediction === 'text' ? draft.completion.prediction : (predictions[task.prediction] || th.prediction).find(([id]) => id === draft.completion.prediction)?.[1] || draft.completion.prediction : '';
  const missingQuestions = task.questionIds.some(id => draft.questions[id].masteryStatus !== 'mastered');
  const missingText = !draft.note.trim() || task.secondPrompt && !draft.note2.trim();
  return `<h3 id="step-title" tabindex="-1">ทบทวนและบันทึกกิจกรรม</h3><div id="completion-feedback" tabindex="-1" role="status">${draft.completionFeedback || draft.completion ? completionFeedbackHtml(draft) : `<p>${passed ? 'พร้อมบันทึกกิจกรรม' : 'ยังทำกิจกรรมไม่ครบ'}</p><ul class="criteria">${criteria.map(c => `<li>${c.passed ? '✓' : '○'} ${esc(c.label)}${!c.passed && c.hint ? `<p class="help">${esc(c.hint)}</p>` : ''}</li>`).join('')}</ul>`}</div>${draft.completion ? `<details id="completed-review"><summary>คำคาดการณ์และสะท้อนคิดเมื่อทำครบ</summary><p class="help">เลือก “กราฟเมื่อทำครบ” เพื่อดูกราฟที่บันทึก การทดลองต่อไม่เปลี่ยนหลักฐานเดิม</p><p class="saved-text">${esc(savedPrediction)}</p>${draft.completion.reflections.map(note => `<p class="saved-text">${esc(note)}</p>`).join('')}<p class="help">สะท้อนคิด — ยังไม่ได้ประเมินเหตุผล</p></details>` : ''}<div class="panel-actions">${draft.completion ? '<button id="next" class="primary">สถานการณ์ถัดไป</button><button id="complete-task" class="secondary">ตรวจเกณฑ์ปัจจุบัน</button>' : passed ? '<button id="complete-task" class="primary">บันทึกกิจกรรม</button>' : `<button class="primary" data-explain-target="${missingQuestions ? 'question' : missingText ? 'reflection' : ''}"${!missingQuestions && !missingText ? ' data-edit-chart' : ''} data-step="${missingQuestions || missingText ? 'explain' : 'experiment'}">${missingQuestions ? 'กลับไปฝึกคำถาม' : missingText ? 'กลับไปสะท้อนคิด' : 'กลับไปปรับกราฟ'}</button>`}</div>`;
}
export function workspaceHtml(state) {
  const {
      lab,
      task,
      draft
    } = current(state),
    free = state.mode === 'free',
    ui = free ? null : taskUi(state, lab.id, task);
  if (free && state.ui.freeView === 'data') return `<header class="data-view-header"><h2 id="stage-title" tabindex="-1">แก้ไขข้อมูลจำลอง</h2><button id="back-to-chart" class="secondary">กลับกราฟ</button></header><p class="help">ข้อมูลร่างยังไม่เปลี่ยนกราฟจนกดนำข้อมูลไปใช้ และไม่บันทึกข้ามการโหลดหน้า</p><div id="free-editor-host">${isResearch(state.free.dataset) ? researchEditor(state.free.editorDraft || state.free.dataset, state.free.editorPage || 0) : editorHtml(state.free.editorDraft || state.free.dataset)}</div><p id="practice-announcement" class="sr-only" role="status"></p>`;
  const panel = free ? `<h3 id="step-title" tabindex="-1">ปรับกราฟ</h3><div id="controls"><div id="control-fields"></div></div>` : ui.step === 'predict' ? prediction(task, draft) : ui.step === 'experiment' ? experiment(task, draft, ui) : ui.step === 'explain' ? explanationPanel(task, draft, ui) : feedback(task, draft);
  return `<h2 id="stage-title" class="sr-only" tabindex="-1">${free ? 'ทดลองอิสระ' : `${lab.title}: ${task.title || task.mission}`}</h2>${free ? '' : stepNavigation(state) + `<div class="workspace-mission"><strong>โจทย์</strong> ${esc(task.mission)}${task.explanation ? `<details><summary>แนวคิดประกอบ</summary><p>${esc(task.explanation)}</p></details>` : ''}</div>`}<div class="learning-board" data-phase="${free ? 'free' : ui.step}">${chartPane(state)}<section class="context-panel" aria-labelledby="step-title">${panel}</section></div><div class="workspace-tools">${free ? '<button id="edit-data" class="secondary">แก้ข้อมูล</button>' : '<button id="previous" class="text-button">สถานการณ์ก่อนหน้า</button>'}<button id="show-data" class="text-button">ดูตารางและสถิติ</button></div><details class="chart-details"><summary>ตาราง สถิติ และคำอธิบาย</summary><p id="axis-range" class="help"></p><div id="data-table" class="table-scroll"></div></details><p id="practice-announcement" class="sr-only" role="status" aria-live="polite"></p>`;
}
