import { th } from '../content/locales/th.js';
import { options, escapeHtml as esc } from './html.js';

function select(id, label, items, value) {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${id}">${options(items, value)}</select></div>`;
}

export function controlsHtml(data, config, allowed, free) {
  let html = '<h3>ปรับกราฟ</h3>';
  if (allowed.includes('kind')) html += select('kind', 'ชนิดกราฟ', th.kinds, config.kind);
  if (allowed.includes('palette')) html += select('palette', 'รูปแบบสี', th.palettes, config.palette);
  if (allowed.includes('highlight')) html += `<div id="highlight-field">${select('highlight', 'หมวดหมู่ที่ต้องการเน้น', data.rows.map((row, i) => [i, row.label]), config.highlight)}</div>`;
  if (allowed.includes('baseline')) {
    html += `<fieldset id="axis-controls"><legend>แกนตั้ง (Y-axis)</legend><div class="field"><label for="baseline">จุดเริ่มแกน</label><input id="baseline" data-config="baseline" type="number" inputmode="decimal" step="any" value="${config.baseline}"></div>`;
    if (free) html += `<div class="field"><label for="upper">จุดสิ้นสุดแกน</label><input id="upper" data-config="upper" type="number" inputmode="decimal" step="any" value="${config.upper ?? ''}" placeholder="อัตโนมัติ"></div>`;
    html += '<button id="fit-axis" type="button" class="text-button">ปรับแกนให้ครอบคลุมข้อมูล</button></fieldset><p id="axis-help" class="help">ช่วงแกนต้องครอบคลุมข้อมูลทั้งหมด</p>';
  }
  html += `<label class="check"><input id="labels" data-config="labels" type="checkbox"${config.labels ? ' checked' : ''}> แสดงค่าบนกราฟ</label>`;
  return html;
}

export function syncCapabilities(root, config) {
  const axis = root.querySelector('#axis-controls');
  if (axis) axis.disabled = config.kind === 'pie';
  const help = root.querySelector('#axis-help');
  if (help) help.textContent = config.kind === 'pie' ? 'กราฟวงกลมไม่มีแกนตั้ง' : 'ช่วงแกนต้องครอบคลุมข้อมูลทั้งหมด';
  const highlight = root.querySelector('#highlight');
  if (highlight) highlight.disabled = config.palette !== 'highlight';
}

export function editorHtml(data) {
  return `<details id="data-editor"><summary>แก้ไขข้อมูลตัวอย่าง</summary><form id="data-form" novalidate>
    <p class="help">ใช้ข้อมูลจำลองเท่านั้น ข้อมูลที่แก้ไขจะหายเมื่อปิดหรือโหลดหน้าใหม่</p>
    <div class="metadata"><div class="field"><label for="edit-title">ชื่อกราฟ</label><input id="edit-title" name="title" maxlength="100" value="${esc(data.title)}"></div>
    <div class="field"><label for="edit-unit">หน่วย</label><input id="edit-unit" name="unit" maxlength="40" value="${esc(data.unit)}"></div>
    <div class="field"><label for="edit-x-label">ชื่อแกนนอน / หมวดหมู่</label><input id="edit-x-label" name="xLabel" maxlength="60" value="${esc(data.xLabel)}"></div></div>
    <div class="table-scroll"><table><caption>ข้อมูลสำหรับทดลอง · 2–8 แถว</caption><thead><tr><th scope="col">ชื่อข้อมูล</th>${data.xType !== 'category' ? '<th scope="col">ค่าแกนนอน</th>' : ''}<th scope="col">ค่า</th><th scope="col">จัดการ</th></tr></thead><tbody id="edit-rows">${data.rows.map((row, i) => editorRow(row, i, data.xType)).join('')}</tbody></table></div>
    <div class="button-row"><button id="add-row" type="button" class="secondary">เพิ่มแถว</button><button class="primary" type="submit">นำข้อมูลไปใช้</button></div>
    <p id="data-errors" role="status" class="form-message"></p></form></details>`;
}

export function editorRow(row, index, xType) {
  const number = index + 1;
  return `<tr><td><input data-col="label" aria-label="ชื่อข้อมูล แถว ${number}" maxlength="40" value="${esc(row.label)}"></td>${xType !== 'category' ? `<td><input data-col="x" aria-label="ค่าแกนนอน แถว ${number}" type="number" inputmode="decimal" step="any" value="${esc(row.x ?? '')}"></td>` : ''}<td><input data-col="value" aria-label="ค่าข้อมูล แถว ${number}" type="number" inputmode="decimal" step="any" value="${esc(row.value)}"></td><td><button type="button" data-remove-row aria-label="ลบแถว ${number}" class="text-button">ลบ</button></td></tr>`;
}
