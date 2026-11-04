import { escapeHtml as esc } from '../ui/html.js';
import { formatNumber, formatPercent } from './scales.js';
export const palettes = {
  categorical: ['#2563A6', '#C15B12', '#168176', '#9461A9', '#9B6B00', '#BE4777', '#477A49', '#6359B5']
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
export function pieMarks(data, config, layout = {}) {
  const cx = (layout.width ?? 640) / 2,
    cy = (layout.height ?? 360) / 2 - 12,
    radius = Math.min(120, (layout.height ?? 360) / 2 - 40, (layout.width ?? 640) / 2 - 35);
  const total = data.rows.reduce((sum, row) => sum + row.value, 0);
  let start = -Math.PI / 2;
  return data.rows.map((row, i) => {
    const angle = row.value / total * Math.PI * 2;
    const attrs = attributes(row, i, config);
    let mark = '';
    if (angle >= Math.PI * 2 - 1e-10) mark = `<circle ${attrs} cx="${cx}" cy="${cy}" r="${radius}"/>`;else if (angle > 0) {
      const x1 = cx + radius * Math.cos(start),
        y1 = cy + radius * Math.sin(start);
      const x2 = cx + radius * Math.cos(start + angle),
        y2 = cy + radius * Math.sin(start + angle);
      mark = `<path ${attrs} d="M${cx} ${cy} L${x1} ${y1} A${radius} ${radius} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z" stroke="white" stroke-width="2"/>`;
      if (config.labels && angle > 0.25) {
        const middle = start + angle / 2;
        mark += `<text x="${cx + radius * .6833333333 * Math.cos(middle)}" y="${cy + 6 + radius * .6833333333 * Math.sin(middle)}" text-anchor="middle" class="pie-label">${formatPercent(row.value / total * 100)}%</text>`;
      }
    }
    start += angle;
    return mark;
  }).join('');
}
