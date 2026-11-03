import { questions } from '../content/questions.js';
import { chartSvg } from '../charts/render.js';
import { formatNumber } from '../charts/scales.js';
import { reportWarning } from './model.js';

export const pdfFontNames = { Sarabun: { normal: 'Sarabun-Regular.ttf', bold: 'Sarabun-Bold.ttf', italics: 'Sarabun-Regular.ttf', bolditalics: 'Sarabun-Bold.ttf' } };
const yes = status => status === 'complete' ? 'ครบ' : 'ยังไม่ครบ';
const mastered = status => status === 'mastered' ? 'เคยผ่านแล้ว' : 'ยังไม่ผ่าน';

export function exportChartSvg(snapshot, prefix) {
  const styles = {
    tick: 'font-family:Sarabun;font-size:16px;fill:#526175',
    'axis-label': 'font-family:Sarabun;font-size:16px;fill:#526175',
    'value-label': 'font-family:Sarabun;font-size:17px;fill:#17324d;font-weight:bold',
    'pie-label': 'font-family:Sarabun;font-size:17px;fill:#17324d;font-weight:bold',
    gridline: 'stroke:#dce4ed;stroke-width:1', axis: 'stroke:#526175;stroke-width:1',
  };
  return chartSvg(snapshot.dataset, snapshot.config, prefix)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<circle class="hit-area"[^>]*\/>/g, '')
    .replace(/class="([^"]+)"/g, (_, names) => `style="${names.split(' ').map(name => styles[name] || '').filter(Boolean).join(';')}"`)
    .replace(/\s(?:aria-[\w-]+|tabindex|role|data-point|pointer-events)="[^"]*"/g, '');
}

function chartBlock(snapshot, title, id) {
  return [{ unbreakable: true, stack: [
    { text: title, style: 'subheading', margin: [0, 10, 0, 4] },
    { svg: exportChartSvg(snapshot, id), width: 500 },
    { text: snapshot.dataset.rows.map(row => `${row.label}: ${formatNumber(row.value)} ${snapshot.dataset.unit}`).join(' · '), color: '#24354a', fontSize: 10 },
    { text: snapshot.config.kind === 'pie' ? 'กราฟวงกลมแสดงสัดส่วนของผลรวม' : `จุดเริ่มแกน: ${formatNumber(snapshot.config.baseline)} · จุดสิ้นสุด: ${snapshot.config.upper === null ? 'อัตโนมัติ' : formatNumber(snapshot.config.upper)}`, fontSize: 10, color: '#526175' },
  ] }];
}

