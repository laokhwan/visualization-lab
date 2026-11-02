import { labs, predictions } from '../content/labs.js';
import { datasets } from '../content/datasets.js';
import { th } from '../content/locales/th.js';
import { current } from '../state.js';
import { controlsHtml, editorHtml } from './controls.js';
import { escapeHtml as esc, options } from './html.js';
import { chartSvg, legendHtml } from '../charts/render.js';
import { formatNumber } from '../charts/scales.js';

export function navigationHtml(state) {
  if (state.mode === 'free') return '<h2>ชุดข้อมูล (Dataset)</h2>' + Object.values(datasets).map(data => `<button class="nav-item" data-dataset="${data.id}"${state.free.dataset.id === data.id ? ' aria-current="true"' : ''}><span><strong>${esc(data.title)}</strong><small>${data.rows.length} รายการ · ${esc(data.unit)}</small></span></button>`).join('');
  return '<h2>กิจกรรมการเรียนรู้</h2>' + labs.map((lab, i) => {
    const drafts = state.guided[lab.id];
    const status = drafts.every(draft => draft.everPassed) ? '✓ ผ่านเกณฑ์แล้ว' : drafts.some(draft => draft.attempts) ? 'ลองทำแล้ว' : 'ยังไม่ได้ตรวจ';
    return `<button class="nav-item" data-lab="${lab.id}"${state.labId === lab.id ? ' aria-current="step"' : ''}><span class="nav-number">${String(i + 1).padStart(2, '0')}</span><span><strong>${lab.title}</strong><small>${lab.english}</small><small>${status}</small></span></button>`;
  }).join('');
}

function previewHtml() {
  return `<section class="preview" aria-labelledby="chart-title"><div class="preview-header"><div><p class="eyebrow">กราฟที่ปรับได้</p><h3 id="chart-title"></h3></div><button id="reset-chart" class="secondary">คืนค่ากราฟ</button></div>
    <div id="chart" class="chart-scroll" tabindex="0" aria-label="พื้นที่กราฟ เลื่อนแนวนอนได้"></div>
    <ul id="legend" class="legend" aria-label="คำอธิบายข้อมูล"></ul>
    <p class="help">แตะจุดข้อมูลเพื่ออ่านค่า หากกราฟกว้างเกินพื้นที่ ให้เลื่อนในกราฟ</p>
    <p id="inspection" class="inspection" role="status">เลือกแท่ง จุด หรือส่วนของกราฟเพื่ออ่านค่า</p>
    <div id="chart-notice" role="status"></div><p id="axis-range" class="help"></p>
    <details><summary>ดูตารางข้อมูล</summary><div id="data-table" class="table-scroll"></div></details></section>`;
}

