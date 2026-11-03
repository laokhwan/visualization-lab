import { labs } from '../content/labs.js';
import { questions } from '../content/questions.js';
import { escapeHtml as esc } from './html.js';

const reviewButton = (item, label) => `<button type="button" class="text-button" data-review-lab="${item.labId}" data-review-task="${item.taskId}"${item.questionId ? ` data-review-question="${item.questionId}"` : ''}>${esc(label)}</button>`;

export function summaryHtml(summary) {
  const totals = summary.totals;
  const list = (items, empty) => items.length ? `<ul>${items.map(item => `<li>${reviewButton(item, questions[item.questionId].prompt)}</li>`).join('')}</ul>` : `<p class="help">${empty}</p>`;
  return `<p class="eyebrow">การเรียนรู้ในรอบนี้</p><h2 id="stage-title" tabindex="-1">สรุปการเรียนรู้ (Learning Summary)</h2>
    <div class="summary-metrics"><p><strong>${totals.masteredQuestionCount} / ${totals.questionCount}</strong>ข้อที่เคยตอบถูก</p><p><strong>${totals.completedTaskCount} / ${totals.taskCount}</strong>สถานการณ์ที่ทำครบ</p><p><strong>${totals.completedLabCount} / ${totals.labCount}</strong>แล็บที่ทำครบ</p><p><strong>${totals.attemptCount}</strong>ครั้งที่ส่งคำตอบ · ตอบผิด ${totals.incorrectAttemptCount} ครั้ง</p></div>
    <p class="help">Mastery หมายถึงเคยตอบข้อประเมินได้ถูกต้อง ความผิดพลาดระหว่างฝึกไม่ลดผลที่เคยผ่าน ส่วนการทำครบรวมเกณฑ์กราฟและการกรอกสะท้อนคิด</p>
    <section><h3>ข้อที่ควรทบทวน</h3>${list(summary.questionsNeedingPractice, 'ยังไม่มีข้อที่ส่งแล้วและรอฝึกให้ผ่าน')}</section>
    <section><h3>ข้อที่ใช้การฝึกเพิ่มเติม</h3>${list(summary.repeatedAttemptQuestions, 'ยังไม่มีข้อที่ต้องลองมากกว่าหนึ่งครั้งก่อนผ่าน')}</section>
    ${summary.labs.map(lab => `<section class="summary-lab"><h3>${esc(labs.find(item => item.id === lab.labId).title)}</h3><p>${lab.masteryStatus === 'mastered' ? '✓ ผ่านข้อประเมินครบ' : 'ยังผ่านข้อประเมินไม่ครบ'} · ${lab.completionStatus === 'complete' ? '✓ ทำกิจกรรมครบ' : 'ยังทำกิจกรรมไม่ครบ'}</p>${lab.tasks.map((task, i) => `<h4>สถานการณ์ ${i + 1} ${reviewButton(task, 'เปิดทบทวน')}</h4><p class="help">หลักฐานทดลอง: ${task.experimentStatus === 'complete' ? 'ครบ' : 'ยังไม่ครบ'} · กราฟปัจจุบัน: ${task.designStatus === 'met' ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'} · สะท้อนคิดปัจจุบัน: ${task.reflectionProvided ? 'กรอกแล้ว' : 'ยังไม่ครบ'} (ยังไม่ได้ประเมินเหตุผล)</p><div class="table-scroll"><table><caption>ผลรายคำถาม · ${task.completionStatus === 'complete' ? 'เคยทำสถานการณ์ครบแล้ว' : 'ยังทำสถานการณ์ไม่ครบ'}</caption><thead><tr><th scope="col">คำถาม</th><th scope="col">Mastery</th><th scope="col">ส่งคำตอบ</th><th scope="col">ตอบผิด</th><th scope="col">ผ่านครั้งแรก</th><th scope="col">ผลล่าสุด</th></tr></thead><tbody>${task.questions.map(question => `<tr><th scope="row">${esc(questions[question.questionId].prompt)}</th><td>${question.masteryStatus === 'mastered' ? 'เคยผ่านแล้ว' : 'ยังไม่ผ่าน'}</td><td>${question.attemptCount}</td><td>${question.incorrectAttemptCount}</td><td>${question.firstMasteredAttempt ?? '—'}</td><td>${question.latestCorrect === null ? 'ยังไม่ส่ง' : question.latestCorrect ? 'ถูกต้อง' : 'ควรทบทวน'}</td></tr>`).join('')}</tbody></table></div>`).join('')}</section>`).join('')}
    <p class="notice">ผลอยู่ในเบราว์เซอร์และแก้ไขได้ ไม่ใช่หลักฐานคะแนนที่ป้องกันการดัดแปลง ความคืบหน้าจะกลับมาได้เมื่อเปิดบันทึกบนเครื่องและบันทึกสำเร็จเท่านั้น</p><button id="return-activity" class="secondary">กลับสู่กิจกรรม</button>`;
}
