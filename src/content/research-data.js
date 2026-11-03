export const quantitative = (id, label, unit) => ({ id, label, unit, type: 'quantitative' });
const field = (id, label, type) => ({ id, label, type, ...(type === 'time' ? {unit:'วัน'} : {}) });
function define(id, title, fields, records, encoding, description) {
  const y = fields.find(f => f.id === encoding.y), x = fields.find(f => f.id === encoding.x);
  return { schemaVersion: 2, id, title, recordLevel: 'observation', provenance: { kind: 'simulated', description, limitation: 'ข้อมูลจำลอง ไม่ใช่ผลวิจัยจริง และไม่ยืนยันเหตุและผล' }, fields, records: records.map((row, i) => ({ id: `obs-${i + 1}`, ...row })), encoding, unit: y.unit, xLabel: x?.label || 'รายการ', xType: x?.type === 'time' ? 'time' : x?.type === 'quantitative' ? 'number' : 'category', partToWhole: false,
    rows: records.map((row, i) => ({ label: `จุด ${i + 1}`, x: row[encoding.x], value: row[encoding.y], group: row[encoding.group] })) };
}
const bare = [4,5,5,6,6,7,7,8,8,9,10,24], planted = [3,4,4,4,5,5,5,6,6,6,7,8];
const temperatures = [28,28.2,28.1,28.4,28.6,28.5,28.9,29.1,29,29.3,29.5,29.4,29.8,30,29.9,30.2,30.4,30.3,30.7,31,31.4,31.2,31,30.8];
export const researchDatasets = {
  shade: define('shade', 'ร่มเงากับอุณหภูมิพื้นผิว', [quantitative('shade', 'สัดส่วนร่มเงา', '%'), quantitative('temperature', 'อุณหภูมิพื้นผิว', '°C'), field('surface', 'ประเภทพื้นที่', 'nominal')],
    [[10,34],[10,33],[20,32],[30,31],[30,32],[40,30],[50,29],[50,30],[60,28],[70,27],[80,26],[80,27]].map(([shade,temperature],i) => ({ shade, temperature, surface: ['คอนกรีต','หญ้า','ใต้ร่มไม้'][i%3] })), { x: 'shade', y: 'temperature', group: 'surface' }, 'จำลองการสำรวจ 12 จุด มีค่า X ซ้ำเพื่อฝึกอ่านความสัมพันธ์'),
  soil: define('soil', 'เวลาน้ำซึมผ่านดิน', [field('group', 'กลุ่มดิน', 'nominal'), quantitative('minutes', 'เวลาน้ำซึม', 'นาที')],
    [...bare.map(minutes => ({group:'ไม่มีพืช',minutes})), ...planted.map(minutes => ({group:'มีพืช',minutes}))], { x: 'group', y: 'minutes', group: 'group' }, 'จำลองตัวอย่างดินกลุ่มละ 12 ค่า มีค่าสูงหนึ่งค่าเพื่ออภิปราย outlier โดยไม่ลบทิ้ง'),
  environment: define('environment', 'อุณหภูมิในพื้นที่สำรวจ', [field('site','พื้นที่','nominal'),field('surface','ประเภทพื้นที่','nominal'),quantitative('temperature','อุณหภูมิ','°C'),{...quantitative('difference','ต่างจากค่าฐาน 30°C','°C'),derived:{source:'temperature',offset:30}}],
    [29,33,31,28,34,30].map((temperature,i)=>({site:`พื้นที่ ${i+1}`,surface:['หญ้า','คอนกรีต','ใต้ร่มไม้'][i%3],temperature,difference:temperature-30})), {x:'site',y:'temperature',group:'surface'}, 'ค่าฐาน 30°C กำหนดเพื่อเปรียบเทียบในกิจกรรม ไม่ใช่เกณฑ์ความปลอดภัย'),
  researchTime: define('researchTime', 'อุณหภูมิแปลงทดลอง 24 วัน', [field('day','วัน','time'),quantitative('temperature','อุณหภูมิ','°C')], temperatures.map((temperature,i)=>({day:i+1,temperature})), {x:'day',y:'temperature'}, 'จำลองแนวโน้มภาพรวมสูงขึ้น แต่ช่วงท้ายลดลง เพื่อฝึกเลือกบริบท'),
  dualResearch: define('dualResearch', 'อุณหภูมิและความชื้นดินตามเวลา', [field('day','วัน','time'),quantitative('temperature','อุณหภูมิ','°C'),quantitative('moisture','ความชื้นดิน','%')],
    [26,28,27,29,28,30,29,31,30,32,31,33].map((temperature,i)=>({day:i+1,temperature,moisture:[70,64,68,61,65,58,62,55,59,52,56,49][i]})), {x:'day',y:'temperature',secondY:'moisture'}, 'จำลองตัวแปรสองหน่วย ไม่พิสูจน์ความสัมพันธ์เชิงสาเหตุ'),
};
