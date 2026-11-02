export const datasets = {
  groups: {
    id: 'groups', title: 'ชั่วโมงอ่านหนังสือเฉลี่ยตามห้อง', xLabel: 'ห้องเรียน', xType: 'category', unit: 'ชั่วโมง/สัปดาห์', partToWhole: false,
    rows: [{ label: 'ห้อง A', value: 4.2 }, { label: 'ห้อง B', value: 5.6 }, { label: 'ห้อง C', value: 6.9 }, { label: 'ห้อง D', value: 5.1 }],
  },
  scores: {
    id: 'scores', title: 'คะแนนเฉลี่ยของแต่ละกลุ่ม', xLabel: 'กลุ่ม', xType: 'category', unit: 'คะแนน', partToWhole: false,
    rows: [{ label: 'กลุ่ม A', value: 72 }, { label: 'กลุ่ม B', value: 76 }, { label: 'กลุ่ม C', value: 79 }],
  },
  trend: {
    id: 'trend', title: 'อุณหภูมิระหว่างวัน', xLabel: 'เวลา', xType: 'time', unit: '°C', partToWhole: false,
    rows: [{ label: '08:00', x: 8, value: 27 }, { label: '10:00', x: 10, value: 30 }, { label: '12:00', x: 12, value: 34 }, { label: '14:00', x: 14, value: 33 }, { label: '16:00', x: 16, value: 29 }],
  },
  relationship: {
    id: 'relationship', title: 'ชั่วโมงทบทวนกับคะแนนสอบ', xLabel: 'ชั่วโมงทบทวน', xType: 'number', unit: 'คะแนน', partToWhole: false,
    rows: [53, 57, 66, 72, 78, 88].map((value, i) => ({ label: `ตัวอย่าง ${i + 1}`, x: i + 1, value })),
  },
  activities: {
    id: 'activities', title: 'กิจกรรมหลังเลิกเรียนของกลุ่มตัวอย่าง', xLabel: 'กิจกรรม', xType: 'category', unit: 'คน', partToWhole: true,
    rows: [{ label: 'กีฬา', value: 12 }, { label: 'ดนตรี', value: 8 }, { label: 'อ่านหนังสือ', value: 6 }, { label: 'อื่น ๆ', value: 4 }],
  },
};

export function copyDataset(id) {
  const data = datasets[id];
  return { ...data, rows: data.rows.map(row => ({ ...row })) };
}
