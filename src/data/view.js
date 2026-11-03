export const isResearch = data => data.schemaVersion === 2;
export function deriveRecords(data) {
  return data.records.map(record=>{
    const next={...record};
    for(const field of data.fields)if(field.derived)next[field.id]=Number.isFinite(record[field.derived.source])?record[field.derived.source]-field.derived.offset:null;
    return next;
  });
}
export function dataView(data, config = {}) {
  if (!isResearch(data)) return { ...data, total: data.rows.length, excluded: 0 };
  const encoding = { ...data.encoding, ...config.encoding };
  const y = data.fields.find(field => field.id === encoding.y), x = data.fields.find(field => field.id === encoding.x);
  let rows = data.records.map((record, i) => ({ label: x?.type === 'nominal' ? String(record[encoding.x] ?? '') : `จุด ${i+1}`, id: record.id, record, x: record[encoding.x], value: record[encoding.y], group: record[encoding.group], secondValue: record[encoding.secondY] }));
  const needsX = ['bar','scatter','line','dot'].includes(config.kind);
  rows = rows.filter(row => Number.isFinite(row.value)
    && (!needsX || (x?.type === 'nominal' ? typeof row.x === 'string' && row.x.trim() : Number.isFinite(row.x)))
    && (config.kind === 'box' && config.grouped ? typeof row.group === 'string' && row.group.trim() : true)
    && (['dual','small-multiples','indexed'].includes(config.presentation) ? Number.isFinite(row.secondValue) : true));
  const usable = rows.length;
  if (x?.type === 'time' && config.windowMode === 'recent') { const end = Math.max(...rows.map(row => row.x)); rows = rows.filter(row => row.x >= end - 2); }
  else if (x?.type === 'time' && config.windowMode === 'custom' && config.timeWindow) rows = rows.filter(row => row.x >= config.timeWindow.start && row.x <= config.timeWindow.end);
  return { ...data, rows, encoding, unit: y?.unit || '', xLabel: x?.label || 'รายการ', xType: x?.type === 'time' ? 'time' : x?.type === 'quantitative' ? 'number' : 'category', total: data.records.length, excluded: data.records.length - usable, shown: rows.length };
}
export function initialConfig(data) {
  const config = { kind: 'bar', palette: 'uniform', highlight: 0, labels: true, baseline: 0, upper: null };
  if (!isResearch(data)) return config;
  return { ...config, kind: data.id === 'soil' ? 'histogram' : data.id === 'researchTime' || data.id === 'dualResearch' ? 'line' : data.id === 'shade' ? 'scatter' : 'bar', encoding: { ...data.encoding }, histogram: {mode:'count',count:6,width:5,edges:[0,5,10,15,20,25],measure:'count'}, grouped:false, presentation: data.encoding.secondY ? 'small-multiples' : '2d', windowMode:'full',timeWindow:{start:1,end:data.records.length}, color:{schemeType:'uniform',paletteId:'blue',field:data.encoding.y,midpoint:0}, grayscale:false, axes:{rightMin:0,rightMax:100} };
}
