import { questions } from '../content/questions.js';
import { escapeHtml as esc } from './html.js';
const reviewButton = (item, label) => `<button type="button" class="text-button" data-review-lab="${item.labId}" data-review-task="${item.taskId}"${item.questionId ? ` data-review-question="${item.questionId}"` : ''}>${esc(label)}</button>`;
const completed = task => task.completionStatus === 'complete';
const masteredCount = task => task.questions.filter(q => q.masteryStatus === 'mastered').length;
function missingItems(task) {
  if (completed(task)) return [];
  return [
    task.experimentStatus !== 'complete' && 'บันทึกกราฟ 2 รูปแบบ',
    task.masteryStatus !== 'mastered' && 'ตอบคำถามให้ผ่านครบ',
    task.designStatus !== 'met' && 'ปรับกราฟให้ผ่านเกณฑ์',
    !task.reflectionProvided && 'กรอกสะท้อนคิด',
    'กดบันทึกกิจกรรมในขั้นคำแนะนำ'
  ].filter(Boolean);
}
function taskRow(task, index) {
  const status = completed(task) ? 'ทำครบแล้ว' : !task.started ? 'ยังไม่เริ่ม' : task.masteryStatus === 'mastered' ? 'ตอบผ่านแล้ว · กิจกรรมยังไม่ครบ' : 'กำลังทำ';
  const shortTitles = { compare: 'เปรียบเทียบห้องเรียน', time: 'แนวโน้มตามเวลา', focus: 'เน้นข้อมูลด้วยสี', axis: 'ผลของจุดเริ่มแกน', revision: 'ปรับปรุงกราฟคะแนน' };
  const title = shortTitles[task.taskId] || task.title;
  return `<li class="dashboard-task${completed(task) ? ' is-complete' : ''}"><div class="dashboard-task-heading"><span>${index + 1}. ${esc(title)}</span><span class="completion-badge">${completed(task) ? '✓ ' : ''}${status}</span></div><p class="help">ตอบผ่าน ${masteredCount(task)}/${task.questions.length} ข้อ${completed(task) ? ' · บันทึกกิจกรรมแล้ว' : ''}</p>${!completed(task) && task.started ? `<p class="task-next"><strong>ยังต้องทำ:</strong> ${missingItems(task).join(' · ')}</p>` : ''}${reviewButton(task, completed(task) ? 'ทบทวนกิจกรรม' : task.started ? 'ทำต่อ' : 'เริ่มกิจกรรม')}</li>`;
}
function labCard(lab) {
  const basic = lab.tasks.filter(t => t.section === 'foundation');
  const extra = lab.tasks.filter(t => t.section === 'extension');
  const count = basic.filter(completed).length;
  const done = count === basic.length;
  return `<section class="summary-lab dashboard-lab${done ? ' is-complete' : ''}" data-lab-id="${lab.labId}"><div class="dashboard-lab-heading"><h3>${esc(lab.labTitle)}</h3><span class="completion-badge">${done ? '✓ พื้นฐานครบแล้ว' : 'พื้นฐานยังไม่ครบ'}</span></div><p class="lab-completion"><strong>${count} / ${basic.length}</strong> สถานการณ์พื้นฐาน</p><progress value="${count}" max="${basic.length}" aria-label="${esc(lab.labTitle)}: ทำกิจกรรมพื้นฐานครบ ${count} จาก ${basic.length} สถานการณ์"></progress><details class="dashboard-foundation"><summary>ดูสถานะ ${basic.length} สถานการณ์พื้นฐาน</summary><ul class="dashboard-task-list">${basic.map(taskRow).join('')}</ul></details>${extra.length ? `<details class="dashboard-extra"><summary>กิจกรรมเพิ่มเติม · ทำครบ ${extra.filter(completed).length}/${extra.length} สถานการณ์</summary><p class="help">แสดงแยกจากความครบถ้วนของกิจกรรมพื้นฐาน</p><ul class="dashboard-task-list">${extra.map(taskRow).join('')}</ul></details>` : '<p class="help">ทุกสถานการณ์ในแล็บนี้เป็นพื้นฐาน</p>'}</section>`;
}
export function summaryHtml(summary) {
  const totals = summary.totals;
  const basic = summary.sections.find(s => s.section === 'foundation');
  const completeLabs = summary.labs.filter(l => l.tasks.filter(t => t.section === 'foundation').every(completed)).length;
  const remaining = basic.taskCount - basic.completedTaskCount;
  const list = (items, empty) => items.length ? `<ul>${items.map(item => `<li>${reviewButton(item, questions[item.questionId].prompt)}</li>`).join('')}</ul>` : `<p class="help">${empty}</p>`;
  return `<div class="dashboard-header"><div><p class="eyebrow">ความคืบหน้าการเรียน</p><h2 id="stage-title" tabindex="-1">สรุปการเรียนรู้</h2><p>${remaining ? `เหลือกิจกรรมพื้นฐานอีก ${remaining} สถานการณ์ ตรวจรายการที่ยังต้องทำในแต่ละแล็บด้านล่าง` : 'ทำกิจกรรมพื้นฐานครบทั้ง 4 แล็บแล้ว สามารถทบทวนหรือทำกิจกรรมเพิ่มเติมได้'}</p></div><div class="summary-actions"><button id="return-activity" class="secondary">กลับสู่กิจกรรม</button><button id="open-report" class="primary">รายงานสำหรับส่งงาน (PDF)</button></div></div>
    <div class="summary-metrics"><p><span>สถานการณ์พื้นฐานที่ทำครบ</span><strong>${basic.completedTaskCount} / ${basic.taskCount}</strong></p><p><span>แล็บที่ทำพื้นฐานครบ</span><strong>${completeLabs} / ${totals.labCount}</strong></p><p><span>คำถามพื้นฐานที่เคยตอบผ่าน</span><strong>${basic.masteredQuestionCount} / ${basic.questionCount}</strong></p><p><span>คำถามที่เคยตอบผ่านทั้งหมด</span><strong>${totals.masteredQuestionCount} / ${totals.questionCount}</strong></p></div>
    <p class="dashboard-explanation"><strong>ตอบผ่าน ≠ ทำกิจกรรมครบ</strong> การทำครบต้องบันทึกกราฟ 2 รูปแบบ ตอบคำถามผ่านครบ ปรับกราฟผ่านเกณฑ์ กรอกสะท้อนคิด และกดบันทึกกิจกรรม ระบบยังไม่ได้ประเมินเหตุผลในข้อความสะท้อนคิด</p>
    <h3 class="dashboard-section-title">กิจกรรมพื้นฐานทั้ง 4 แล็บ</h3><div class="dashboard-labs">${summary.labs.map(labCard).join('')}</div>
    <details class="dashboard-review"><summary>ทบทวนการฝึกและผลรายคำถาม</summary><p class="help">ส่งคำตอบทั้งหมด ${totals.attemptCount} ครั้ง · ตอบผิด ${totals.incorrectAttemptCount} ครั้ง ความผิดพลาดไม่ลดผลที่เคยผ่าน</p><section><h3>ข้อที่ยังตอบไม่ผ่าน</h3>${list(summary.questionsNeedingPractice, 'ไม่มีข้อที่ส่งแล้วและยังตอบไม่ผ่าน')}</section><section><h3>ข้อที่เคยใช้การฝึกซ้ำ</h3>${list(summary.repeatedAttemptQuestions, 'ยังไม่มีข้อที่ใช้การฝึกซ้ำ')}</section>
    ${summary.labs.map(lab => `<section class="summary-detail-lab"><details><summary>${esc(lab.labTitle)}</summary><p>${lab.masteryStatus === 'mastered' ? '✓ ผ่านข้อประเมินครบ' : 'ยังผ่านข้อประเมินไม่ครบ'} · ${lab.completionStatus === 'complete' ? '✓ ทำกิจกรรมครบ' : 'ยังทำกิจกรรมไม่ครบ'}</p>${lab.tasks.map((task, i) => `<details><summary>สถานการณ์ ${i + 1} · ${esc(task.title)} · ${task.completionStatus === 'complete' ? 'ทำครบแล้ว' : 'ยังไม่ครบ'}</summary><h4>สถานการณ์ ${i + 1} · ${esc(task.title)} <small>(${task.section === 'foundation' ? 'พื้นฐาน' : 'เพิ่มเติม'})</small> ${reviewButton(task, 'เปิดทบทวน')}</h4><p class="help">หลักฐานทดลอง: ${task.experimentStatus === 'complete' ? 'ครบ' : 'ยังไม่ครบ'} · กราฟปัจจุบัน: ${task.designStatus === 'met' ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'} · สะท้อนคิดปัจจุบัน: ${task.reflectionProvided ? 'กรอกแล้ว' : 'ยังไม่ครบ'} (ยังไม่ได้ประเมินเหตุผล)</p><div class="table-scroll"><table><caption>ผลรายคำถาม · ${task.completionStatus === 'complete' ? 'เคยทำสถานการณ์ครบแล้ว' : 'ยังทำสถานการณ์ไม่ครบ'}</caption><thead><tr><th scope="col">คำถาม</th><th scope="col">Mastery</th><th scope="col">ส่งคำตอบ</th><th scope="col">ตอบผิด</th><th scope="col">ผ่านครั้งแรก</th><th scope="col">ผลล่าสุด</th></tr></thead><tbody>${task.questions.map(question => `<tr><th scope="row">${esc(questions[question.questionId].prompt)}</th><td>${question.masteryStatus === 'mastered' ? 'เคยผ่านแล้ว' : 'ยังไม่ผ่าน'}</td><td>${question.attemptCount}</td><td>${question.incorrectAttemptCount}</td><td>${question.firstMasteredAttempt ?? '—'}</td><td>${question.latestCorrect === null ? 'ยังไม่ส่ง' : question.latestCorrect ? 'ถูกต้อง' : 'ควรทบทวน'}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</details></section>`).join('')}
    </details><p class="notice">ผลอยู่ในเบราว์เซอร์และแก้ไขได้ ไม่ใช่ผลการเรียนที่ผ่านการยืนยัน ความคืบหน้าจะกลับมาได้เมื่อเปิดบันทึกบนเครื่องและบันทึกสำเร็จเท่านั้น</p>`;
}