export function stageHtml(state) {
  const free = state.mode === 'free';
  const { lab, task, draft } = current(state);
  const data = free ? state.free.dataset : datasets[task.dataset];
  const config = free ? state.free.config : draft.config;
  const header = `<div class="stage-header"><div><p class="eyebrow">${free ? th.free : `กิจกรรม ${labs.indexOf(lab) + 1} / ${labs.length}`}</p><h2 id="stage-title" tabindex="-1">${free ? 'ทดลองการนำเสนอข้อมูล' : `${lab.title} <small>(${lab.english})</small>`}</h2><p class="intro">${free ? 'ปรับชนิดกราฟ สี แกน และข้อมูล เพื่อสังเกตผลที่เปลี่ยนไป' : lab.intro}</p></div>${free ? '' : `<span class="pill">สถานการณ์ ${state.taskIndex + 1} / ${lab.tasks.length}</span>`}</div>`;
  const taskNav = !free && lab.tasks.length > 1 ? `<div class="button-row" role="group" aria-label="สถานการณ์">${lab.tasks.map((item, i) => `<button class="secondary" data-task="${i}" aria-pressed="${i === state.taskIndex}">สถานการณ์ ${i + 1}</button>`).join('')}</div>` : '';
  let prediction = '';
  if (!free) {
    const field = task.prediction === 'text'
      ? `<textarea id="prediction" maxlength="1000">${esc(draft.prediction)}</textarea>`
      : `<select id="prediction">${options(predictions[task.prediction] || th.prediction, draft.prediction)}</select>`;
    prediction = `<section class="step"><h3 class="step-heading"><span class="step-number">1</span>คาดการณ์</h3><div class="field"><label for="prediction">${task.predict}</label>${field}</div><p class="help">บันทึกความคิดก่อนทดลอง คำคาดการณ์ไม่จำเป็นต้องถูกต้อง</p></section>`;
  }
  const original = !free && lab.compare ? `<details class="original" open><summary>กราฟต้นฉบับสำหรับเปรียบเทียบ</summary><div id="original-chart" class="chart-scroll" tabindex="0" aria-label="กราฟต้นฉบับ เลื่อนแนวนอนได้">${chartSvg(data, task.config, 'original')}</div><ul class="legend">${legendHtml(data, task.config)}</ul><p class="help">ต้นฉบับเริ่มแกนที่ ${task.config.baseline} · ข้อมูลเดียวกับกราฟที่ปรับได้</p><p id="original-inspection" class="inspection" role="status">เลือกข้อมูลในกราฟต้นฉบับเพื่ออ่านค่า</p></details>` : '';
  const reflection = free ? editorHtml(data) : `<section class="reflection"><h3 class="step-heading"><span class="step-number">3</span>อธิบายผล</h3><div class="field"><label for="reflection">${task.prompt}</label><textarea id="reflection" maxlength="2000" aria-describedby="reflection-notice">${esc(draft.note)}</textarea></div>${task.secondPrompt ? `<div class="field"><label for="reflection-2">${task.secondPrompt}</label><textarea id="reflection-2" maxlength="2000">${esc(draft.note2)}</textarea></div>` : ''}<p id="reflection-notice" class="help">${th.reflectionNotice}</p><button id="check" class="primary">ตรวจเกณฑ์กิจกรรม</button><div id="feedback" class="feedback" aria-live="polite" aria-atomic="true"></div></section>`;
  const labIndex = labs.indexOf(lab);
  return header + taskNav + (free ? '' : `<div class="mission"><strong>โจทย์</strong><p>${task.mission}</p></div>`) + prediction + original +
    `<section class="step">${free ? '' : '<h3 class="step-heading"><span class="step-number">2</span>ทดลองปรับกราฟ</h3>'}<div class="editor"><div id="controls" class="controls">${controlsHtml(data, config, free ? ['kind', 'palette', 'highlight', 'baseline'] : lab.controls, free)}</div>${previewHtml()}</div></section>` + reflection +
    (free ? '<div class="stage-actions"><button class="secondary" id="return-guided">กลับสู่กิจกรรมตามขั้นตอน</button></div>' : `<div class="stage-actions"><button id="previous" class="secondary"${labIndex === 0 && state.taskIndex === 0 ? ' disabled' : ''}>← กิจกรรมก่อนหน้า</button><button id="next" class="secondary">${labIndex === labs.length - 1 && state.taskIndex === lab.tasks.length - 1 ? 'เปิดการทดลองอิสระ →' : 'กิจกรรมถัดไป →'}</button></div>`);
}

export function tableHtml(data) {
  return `<table><caption>${esc(data.title)} · ข้อมูลจำลอง</caption><thead><tr><th scope="col">${esc(data.xType === 'category' ? data.xLabel : 'รายการ')}</th>${data.xType !== 'category' ? `<th scope="col">${esc(data.xLabel)}</th>` : ''}<th scope="col">${esc(data.unit)}</th></tr></thead><tbody>${data.rows.map(row => `<tr><th scope="row">${esc(row.label)}</th>${data.xType !== 'category' ? `<td>${formatNumber(row.x)}</td>` : ''}<td>${formatNumber(row.value)}</td></tr>`).join('')}</tbody></table>`;
}

export function feedbackHtml(draft) {
  if (!draft.feedback) return '<p class="help">ยังไม่ได้ตรวจเกณฑ์กิจกรรม</p>';
  return `<p${draft.feedback.passed && !draft.dirty ? ' class="success"' : ''}>${draft.dirty ? 'มีการปรับคำตอบหลังการตรวจ กรุณาตรวจอีกครั้ง · ผลเดิมแสดงด้านล่าง' : draft.feedback.passed ? '✓ ผ่านเกณฑ์การตั้งค่าและกรอกคำอธิบายแล้ว' : 'ยังไม่ผ่านเกณฑ์ครบทุกข้อ โปรดพิจารณาคำแนะนำ'}</p><p class="help">ตรวจแล้ว ${draft.attempts} ครั้ง${draft.everPassed ? ' · เคยผ่านเกณฑ์กิจกรรมนี้แล้ว' : ''}</p><ul class="criteria">${draft.feedback.criteria.map(criterion => `<li><span class="criterion-icon" aria-label="${criterion.passed ? 'ผ่าน' : 'ควรปรับ'}">${criterion.passed ? '✓' : '○'}</span>${esc(criterion.label)}${criterion.passed ? '' : `<p class="help">${esc(criterion.hint)}</p>`}</li>`).join('')}</ul>`;
}
