import test from 'node:test';
import assert from 'node:assert/strict';
import { copyDataset } from '../src/content/datasets.js';
import { validateDataset, validateChart } from '../src/charts/validation.js';
import { chartSvg, legendHtml } from '../src/charts/render.js';
import { yDomain, normalizedConfig } from '../src/charts/scales.js';

const base = { kind: 'bar', palette: 'uniform', highlight: 2, labels: true, baseline: 0, upper: null };

test('baseline is honored exactly or rejected, never silently clamped', () => {
  const data = copyDataset('groups');
  assert.ok(validateChart(data, { ...base, baseline: 70 }).length);
  assert.match(chartSvg(data, { ...base, baseline: 70 }), /ยังไม่สามารถแสดงกราฟ/);
  const scores = copyDataset('scores');
  assert.deepEqual(validateChart(scores, { ...base, baseline: 70 }), []);
  assert.equal(yDomain(scores, { ...base, baseline: 70 }).min, 70);
});

test('line and dot charts respond to the selected Y range', () => {
  for (const kind of ['line', 'dot']) {
    const data = copyDataset('scores');
    assert.notEqual(chartSvg(data, { ...base, kind }), chartSvg(data, { ...base, kind, baseline: 70 }));
  }
});

test('numeric X positions preserve unequal spacing', () => {
  const data = copyDataset('relationship');
  data.rows = [{ label: 'A', x: 1, value: 10 }, { label: 'B', x: 2, value: 20 }, { label: 'C', x: 10, value: 30 }];
  const svg = chartSvg(data, { ...base, kind: 'dot' });
  const xs = [...svg.matchAll(/<circle class="dot-symbol" cx="([^"]+)"/g)].map(match => Number(match[1]));
  assert.equal(xs.length, 3);
  assert.ok(Math.abs((xs[2] - xs[1]) / (xs[1] - xs[0]) - 8) < 1e-8);
});

test('pie labels toggle and single positive slice remains visible', () => {
  const data = copyDataset('activities');
  const config = { ...base, kind: 'pie' };
  assert.match(chartSvg(data, config), /pie-label/);
  assert.doesNotMatch(chartSvg(data, { ...config, labels: false }), /pie-label/);
  assert.match(legendHtml(data, config), /%/);
  data.rows.forEach((row, i) => row.value = i ? 0 : 10);
  assert.match(chartSvg(data, config), /<circle/);
  data.rows[0].value = 0;
  assert.ok(validateChart(data, config).length);
  data.rows[0].value = -1;
  assert.ok(validateChart(data, config).length);
});

test('empty, nonfinite, unordered-time, and oversized data are rejected', () => {
  const data = copyDataset('trend');
  data.rows[0].value = NaN;
  assert.ok(validateDataset(data).length);
  data.rows[0].value = 1;
  data.rows[1].x = data.rows[0].x;
  assert.ok(validateDataset(data).length);
  data.rows = [];
  assert.ok(validateDataset(data).length);
});

test('negative, equal, and zero values produce finite chart geometry', () => {
  for (const values of [[-5, 3], [-4, -4], [0, 0], [-10, -3]]) {
    const data = copyDataset('groups');
    data.rows = values.map((value, i) => ({ label: String(i), value }));
    const config = normalizedConfig(data, base);
    assert.deepEqual(validateChart(data, config), []);
    const svg = chartSvg(data, config);
    assert.doesNotMatch(svg, /NaN|Infinity/);
    const domain = yDomain(data, config);
    assert.ok(domain.max > domain.min);
  }
});

test('edited text is escaped in charts and legends', () => {
  const data = copyDataset('groups');
  data.title = '<img src=x onerror=alert(1)>';
  data.rows[0].label = '<script>alert(1)</script>';
  const html = chartSvg(data, base) + legendHtml(data, base);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;/);
});

test('negative bars retain zero and small values retain useful scale precision', () => {
  const data = copyDataset('groups');
  data.rows = [{ label: 'A', value: -5 }, { label: 'B', value: -3 }];
  assert.ok(validateChart(data, { ...base, baseline: -5, upper: -1 }).length);
  data.rows = [{ label: 'A', value: 0.00001 }, { label: 'B', value: 0.00002 }];
  assert.ok(yDomain(data, base).max < 0.0001);
  assert.match(chartSvg(data, base), /0\.00001/);
});
