import { isResearch } from '../data/view.js';
import { validateResearchDataset, validateResearchChart } from './research-validation.js';
export function validateDataset(data) {
  if (isResearch(data)) return validateResearchDataset(data);
  const errors = [];
  if (!data.title?.trim()) errors.push('ระบุชื่อกราฟ');
  if (!data.unit?.trim()) errors.push('ระบุหน่วยของข้อมูล');
  if (!data.xLabel?.trim()) errors.push('ระบุชื่อแกนนอนหรือหมวดหมู่');
  if (!Array.isArray(data.rows) || data.rows.length < 2 || data.rows.length > 8) return [...errors, 'ใช้ข้อมูลตั้งแต่ 2 ถึง 8 แถว'];
  if (data.rows.some(row => !row.label?.trim())) errors.push('ระบุชื่อข้อมูลให้ครบทุกแถว');
  if (data.rows.some(row => !Number.isFinite(row.value) || Math.abs(row.value) > 1e6)) errors.push('ค่าข้อมูลต้องเป็นตัวเลขระหว่าง −1,000,000 ถึง 1,000,000');
  if (data.xType !== 'category') {
    if (data.rows.some(row => !Number.isFinite(row.x) || Math.abs(row.x) > 1e6)) errors.push('ค่าของแกนนอนต้องเป็นตัวเลขระหว่าง −1,000,000 ถึง 1,000,000');
    if (data.xType === 'time' && data.rows.some((row, i) => i && row.x <= data.rows[i - 1].x)) errors.push('ค่าเวลาต้องเรียงจากน้อยไปมากและไม่ซ้ำกัน');
  }
  return errors;
}

export function validateChart(data, config) {
  if (isResearch(data)) return validateResearchChart(data, config);
  const errors = validateDataset(data);
  if (!['bar', 'line', 'dot', 'pie'].includes(config.kind)) errors.push('เลือกชนิดกราฟที่รองรับ');
  if (config.kind === 'pie') {
    if (data.rows.some(row => row.value < 0) || !(data.rows.reduce((sum, row) => sum + row.value, 0) > 0)) errors.push('กราฟวงกลมต้องใช้ค่าที่ไม่ติดลบและมีผลรวมมากกว่าศูนย์');
  } else {
    const values = data.rows.map(row => row.value);
    if (!Number.isFinite(config.baseline) || Math.abs(config.baseline) > 1e6 || config.baseline > Math.min(...values)) errors.push('จุดเริ่มแกนต้องไม่สูงกว่าค่าข้อมูลที่น้อยที่สุด และอยู่ระหว่าง −1,000,000 ถึง 1,000,000');
    const highest = config.kind === 'bar' ? Math.max(0, ...values) : Math.max(...values);
    if (config.upper !== null && (!Number.isFinite(config.upper) || Math.abs(config.upper) > 1e6 || config.upper < highest || config.upper <= config.baseline)) errors.push('จุดสิ้นสุดแกนต้องครอบคลุมค่าสูงสุด มากกว่าจุดเริ่มแกน และอยู่ระหว่าง −1,000,000 ถึง 1,000,000 กราฟแท่งที่มีค่าติดลบต้องครอบคลุมศูนย์');
  }
  return errors;
}

export function suitability(data, config) {
  if (isResearch(data)) return ['ข้อมูลจำลอง ไม่ใช่ผลวิจัยจริง และไม่ยืนยันเหตุและผล', ...(config.presentation === '3d' ? ['ภาพประกอบจำลอง 3 มิติ ความลึกไม่ได้แทนตัวแปรที่วัด'] : []), ...(config.kind === 'histogram' ? ['ช่วงชั้นรวมขอบซ้าย ไม่รวมขอบขวา ยกเว้นช่วงสุดท้ายรวมขอบขวา; ช่วงกว้างไม่เท่ากันใช้ความหนาแน่นความถี่'] : []), ...(config.kind === 'box' ? ['ควอร์ไทล์: R type 7; หนวดเป็นค่าจริงในขอบเขต 1.5 IQR; ค่านอกเกณฑ์ไม่ใช่ค่าผิดโดยอัตโนมัติ'] : []), ...(config.color?.schemeType === 'diverging' ? ['จุดอ้างอิงสีต้องมีความหมาย; 30°C ในบทเรียนเป็นค่าอ้างอิงสมมติ ไม่ใช่เกณฑ์ความปลอดภัย'] : [])];
  const messages = [];
  if (config.kind === 'pie' && !data.partToWhole) messages.push('ข้อมูลนี้ไม่ใช่ส่วนประกอบของผลรวม การแปลงเป็นสัดส่วนอาจสื่อความหมายคลาดเคลื่อน');
  if (config.kind === 'line' && data.xType === 'category') messages.push('เส้นเชื่อมอาจสื่อว่าหมวดหมู่มีลำดับต่อเนื่อง ควรพิจารณากราฟแท่งหรือกราฟจุด');
  if (config.kind === 'bar' && config.baseline > 0) messages.push('กราฟแท่งตัดแกนที่ค่ามากกว่าศูนย์ ความต่างของความยาวจึงดูมากขึ้น');
  if (config.kind === 'bar' && config.baseline < 0 && data.rows.every(row => row.value >= 0)) messages.push('แกนมีพื้นที่ต่ำกว่าศูนย์ที่ไม่มีข้อมูล ทำให้ความต่างดูเล็กลง');
  if (config.kind !== 'pie' && config.kind !== 'bar' && config.baseline > 0) messages.push('แกนตั้งไม่เริ่มที่ศูนย์ โปรดอ่านช่วงแกนก่อนเปรียบเทียบ');
  if (data.xType === 'number' && config.kind !== 'dot') messages.push('หากต้องการศึกษาความสัมพันธ์ของตัวแปรเชิงปริมาณ กราฟกระจายช่วยแสดงตำแหน่งตามค่าของทั้งสองตัวแปร');
  return messages;
}
