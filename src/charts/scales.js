export const formatNumber = value => new Intl.NumberFormat('th-TH', { maximumSignificantDigits: 6 }).format(value);
export const formatPercent = value => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(value);

export function yDomain(data, config) {
  const highest = Math.max(...data.rows.map(row => row.value));
  const min = config.baseline;
  const top = config.kind === 'bar' ? Math.max(0, highest) : highest;
  const span = top > min ? (top - min) * 1.1 : Math.max(Math.abs(top) * 0.1, 1);
  const rawStep = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const niceStep = [1, 2, 2.5, 5, 10].find(value => value >= fraction) * magnitude;
  const max = config.upper ?? min + niceStep * 4;
  return { min, max };
}

export function linearScale(min, max, start, end) {
  if (max === min) return () => (start + end) / 2;
  return value => start + (value - min) / (max - min) * (end - start);
}

export function normalizedConfig(data, config) {
  const min = Math.min(...data.rows.map(row => row.value));
  return { ...config, baseline: Math.min(0, min), upper: null, highlight: Math.min(config.highlight, data.rows.length - 1) };
}
