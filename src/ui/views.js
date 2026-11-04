import { escapeHtml as esc } from './html.js';
import { formatNumber } from '../charts/scales.js';
import { isResearch } from '../data/view.js';
import { researchTable } from './research.js';
export function tableHtml(data, config) {
  if (isResearch(data)) return researchTable(data, config);
  return `<table><caption>${esc(data.title)} · ข้อมูลจำลอง</caption><thead><tr><th scope="col">${esc(data.xType === 'category' ? data.xLabel : 'รายการ')}</th>${data.xType !== 'category' ? `<th scope="col">${esc(data.xLabel)}</th>` : ''}<th scope="col">${esc(data.unit)}</th></tr></thead><tbody>${data.rows.map(row => `<tr><th scope="row">${esc(row.label)}</th>${data.xType !== 'category' ? `<td>${formatNumber(row.x)}</td>` : ''}<td>${formatNumber(row.value)}</td></tr>`).join('')}</tbody></table>`;
}
