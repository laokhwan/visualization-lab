import { buildLearningReport } from './model.js';
import { reportHtml } from '../ui/report.js';

export function createReportController({ state, stage, flush = async () => {} }) {
  let url, blob, filename, token = 0;
  const $ = id => stage.querySelector(`#${id}`);
  function dispose() { token++; if (url) URL.revokeObjectURL(url); url = blob = null; }
  stage.addEventListener('change', event => {
    if (['report-drafts','report-scope'].includes(event.target.id)) {
      dispose();
      if ($('pdf-actions')) $('pdf-actions').hidden = true;
      if ($('pdf-status')) $('pdf-status').textContent = 'เปลี่ยนตัวเลือกรายงานแล้ว กรุณาสร้าง PDF ใหม่';
    }
  });
  stage.addEventListener('click', async event => {
    const id = event.target.closest('button')?.id;
    if (id === 'preview-report') {
      const report = buildLearningReport(state, { includeDrafts: $('report-drafts').checked, ...($('report-scope').value !== 'all' ? {labIds:[$('report-scope').value]} : {}) });
      const template = document.createElement('div');
      template.innerHTML = reportHtml(report);
      $('report-preview').innerHTML = template.querySelector('#report-preview').innerHTML;
      $('report-preview').hidden = false;
    } else if (id === 'generate-pdf') {
      dispose();
      const currentToken = token;
      const report = buildLearningReport(state, { includeDrafts: $('report-drafts').checked, ...($('report-scope').value !== 'all' ? {labIds:[$('report-scope').value]} : {}) });
      const button = $('generate-pdf');
      button.disabled = true; $('pdf-actions').hidden = true;
      $('pdf-status').textContent = 'กำลังสร้าง PDF บนเครื่องนี้ กรุณารอสักครู่';
      try {
        await flush();
        const { createPdfBlob } = await import('./pdf.js');
        const result = await createPdfBlob(report);
        if (currentToken !== token || !$('pdf-status')) return;
        blob = result; url = URL.createObjectURL(blob);
        const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(report.generatedAt)).replace(/[^0-9]/g, '');
        filename = `visualization-lab-report-${date}.pdf`;
        $('download-pdf').href = url; $('download-pdf').download = filename;
        $('open-pdf').href = url; $('pdf-actions').hidden = false;
        const file = new File([blob], filename, { type: 'application/pdf' });
        $('share-pdf').hidden = !(navigator.canShare?.({ files: [file] }));
        $('pdf-status').textContent = 'สร้าง PDF แล้ว บันทึกลง Files แล้วแนบใน Classroom ด้วยตนเอง แอปยังไม่ได้ส่งไฟล์';
      } catch {
        if (currentToken === token && $('pdf-status')) $('pdf-status').textContent = 'สร้าง PDF ไม่สำเร็จ กรุณาตรวจการโหลดไฟล์แล้วลองใหม่ ข้อมูลการเรียนรู้ยังอยู่';
      } finally { if (button.isConnected) button.disabled = false; }
    } else if (id === 'share-pdf' && blob) {
      try {
        await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })] });
        if ($('pdf-status')) $('pdf-status').textContent = 'ปิดหน้าต่างแชร์แล้ว แอปไม่สามารถยืนยันการส่งงานใน Classroom';
      } catch (error) {
        if ($('pdf-status')) $('pdf-status').textContent = error.name === 'AbortError' ? 'ยกเลิกการแชร์แล้ว ยังบันทึกไฟล์ได้' : 'แชร์ไม่ได้ กรุณาใช้ปุ่มบันทึก PDF หรือเปิด PDF';
      }
    }
  });
  window.addEventListener('pagehide', dispose);
  return { dispose };
}
