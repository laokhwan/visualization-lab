import { escapeHtml as esc } from '../ui/html.js';
import { validateChart } from './validation.js';
import { yDomain, linearScale, formatNumber, formatPercent } from './scales.js';
import { barMark, dotMark, lineMark, pieMarks, colorFor } from './marks.js';

export function chartSvg(data, config, prefix = 'live-svg') {
  const errors = validateChart(data, config);
  if (errors.length) return `<div class="chart-error" role="status"><strong>ยังไม่สามารถแสดงกราฟ</strong><ul>${errors.map(error => `<li>${esc(error)}</li>`).join('')}</ul></div>`;
  let svg = `<svg viewBox="0 0 640 360" role="group" aria-labelledby="${prefix}-title ${prefix}-desc"><title id="${prefix}-title">${esc(data.title)}</title><desc id="${prefix}-desc">ข้อมูลจำลอง หน่วย ${esc(data.unit)} แตะหรือเลือกจุดข้อมูลเพื่ออ่านค่า มีตารางข้อมูลประกอบด้านล่าง</desc>`;
  if (config.kind === 'pie') return svg + pieMarks(data, config) + `<text x="320" y="337" text-anchor="middle" class="axis-label">สัดส่วนของผลรวม · ${esc(data.unit)}</text></svg>`;
  const left = 76, right = 610, top = 42, bottom = 278;
  const domain = yDomain(data, config);
  const y = linearScale(domain.min, domain.max, bottom, top);
  for (let i = 0; i <= 4; i++) {
    const value = domain.min + (domain.max - domain.min) * i / 4;
    const yy = y(value);
    svg += `<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" class="gridline"/><text x="${left - 10}" y="${yy + 5}" text-anchor="end" class="tick">${formatNumber(value)}</text>`;
  }
  svg += `<text x="${left}" y="23" class="axis-label">${esc(data.unit)}</text><line x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" class="axis"/>`;
  const numericX = data.xType !== 'category' && config.kind !== 'bar';
  const xs = data.rows.map(row => row.x);
  const xScale = numericX ? linearScale(Math.min(...xs), Math.max(...xs), left + 30, right - 25) : null;
  const getX = (row, i) => numericX ? xScale(row.x) : left + (i + 0.5) * (right - left) / data.rows.length;
  if (config.kind === 'line') svg += lineMark(data.rows.map((row, i) => [getX(row, i), y(row.value)]).sort((a, b) => a[0] - b[0]));
  const width = Math.min(62, (right - left) / data.rows.length * 0.58);
  const base = y(Math.max(domain.min, Math.min(0, domain.max)));
  const ticksSeen = new Set();
  data.rows.forEach((row, i) => {
    const x = getX(row, i);
    svg += config.kind === 'bar' ? barMark(row, i, config, x, y, width, base) : dotMark(row, i, config, x, y);
    const label = numericX && data.xType === 'number' ? formatNumber(row.x) : row.label;
    if (!numericX || !ticksSeen.has(row.x)) {
      const short = label.length > 12 ? label.slice(0, 11) + '…' : label;
      svg += `<text x="${x}" y="303" text-anchor="middle" class="tick"><title>${esc(label)}</title>${esc(short)}</text>`;
      ticksSeen.add(row.x);
    }
    if (config.labels) svg += `<text x="${x}" y="${row.value < 0 ? Math.min(295, y(row.value) + 20) : Math.max(34, y(row.value) - 12)}" text-anchor="middle" class="value-label">${formatNumber(row.value)}</text>`;
  });
  return svg + `<text x="343" y="341" text-anchor="middle" class="axis-label">${esc(data.xLabel)}</text></svg>`;
}

export function legendHtml(data, config) {
  const total = data.rows.reduce((sum, row) => sum + row.value, 0);
  return data.rows.map((row, i) => `<li><span class="swatch" style="background:${colorFor(config, i)}" aria-hidden="true"></span>${esc(row.label)}${config.labels && config.kind === 'pie' && total > 0 ? ` · ${formatNumber(row.value)} (${formatPercent(row.value / total * 100)}%)` : ''}</li>`).join('');
}