export function buildPdfDefinition(report) {
  const { totals } = report.summary;
  const content = [
    { text: 'รายงานการเรียนรู้', style: 'title' },
    { text: 'การแสดงข้อมูลเพื่อการวิจัย · Visualization Lab', style: 'heading' },
    { text: 'วิชาพื้นฐานการวิจัย · มัธยมศึกษาปีที่ 4\nโรงเรียนมหิดลวิทยานุสรณ์', margin: [0, 0, 0, 10] },
    { text: `สร้างเมื่อ ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(report.generatedAt))}\nรุ่นเนื้อหา ${report.contentVersion} · รุ่นรายงาน ${report.reportSchemaVersion}`, color: '#526175' },
    { text: reportWarning, color: '#8b390b', margin: [0, 10, 0, 10] },
    { text: totals.completedTaskCount === totals.taskCount ? 'สถานะ: ทำกิจกรรมครบทุกสถานการณ์' : 'สถานะ: รายงานระหว่างเรียน — ยังทำกิจกรรมไม่ครบ', bold: true },
    { text: `เคยผ่านข้อประเมิน ${totals.masteredQuestionCount}/${totals.questionCount} ข้อ\nทำครบ ${totals.completedTaskCount}/${totals.taskCount} สถานการณ์ · ${totals.completedLabCount}/${totals.labCount} แล็บ\nส่งคำตอบ ${totals.attemptCount} ครั้ง · ตอบผิด ${totals.incorrectAttemptCount} ครั้ง`, margin: [0, 8, 0, 10] },
    { text: 'Mastery แสดงว่าเคยตอบข้อประเมินถูกต้อง การตอบผิดระหว่างฝึกไม่หักผลที่เคยผ่าน ส่วนการทำครบรวมเกณฑ์กราฟและการกรอกสะท้อนคิด ไม่ใช่การประเมินความหมายของข้อความ', color: '#526175', fontSize: 11 },
    { text: 'ผลการตรวจอัตโนมัติ', style: 'heading', margin: [0, 16, 0, 8] },
  ];
  for (const lab of report.summary.labs) {
    const title = report.evidence.find(item => item.labId === lab.labId)?.labTitle || lab.labId;
    for (const [taskIndex, task] of lab.tasks.entries()) {
      content.push({ unbreakable: true, stack: [
        ...(taskIndex === 0 ? [{ text: title, style: 'subheading', margin: [0, 12, 0, 5] }, { text: `ข้อประเมิน: ${mastered(lab.masteryStatus)} · กิจกรรม: ${yes(lab.completionStatus)}`, fontSize: 11 }] : []),
        { text: `สถานการณ์ ${taskIndex + 1} · ทำครบ: ${yes(task.completionStatus)} · ส่ง ${task.attemptCount} ครั้ง · ผิด ${task.incorrectAttemptCount} ครั้ง`, fontSize: 10, margin: [0, 6, 0, 4] },
        { table: { headerRows: 1, widths: ['*', 65, 35, 35, 45], body: [
        ['คำถาม', 'Mastery', 'ส่ง', 'ผิด', 'ผ่านครั้งแรก'].map(text => ({ text, bold: true, fillColor: '#eef4f8' })),
        ...task.questions.map(item => [questions[item.questionId].prompt, mastered(item.masteryStatus), String(item.attemptCount), String(item.incorrectAttemptCount), item.firstMasteredAttempt === null ? '—' : String(item.firstMasteredAttempt)]),
      ] }, layout: 'lightHorizontalLines', fontSize: 10, margin: [0, 0, 0, 8] }] });
    }
  }
  for (const [index, item] of report.evidence.entries()) {
    // Unstarted tasks already appear in the summary; avoid empty evidence pages.
    if (!item.experiments.length && !item.finalChart && !item.prediction && !item.reflections.some(note => note.trim())) continue;
    content.push({ text: `หลักฐานการเรียนรู้ · ${item.labTitle}`, style: 'heading', pageBreak: 'before' });
    content.push({ text: item.mission, margin: [0, 0, 0, 8] });
    content.push({ text: item.source === 'completed' ? 'หลักฐานที่บันทึกเมื่อทำกิจกรรมครบ — การทดลองภายหลังไม่เปลี่ยนหลักฐานนี้' : 'สถานการณ์นี้ยังไม่ทำครบ หลักฐานต่อไปนี้เป็นการทดลองระหว่างเรียน', color: '#526175', fontSize: 11 });
    if (!item.experiments.length) content.push({ text: 'ยังไม่มีกราฟเปรียบเทียบที่บันทึก', margin: [0, 10, 0, 10] });
    for (const [i, snapshot] of item.experiments.entries()) content.push(...chartBlock(snapshot, `แบบเปรียบเทียบ ${i + 1}: ${snapshot.label}`, `report-${index}-${i}`));
    if (item.finalChart) content.push(...chartBlock(item.finalChart, 'กราฟเมื่อทำกิจกรรมครบ', `report-final-${index}`));
    if (item.prediction) {
      const [firstLine, ...rest] = item.prediction.trimStart().split(/\r?\n/);
      content.push({ unbreakable: true, stack: [{ text: 'คำคาดการณ์ — ไม่ถูกให้คะแนน', style: 'subheading', margin: [0, 14, 0, 4] }, { text: firstLine }] });
      if (rest.length) content.push({ text: rest.join('\n') });
    }
    content.push({ text: 'สะท้อนคิด — ยังไม่ได้รับการประเมินเหตุผล', style: 'subheading', headlineLevel: 1, margin: [0, 14, 0, 4] });
    if (item.source !== 'completed' && report.includeDrafts) content.push({ text: 'ข้อความร่างที่ยังไม่บันทึกกิจกรรม', color: '#8b390b', fontSize: 11 });
    if (!item.reflections.some(note => note.trim())) content.push({ text: 'ยังไม่มีข้อความที่นำมารวมในรายงาน', color: '#526175' });
    item.reflections.forEach((note, i) => content.push({ text: `ประเด็นที่ ${i + 1}`, headlineLevel: 2, bold: true, margin: [0, 8, 0, 3] }, { text: note || 'ยังไม่ได้กรอก' }));
  }
  return {
    pageSize: 'A4', pageMargins: [36, 36, 36, 62], defaultStyle: { font: 'Sarabun', fontSize: 12, lineHeight: 1.25 },
    styles: { title: { fontSize: 25, bold: true, color: '#17324d', margin: [0, 0, 0, 10] }, heading: { fontSize: 17, bold: true, color: '#17324d', margin: [0, 0, 0, 8] }, subheading: { fontSize: 13, bold: true, color: '#17324d' } },
    info: { title: 'Visualization Lab Learning Report', author: 'Visualization Lab', subject: 'Browser-side learning evidence — not verified grades' },
    pageBreakBefore: (node, followingNodesOnPage) => Boolean(node.headlineLevel && followingNodesOnPage.length === 0),
    footer: (page, pages) => ({ stack: [{ text: reportWarning, color: '#8b390b' }, { text: `หน้า ${page} / ${pages}`, alignment: 'right' }], font: 'Sarabun', fontSize: 9, margin: [36, 8, 36, 0] }),
    content,
  };
}

let enginePromise;
export function loadPdfEngine() {
  enginePromise ||= (async () => {
    if (!globalThis.pdfMake) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../../vendor/pdfmake.min.js', import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('โหลดตัวสร้าง PDF ไม่สำเร็จ')); };
      document.head.append(script);
    });
    const { fonts } = await import('../../vendor/pdf-fonts.js');
    globalThis.pdfMake.addVirtualFileSystem(fonts);
    globalThis.pdfMake.addFonts(pdfFontNames);
    return globalThis.pdfMake;
  })().catch(error => { enginePromise = null; throw error; });
  return enginePromise;
}

export async function createPdfBlob(report) {
  const engine = await loadPdfEngine();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('สร้าง PDF ใช้เวลานานเกินไป')), 45000);
    try { engine.createPdf(buildPdfDefinition(report)).getBlob(blob => { clearTimeout(timer); resolve(blob); }); }
    catch (error) { clearTimeout(timer); reject(error); }
  });
}
