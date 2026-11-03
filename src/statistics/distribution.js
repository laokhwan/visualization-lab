export const calculationVersion = 'R7-Tukey1.5-leftClosed-v1';
export function finiteValues(values) { return values.filter(value => typeof value === 'number' && Number.isFinite(value)); }
export function quantile(values, p) {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error('สัดส่วนควอร์ไทล์ต้องอยู่ระหว่าง 0 และ 1');
  const sorted = finiteValues(values).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * p, i = Math.floor(h);
  return sorted[i] + (h - i) * (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]);
}
export function computeBoxSummary(values) {
  const sorted = finiteValues(values).sort((a, b) => a - b), n = sorted.length;
  if (!n) return { n: 0, q1: null, median: null, q3: null, iqr: null, lowerFence:null,upperFence:null, whiskers: [], outliers: [], method: calculationVersion };
  const q1 = quantile(sorted, .25), median = quantile(sorted, .5), q3 = quantile(sorted, .75), iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr, upperFence = q3 + 1.5 * iqr;
  const inside = sorted.filter(v => v >= lowerFence && v <= upperFence);
  return { n, q1, median, q3, iqr, lowerFence, upperFence, whiskers: [inside[0], inside.at(-1)], outliers: sorted.filter(v => v < lowerFence || v > upperFence), method: calculationVersion };
}
export function computeHistogram(values, settings = {}) {
  const valid = finiteValues(values), n = valid.length;
  if (!n) return { n: 0, excluded: values.length, bins: [], edges: [], density: false };
  const min = Math.min(...valid), max = Math.max(...valid);
  let edges;
  if (settings.mode === 'edges') edges = settings.edges;
  else if (settings.mode === 'width') {
    const width = settings.width;
    if (!(Number.isFinite(width) && width > 0)) throw new Error('ความกว้าง bin ต้องมากกว่าศูนย์');
    const origin = Math.floor(min / width) * width;
    const count = Math.max(1, Math.ceil((max - origin) / width));
    if (count > 20) throw new Error('กำหนดได้ไม่เกิน 20 bins โปรดเพิ่มความกว้าง');
    edges = Array.from({ length: count + 1 }, (_, i) => origin + i * width);
  } else {
    const count = settings.count ?? Math.ceil(Math.sqrt(n));
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('จำนวน bin ต้องเป็นจำนวนเต็ม 1–20');
    const lower = min === max ? min - .5 : min, upper = min === max ? max + .5 : max;
    edges = Array.from({ length: count + 1 }, (_, i) => lower + (upper - lower) * i / count);
  }
  if (!Array.isArray(edges) || edges.length < 2 || edges.length > 21 || edges.some((v, i) => !Number.isFinite(v) || (i && v <= edges[i - 1]))) throw new Error('ขอบ bin ต้องเพิ่มขึ้นและมี 2–21 ค่า');
  const tolerance = Math.max(1, Math.abs(min), Math.abs(max), edges.at(-1) - edges[0]) * 1e-12;
  if (edges[0] > min + tolerance || edges.at(-1) < max - tolerance) throw new Error('ขอบ bin ต้องครอบคลุมข้อมูลทั้งหมด');
  const bins = edges.slice(0, -1).map((lo, i) => ({ lo, hi: edges[i + 1], count: 0, last: i === edges.length - 2 }));
  for (const value of valid) {
    let index = 0;
    while (index < bins.length - 1 && value >= edges[index + 1]) index++;
    bins[index].count++;
  }
  const widths = bins.map(bin => bin.hi - bin.lo);
  const unequal = widths.some(width => Math.abs(width - widths[0]) > tolerance);
  const density = unequal || settings.measure === 'density';
  return { n, excluded: values.length - n, bins: bins.map(bin => ({ ...bin, height: density ? bin.count / (bin.hi - bin.lo) : bin.count })), edges: [...edges], density, unequal };
}
