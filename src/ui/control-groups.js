import { controlsHtml } from './controls.js';
const labels = {
  variables: 'ตัวแปร',
  distribution: 'การกระจายและช่วงชั้น',
  color: 'สี',
  axes: 'แกนและการนำเสนอ',
  labels: 'ป้ายกำกับ'
};
function groupFor(key) {
  if (/^histogram|^grouped|^encoding.group/.test(key)) return 'distribution';
  if (/^color|^palette|^highlight|^grayscale/.test(key)) return 'color';
  if (/^encoding/.test(key)) return 'variables';
  if (key === 'labels') return 'labels';
  return 'axes';
}
// Use the existing control builders and native inputs, including all advanced options.
export function groupedControls(data, config, allowed, free, openGroups, preferred) {
  const template = document.createElement('template');
  template.innerHTML = controlsHtml(data, config, allowed, free);
  const quick = [],
    groups = new Map();
  let last = 'axes';
  for (const child of [...template.content.children]) {
    if (child.tagName === 'H3') continue;
    const input = child.matches('[data-config]') ? child : child.querySelector('[data-config]');
    const key = input?.dataset.config;
    const keyQuick = key === 'kind' && !['color', 'axes'].includes(preferred) || key === `histogram.${config.histogram?.mode === 'width' ? 'width' : 'count'}` && config.histogram?.mode !== 'edges' || key === 'grouped' || preferred === 'color' && ['palette', 'highlight', 'color.schemeType', 'color.field'].includes(key) || preferred === 'axes' && ['presentation', 'windowMode', 'baseline'].includes(key);
    if (keyQuick) {
      quick.push(child.outerHTML);
      continue;
    }
    if (key === 'kind') last = 'variables';else last = key ? groupFor(key) : last;
    if (!groups.has(last)) groups.set(last, []);
    groups.get(last).push(child.outerHTML);
  }
  return `<div class="quick-controls">${quick.join('')}</div>` + [...groups].map(([id, nodes]) => `<details class="control-group" data-control-group="${id}"${openGroups?.includes(id) ? ' open' : ''}><summary>${labels[id]}</summary>${nodes.join('')}</details>`).join('') + '<div id="control-errors" role="status"></div>';
}
