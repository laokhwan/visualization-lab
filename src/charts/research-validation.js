import { dataView } from '../data/view.js';
import { computeHistogram } from '../statistics/distribution.js';
export const researchKinds = ['bar','line','dot','scatter','histogram','box'];
const bounded = value => Number.isFinite(value) && Math.abs(value) <= 1e6;
export function validateResearchDataset(data) {
  const errors = [];
  if (!data.title?.trim()) errors.push('ระบุชื่อกราฟ');
  if (!Array.isArray(data.fields) || !data.fields.length || new Set(data.fields.map(f => f.id)).size !== data.fields.length || data.fields.some(f => !f.id || !f.label?.trim() || !['nominal','quantitative','time'].includes(f.type) || f.type !== 'nominal' && !f.unit?.trim())) return [...errors,'ข้อมูลตัวแปรหรือหน่วยไม่ถูกต้อง'];
  if (!Array.isArray(data.records) || data.records.length < 1 || data.records.length > 200) return [...errors,'ใช้ข้อมูล 1–200 รายการ'];
  if (new Set(data.records.map(r => r.id)).size !== data.records.length || data.records.some(r => typeof r.id !== 'string' || !r.id)) errors.push('รหัสหน่วยสังเกตต้องไม่ว่างและไม่ซ้ำ');
  if (data.records.some(r => data.fields.some(f => r[f.id] !== null && r[f.id] !== undefined && (f.type === 'nominal' ? typeof r[f.id] !== 'string' || !r[f.id].trim() : !bounded(r[f.id]))))) errors.push('ค่าตัวเลขต้องอยู่ระหว่าง −1,000,000 ถึง 1,000,000 ใช้ช่องว่างแทนข้อมูลที่ขาด');
  if (data.records.some(r=>data.fields.some(f=>f.derived&&r[f.id] !== (Number.isFinite(r[f.derived.source])?r[f.derived.source]-f.derived.offset:null)))) errors.push('ค่าผลต่างต้องตรงกับตัวแปรต้นทางและค่าอ้างอิง');
  return errors;
}
export function validateResearchChart(data, config) {
  const errors = validateResearchDataset(data);
  if (errors.length) return errors;
  if (!researchKinds.includes(config.kind)) errors.push('ชนิดกราฟนี้ไม่รองรับข้อมูลการสังเกต ใช้กราฟกระจาย ฮิสโทแกรม หรือ Box Plot ตามคำถาม');
  const field = id => data.fields.find(f => f.id === id);
  const x = field(config.encoding?.x), y = field(config.encoding?.y);
  if (!x || y?.type !== 'quantitative') return [...errors,'เลือกตัวแปรแกนตั้งเชิงปริมาณและแกนนอนที่มีอยู่'];
  if (config.kind === 'scatter' && x.type !== 'quantitative') errors.push('กราฟกระจายต้องใช้ตัวแปรเชิงปริมาณทั้งสองแกน');
  if (config.kind === 'line' && x.type === 'nominal') errors.push('กราฟเส้นต้องใช้เวลา หรือตัวแปรเชิงปริมาณที่มีลำดับ');
  if (config.grouped && field(config.encoding?.group)?.type !== 'nominal') errors.push('เลือกตัวแปรกลุ่มแบบหมวดหมู่');
  const view = dataView(data, config);
  if (!view.rows.length) return [...errors,'ไม่มีข้อมูลที่ใช้วาดกราฟได้ในช่วงที่เลือก'];
  if (config.kind === 'line') {
    const xs = view.rows.map(r => r.x);
    if (new Set(xs).size !== xs.length || xs.some((v,i) => i && v <= xs[i-1])) errors.push('กราฟเส้นต้องเรียงแกนนอนและไม่ซ้ำ; ค่า X ซ้ำใช้กราฟกระจายได้');
  }
  if (config.kind === 'histogram') {
    if (!config.histogram || !['count','width','edges'].includes(config.histogram.mode) || !['count','density'].includes(config.histogram.measure)) errors.push('เลือกรูปแบบช่วงชั้นและความสูงที่รองรับ');
    else {
      if(config.histogram.mode==='width'&&!bounded(config.histogram.width)||config.histogram.mode==='edges'&&(!Array.isArray(config.histogram.edges)||!config.histogram.edges.every(bounded)))errors.push('ความกว้างและขอบช่วงต้องเป็นตัวเลขที่มีขนาดไม่เกิน 1,000,000');
      try { computeHistogram(view.rows.map(r => r.value), config.histogram); } catch (error) { errors.push(error.message); }
    }
  }
  if (config.kind === 'box' && config.grouped && new Set(view.rows.map(r=>r.group)).size>8) errors.push('เปรียบเทียบ Box Plot ได้ไม่เกิน 8 กลุ่มในหนึ่งภาพ');
  if (!bounded(config.baseline) || config.upper !== null && (!bounded(config.upper) || config.upper <= config.baseline)) errors.push('ช่วงแกนไม่ถูกต้อง');
  if (['line','dot'].includes(config.kind) && config.presentation !== 'indexed' && (config.baseline > Math.min(...view.rows.map(r=>r.value)) || config.upper !== null && config.upper < Math.max(...view.rows.map(r=>r.value)))) errors.push('แกนตั้งต้องครอบคลุมข้อมูลทั้งหมดในช่วงที่แสดง');
  if (config.kind === 'bar' && (config.baseline > Math.min(0,...view.rows.map(r => r.value)) || config.upper !== null && config.upper < Math.max(0,...view.rows.map(r => r.value)))) errors.push('แกนกราฟแท่งต้องครอบคลุมข้อมูลและศูนย์');
  const color = config.color, cf = field(color?.field);
  if (!color || !['uniform','categorical','sequential','diverging'].includes(color.schemeType) || !['blue','teal','purple'].includes(color.paletteId)) errors.push('เลือกรูปแบบสีและชุดสีที่รองรับ');
  else if (color.schemeType === 'categorical' && cf?.type !== 'nominal' || ['sequential','diverging'].includes(color.schemeType) && cf?.type !== 'quantitative') errors.push('ชนิดตัวแปรไม่ตรงกับรูปแบบสีที่เลือก');
  if (color?.schemeType === 'diverging' && !bounded(color.midpoint)) errors.push('จุดอ้างอิงสีต้องเป็นตัวเลข');
  if (!['2d','3d','dual','small-multiples','indexed'].includes(config.presentation)) errors.push('รูปแบบการนำเสนอไม่ถูกต้อง');
  if (config.presentation === '3d' && config.kind !== 'bar') errors.push('ภาพจำลอง 3 มิติใช้กับกราฟแท่งเท่านั้น');
  if (['dual','small-multiples','indexed'].includes(config.presentation)) {
    if (config.kind !== 'line' || field(config.encoding?.secondY)?.type !== 'quantitative') errors.push('การเปรียบเทียบสองตัวแปรใช้กราฟเส้นและตัวแปรที่สองเชิงปริมาณ');
    if (config.presentation === 'dual' && (!bounded(config.axes?.rightMin) || !bounded(config.axes?.rightMax) || config.axes.rightMax <= config.axes.rightMin || view.rows.some(r => r.secondValue < config.axes.rightMin || r.secondValue > config.axes.rightMax))) errors.push('แกนขวาต้องครอบคลุมค่าตัวแปรที่สองและมีช่วงเพิ่มขึ้น');
    if (config.presentation === 'indexed' && (!view.rows[0].value || !view.rows[0].secondValue)) errors.push('ดัชนีฐาน 100 ต้องมีค่าแรกของทั้งสองตัวแปรไม่เป็นศูนย์');
  }
  if (!['full','recent','custom'].includes(config.windowMode) || config.windowMode === 'custom' && (!bounded(config.timeWindow?.start) || !bounded(config.timeWindow?.end) || config.timeWindow.end < config.timeWindow.start)) errors.push('กำหนดช่วงเวลาให้ถูกต้อง');
  return errors;
}
