import { escapeHtml as esc } from '../ui/html.js';
import { formatNumber, formatPercent } from './scales.js';

export const palettes = {
  categorical: ['#2563A6', '#C15B12', '#168176', '#9461A9', '#9B6B00', '#BE4777', '#477A49', '#6359B5'],
};
export function colorFor(config, i) {
  if (config.palette === 'highlight') return i === config.highlight ? '#C15B12' : '#A3B0BF';
  return config.palette === 'categorical' ? palettes.categorical[i % palettes.categorical.length] : '#2563A6';
}
function attributes(row, i, config) {
  return `class="mark" data-point="${i}" tabindex="0" role="button" aria-label="${esc(row.label)}: ${esc(formatNumber(row.value))}" fill="${colorFor(config, i)}"`;
}
export function barMark(row, i, config, x, y, width, base) {
  const point = y(row.value);
  return `<rect ${attributes(row, i, config)} x="${x - width / 2}" y="${Math.min(base, point)}" width="${width}" height="${Math.max(Math.abs(base - point), 1)}" rx="2"><title>${esc(row.label)}: ${formatNumber(row.value)}</title></rect>`;
}
export function dotMark(row, i, config, x, y) {
  return `<g ${attributes(row, i, config)}><title>${esc(row.label)}: ${formatNumber(row.value)}</title><circle class="hit-area" cx="${x}" cy="${y(row.value)}" r="22" fill="transparent" pointer-events="all"/><circle class="dot-symbol" cx="${x}" cy="${y(row.value)}" r="7" fill="${colorFor(config, i)}" stroke="white" stroke-width="2" pointer-events="none"/></g>`;
}
export function lineMark(points) {
  return `<polyline points="${points.map(point => point.join(',')).join(' ')}" fill="none" stroke="#526175" stroke-width="3" stroke-linejoin="round"/>`;
}
export function pieMarks(data, config) {
  const total = data.rows.reduce((sum, row) => sum + row.value, 0);
  let start = -Math.PI / 2;
  return data.rows.map((row, i) => {
    const angle = row.value / total * Math.PI * 2;
    const attrs = attributes(row, i, config);
    let mark = '';
    if (angle >= Math.PI * 2 - 1e-10) mark = `<circle ${attrs} cx="320" cy="168" r="120"/>`;
    else if (angle > 0) {
      const x1 = 320 + 120 * Math.cos(start), y1 = 168 + 120 * Math.sin(start);
      const x2 = 320 + 120 * Math.cos(start + angle), y2 = 168 + 120 * Math.sin(start + angle);
      mark = `<path ${attrs} d="M320 168 L${x1} ${y1} A120 120 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z" stroke="white" stroke-width="2"/>`;
      if (config.labels && angle > 0.25) {
        const middle = start + angle / 2;
        mark += `<text x="${320 + 82 * Math.cos(middle)}" y="${174 + 82 * Math.sin(middle)}" text-anchor="middle" class="pie-label">${formatPercent(row.value / total * 100)}%</text>`;
      }
    }
    start += angle;
    return mark;
  }).join('');
}
