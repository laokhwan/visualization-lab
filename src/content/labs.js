const defaultConfig = { kind: 'bar', palette: 'uniform', highlight: 2, labels: true, baseline: 0, upper: null };
export const labs = [
  {
    id: 'choose', title: 'เลือกกราฟให้เหมาะสม', english: 'Choose the Chart',
    intro: 'เลือกกราฟตามคำถามและลักษณะของข้อมูล', controls: ['kind'],
    tasks: [
      { id: 'compare', dataset: 'groups', mission: 'เลือกกราฟสำหรับเปรียบเทียบชั่วโมงอ่านหนังสือเฉลี่ยของแต่ละห้อง',
        predict: 'กราฟชนิดใดช่วยเปรียบเทียบค่าระหว่างห้องได้ชัดเจน', prediction: 'chart',
        prompt: 'กราฟที่เลือกช่วยเปรียบเทียบข้อมูลอย่างไร',
        config: { ...defaultConfig, kind: 'pie' },
        criteria: [{ key: 'kind', values: ['bar', 'dot'], label: 'ใช้กราฟสำหรับเปรียบเทียบหมวดหมู่', hint: 'กราฟแท่งและกราฟจุดช่วยเปรียบเทียบค่าของห้องเรียน กราฟเส้นอาจสื่อว่าห้องเรียนมีลำดับต่อเนื่อง' }] },
      { id: 'time', dataset: 'trend', mission: 'เลือกกราฟสำหรับแสดงการเปลี่ยนแปลงอุณหภูมิตามเวลา',
        predict: 'กราฟชนิดใดช่วยแสดงแนวโน้มตามเวลา', prediction: 'chart',
        prompt: 'เส้นที่เชื่อมแต่ละช่วงเวลาช่วยให้เห็นอะไร',
        config: { ...defaultConfig },
        criteria: [{ key: 'kind', values: ['line'], label: 'ใช้กราฟเส้นเพื่อแสดงแนวโน้มตามเวลา', hint: 'กราฟเส้นเชื่อมค่าตามลำดับเวลาเพื่อแสดงแนวโน้ม ส่วนกราฟจุดก็แสดงค่าได้ แต่กิจกรรมนี้ฝึกการอ่านเส้นแนวโน้ม' }] },
    ],
  },
  {
    id: 'color', title: 'การใช้สีในกราฟ', english: 'Color Matters', intro: 'ใช้สีให้สอดคล้องกับสิ่งที่ต้องการสื่อ', controls: ['palette', 'highlight'],
    tasks: [{ id: 'focus', dataset: 'groups', mission: 'ปรับสีเพื่อเน้นข้อมูลของห้อง C โดยยังเปรียบเทียบกับห้องอื่นได้',
      predict: 'การใช้สีแบบใดช่วยให้เห็นห้อง C ก่อน', prediction: 'color', prompt: 'การเน้นสีเฉพาะห้อง C ช่วยให้ผู้อ่านเข้าใจข้อมูลอย่างไร',
      config: { ...defaultConfig, palette: 'categorical' },
      criteria: [
        { key: 'palette', values: ['highlight'], label: 'ใช้สีเด่นเฉพาะหมวดหมู่ที่ต้องการเน้น', hint: 'สีเดียวกันในหมวดอื่นช่วยลดสิ่งรบกวน และทำให้สีเด่นมีความหมาย' },
        { key: 'highlight', values: [2], label: 'เน้นข้อมูลของห้อง C', hint: 'เลือกห้อง C เป็นหมวดหมู่ที่ต้องการเน้น' },
      ] }],
  },
  {
    id: 'misleading', title: 'กราฟที่อาจทำให้เข้าใจผิด', english: 'Misleading Charts', intro: 'ตรวจสอบผลของช่วงแกนต่อการรับรู้ความแตกต่าง', controls: ['baseline'], compare: true,
    tasks: [{ id: 'axis', dataset: 'scores', mission: 'เปรียบเทียบกราฟต้นฉบับกับกราฟที่ปรับแกน แล้วลดการขยายความต่างเกินจริง',
      predict: 'เมื่อเริ่มแกนตั้งที่ 70 ความต่างจะดูเป็นอย่างไร', prediction: 'axis', prompt: 'การเริ่มแกนตั้งที่ 70 ส่งผลต่อการตีความความต่างอย่างไร',
      config: { ...defaultConfig, baseline: 70 },
      criteria: [{ key: 'baseline', values: [0], label: 'กราฟแท่งเริ่มแกนตั้งที่ศูนย์', hint: 'กราฟแท่งใช้ความยาวแทนค่า การเริ่มที่ศูนย์ช่วยรักษาสัดส่วนของความยาว' }] }],
  },
  {
    id: 'redesign', title: 'ปรับปรุงการนำเสนอข้อมูล', english: 'Redesign Challenge', intro: 'ปรับกราฟให้อ่านง่ายและสื่อความหมายอย่างเหมาะสม', controls: ['kind', 'palette', 'highlight', 'baseline'], compare: true,
    tasks: [{ id: 'revision', dataset: 'scores', mission: 'ปรับกราฟคะแนนที่ตัดแกนและใช้หลายสี พร้อมอธิบายการปรับปรุง 2 ประเด็น',
      predict: 'ส่วนใดของกราฟควรปรับปรุง และเพราะเหตุใด', prediction: 'text', prompt: 'อธิบายการปรับปรุงประเด็นที่ 1 และผลต่อการตีความ',
      secondPrompt: 'อธิบายการปรับปรุงประเด็นที่ 2 และผลต่อการตีความ',
      config: { ...defaultConfig, palette: 'categorical', baseline: 70 },
      criteria: [
        { key: 'kind', values: ['bar', 'dot'], label: 'ใช้กราฟที่เหมาะกับการเปรียบเทียบกลุ่ม', hint: 'กราฟแท่งหรือกราฟจุดเหมาะกับการเปรียบเทียบค่าระหว่างกลุ่ม' },
        { test: 'honestAxis', label: 'ใช้แกนที่เหมาะกับชนิดกราฟ', hint: 'กราฟแท่งควรเริ่มที่ศูนย์ ส่วนกราฟจุดใช้ช่วงแคบได้เมื่อระบุขอบเขตอย่างชัดเจน' },
        { key: 'palette', values: ['uniform', 'highlight'], label: 'ใช้สีอย่างมีจุดประสงค์', hint: 'ใช้สีเดียวเพื่อเปรียบเทียบ หรือเน้นกลุ่มที่ต้องการอธิบาย' },
      ] }],
  },
];

export const predictions = {
  color: [['', 'เลือกคำตอบก่อนทดลอง'], ['uniform', 'ใช้สีเดียวทุกห้อง'], ['highlight', 'ใช้สีเด่นเฉพาะห้อง C'], ['categorical', 'ใช้สีต่างกันทุกห้อง']],
  axis: [['', 'เลือกคำตอบก่อนทดลอง'], ['larger', 'ความต่างดูมากขึ้น'], ['same', 'ความต่างดูเท่าเดิม'], ['smaller', 'ความต่างดูน้อยลง']],
};
