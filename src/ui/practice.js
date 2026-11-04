import { questions } from '../content/questions.js';
import { escapeHtml as esc } from './html.js';
import { questionCounts } from '../learning/practice.js';
import { adaptiveFeedback } from '../learning/feedback.js';
export function questionHtml(id, progress, index, presentation = {}) {
  const question = questions[id];
  const counts = questionCounts(progress);
  const latest = progress.history.at(-1);
  const hint = adaptiveFeedback(question, progress);
  const feedback = latest ? latest.correct ? `<p class="success">✓ คำตอบนี้ผ่านเกณฑ์แล้ว</p><details><summary>เหตุผลของแต่ละตัวเลือก</summary><ul class="criteria">${question.options.map(option => `<li><strong>${question.correctOptionIds.includes(option.id) ? '✓ สอดคล้องกับโจทย์' : 'ข้อควรพิจารณา'}: ${esc(option.text)}</strong><p>${esc(option.explanation)}</p></li>`).join('')}</ul></details>` : `<p>ยังไม่ตรงกับคำถาม ลองทบทวนกราฟและคำแนะนำ</p><p class="help">คำใบ้ระดับ ${hint.level} / 3 · ไม่หักผลที่เคยผ่าน</p><ul>${hint.messages.map(message => `<li>${esc(message)}</li>`).join('')}</ul>${hint.level < 3 ? `<button type="button" class="text-button" data-more-hint="${id}">ดูคำใบ้เพิ่มเติม</button>` : '<p class="help">กลับไปทดลองกราฟตามขั้นข้างต้น แล้วลองใหม่ได้ไม่จำกัด</p>'}` : '<p class="help">ยังไม่ได้ส่งคำตอบ</p>';
  return `<h4 id="${id}-title">คำถามที่ ${index + 1} · ${question.type === 'single' ? 'เลือกคำตอบเดียว' : 'เลือกได้หลายคำตอบ'}</h4>
    <p class="question-mastery">${progress.masteryStatus === 'mastered' ? '✓ เคยตอบถูกแล้ว (Mastered)' : 'ยังไม่ผ่านข้อประเมิน'} · ส่งแล้ว ${counts.attemptCount} ครั้ง · ตอบผิด ${counts.incorrectAttemptCount} ครั้ง</p>
    <form data-question-form="${id}" novalidate><fieldset${progress.editing ? '' : ' disabled'}><legend>${esc(question.prompt)}</legend>${question.options.map(option => `<label class="answer-option"><input type="${question.type === 'single' ? 'radio' : 'checkbox'}" name="${id}" value="${option.id}"${progress.selectedOptionIds.includes(option.id) ? ' checked' : ''}><span>${esc(option.text)}</span></label>`).join('')}</fieldset>
    <p id="${id}-validation" class="form-message" role="status">${esc(progress.validationMessage)}</p><div class="button-row">${!presentation.workspace || progress.editing ? `<button type="submit" class="primary"${progress.editing ? '' : ' disabled'}>ส่งคำตอบ</button>` : ''}${latest && !progress.editing ? `${presentation.workspace && latest.correct ? `<button type="button" class="primary" data-question-next>${presentation.last ? 'เขียนสะท้อนคิด' : 'ข้อต่อไป'}</button>` : ''}<button type="button" class="${presentation.workspace && !latest.correct ? 'primary' : 'secondary'}" data-retry="${id}">${latest.correct ? 'ฝึกซ้ำ' : 'ลองอีกครั้ง'}</button>` : ''}</div></form>
    <div id="${id}-feedback" class="answer-feedback" tabindex="-1">${progress.editing && latest ? '<p class="help">กำลังเตรียมคำตอบใหม่ · ผลครั้งก่อนแสดงด้านล่าง</p>' : ''}${feedback}</div>`;
}
export function reflectionStatus(note) {
  return note.trim() ? 'กรอกแล้ว — ยังไม่ได้ประเมินเหตุผล' : 'ยังไม่ได้กรอก';
}
export function completionFeedbackHtml(draft) {
  if (!draft.completionFeedback) return draft.completion ? '<p class="success">✓ เคยทำกิจกรรมครบแล้ว เลือกกราฟเมื่อทำครบเพื่อทบทวนหลักฐาน</p>' : '<p class="help">ทำครบเมื่อผ่านคำถาม เกณฑ์กราฟ และกรอกสะท้อนคิด</p>';
  const message = draft.completionFeedback.retainedEvidence ? draft.completionFeedback.passed ? '✓ ฉบับปัจจุบันครบตามเกณฑ์ หลักฐานที่เคยบันทึกยังคงเดิม' : 'ฉบับปัจจุบันยังไม่ครบตามเกณฑ์ ผลที่เคยทำครบและหลักฐานเดิมยังคงอยู่' : draft.completionFeedback.passed ? '✓ ทำกิจกรรมครบแล้ว บันทึกหลักฐานสำหรับทบทวนแล้ว' : 'ยังทำกิจกรรมไม่ครบ โปรดตรวจรายการต่อไปนี้';
  return `<p>${message}</p><ul class="criteria">${draft.completionFeedback.criteria.map(item => `<li>${item.passed ? '✓' : '○'} ${esc(item.label)}${!item.passed && item.hint ? `<p class="help">${esc(item.hint)}</p>` : ''}</li>`).join('')}</ul>`;
}
