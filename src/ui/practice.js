import { questions } from '../content/questions.js';
import { predictions } from '../content/labs.js';
import { th } from '../content/locales/th.js';
import { escapeHtml as esc } from './html.js';
import { questionCounts } from '../learning/practice.js';
import { experimentComplete } from '../learning/experiments.js';
import { chartSvg, legendHtml } from '../charts/render.js';
import { adaptiveFeedback } from '../learning/feedback.js';

export function questionHtml(id, progress, index) {
  const question = questions[id];
  const counts = questionCounts(progress);
  const latest = progress.history.at(-1);
  const hint = adaptiveFeedback(question, progress);
  const feedback = latest ? latest.correct
    ? `<p class="success">✓ คำตอบนี้ผ่านเกณฑ์แล้ว</p><details><summary>เหตุผลของแต่ละตัวเลือก</summary><ul class="criteria">${question.options.map(option => `<li><strong>${question.correctOptionIds.includes(option.id) ? '✓ สอดคล้องกับโจทย์' : 'ข้อควรพิจารณา'}: ${esc(option.text)}</strong><p>${esc(option.explanation)}</p></li>`).join('')}</ul></details>`
    : `<p>ยังไม่ตรงกับคำถาม ลองทบทวนกราฟและคำแนะนำ</p><p class="help">คำใบ้ระดับ ${hint.level} / 3 · ไม่หักผลที่เคยผ่าน</p><ul>${hint.messages.map(message => `<li>${esc(message)}</li>`).join('')}</ul>${hint.level < 3 ? `<button type="button" class="text-button" data-more-hint="${id}">ดูคำใบ้เพิ่มเติม</button>` : '<p class="help">กลับไปทดลองกราฟตามขั้นข้างต้น แล้วลองใหม่ได้ไม่จำกัด</p>'}`
    : '<p class="help">ยังไม่ได้ส่งคำตอบ</p>';
  return `<h4 id="${id}-title">คำถามที่ ${index + 1} · ${question.type === 'single' ? 'เลือกคำตอบเดียว' : 'เลือกได้หลายคำตอบ'}</h4>
    <p class="question-mastery">${progress.masteryStatus === 'mastered' ? '✓ เคยตอบถูกแล้ว (Mastered)' : 'ยังไม่ผ่านข้อประเมิน'} · ส่งแล้ว ${counts.attemptCount} ครั้ง · ตอบผิด ${counts.incorrectAttemptCount} ครั้ง</p>
    <form data-question-form="${id}" novalidate><fieldset${progress.editing ? '' : ' disabled'}><legend>${esc(question.prompt)}</legend>${question.options.map(option => `<label class="answer-option"><input type="${question.type === 'single' ? 'radio' : 'checkbox'}" name="${id}" value="${option.id}"${progress.selectedOptionIds.includes(option.id) ? ' checked' : ''}><span>${esc(option.text)}</span></label>`).join('')}</fieldset>
    <p id="${id}-validation" class="form-message" role="status">${esc(progress.validationMessage)}</p><div class="button-row"><button type="submit" class="primary"${progress.editing ? '' : ' disabled'}>ส่งคำตอบ</button>${latest && !progress.editing ? `<button type="button" class="secondary" data-retry="${id}">${latest.correct ? 'ฝึกซ้ำ' : 'ลองอีกครั้ง'}</button>` : ''}</div></form>
    <div id="${id}-feedback" class="answer-feedback" tabindex="-1">${progress.editing && latest ? '<p class="help">กำลังเตรียมคำตอบใหม่ · ผลครั้งก่อนแสดงด้านล่าง</p>' : ''}${feedback}</div>`;
}

export function evidenceHtml(snapshot, prefix, key) {
  return `<div data-evidence="${esc(key)}"><div class="chart-scroll" tabindex="0" aria-label="กราฟที่บันทึก เลื่อนแนวนอนได้">${chartSvg(snapshot.dataset, snapshot.config, prefix)}</div><ul class="legend">${legendHtml(snapshot.dataset, snapshot.config)}</ul><p class="inspection" role="status">เลือกข้อมูลในกราฟที่บันทึกเพื่ออ่านค่า</p></div>`;
}

export function experimentsHtml(task, draft) {
  return `<ul class="experiment-checklist">${task.experiment.map(slot => {
    const snapshot = draft.experiments.find(item => item.slotId === slot.id);
    return `<li>${snapshot ? `<details><summary>✓ บันทึกแล้ว: ${esc(slot.label)}</summary>${evidenceHtml(snapshot, `evidence-${task.id}-${slot.id}`, slot.id)}</details>` : `○ รอบันทึก: ${esc(slot.label)}`}</li>`;
  }).join('')}</ul>`;
}

export function reasoningHtml(task, draft) {
  const unlocked = experimentComplete(task, draft);
  return `<p id="reasoning-locked" class="notice"${unlocked ? ' hidden' : ''}>บันทึกกราฟเปรียบเทียบให้ครบ 2 รูปแบบ เพื่อเปิดคำถามและช่องสะท้อนคิด</p>
    <section id="reasoning"${unlocked ? '' : ' hidden'} aria-labelledby="reasoning-title"><h3 id="reasoning-title" class="step-heading"><span class="step-number">3</span>อธิบายและตรวจความเข้าใจ</h3><p class="help">คำถามอ้างอิงข้อมูลและโจทย์ของสถานการณ์นี้ ตอบผิดแล้วทดลองและฝึกใหม่ได้โดยไม่หักผลที่เคยผ่าน</p>
    <fieldset id="reasoning-fields" class="reasoning-fields"${unlocked ? '' : ' disabled'}><legend class="sr-only">คำถามประเมินและสะท้อนคิด</legend>
    ${task.questionIds.map((id, index) => `<section id="question-${id}" class="question-card" aria-labelledby="${id}-title">${questionHtml(id, draft.questions[id], index)}</section>`).join('')}
    <section class="reflection"><h3>สะท้อนคิด (Reflection)</h3><div class="field"><label for="reflection">${task.prompt}</label><textarea id="reflection" maxlength="2000" aria-describedby="reflection-notice">${esc(draft.note)}</textarea><p id="reflection-status-1" class="help">${reflectionStatus(draft.note)}</p></div>${task.secondPrompt ? `<div class="field"><label for="reflection-2">${task.secondPrompt}</label><textarea id="reflection-2" maxlength="2000">${esc(draft.note2)}</textarea><p id="reflection-status-2" class="help">${reflectionStatus(draft.note2)}</p></div>` : ''}<p id="reflection-notice" class="help">ระบบไม่ประเมินความหมายของข้อความ ครูและผู้เรียนร่วมพิจารณาเหตุผล การกรอกข้อความไม่เพิ่ม Mastery</p>
    <button id="complete-task" class="primary" type="button">${draft.completion ? 'ตรวจเกณฑ์ปัจจุบัน' : 'บันทึกกิจกรรม'}</button><div id="completion-feedback" class="feedback" tabindex="-1"></div></section></fieldset></section>
    <div id="completion-review">${completionReviewHtml(task, draft)}</div>`;
}

export function reflectionStatus(note) {
  return note.trim() ? 'กรอกแล้ว — ยังไม่ได้ประเมินเหตุผล' : 'ยังไม่ได้กรอก';
}

export function completionFeedbackHtml(draft) {
  if (!draft.completionFeedback) return draft.completion ? '<p class="success">✓ เคยทำกิจกรรมครบแล้ว ดูหลักฐานที่บันทึกด้านล่าง</p>' : '<p class="help">ทำครบเมื่อผ่านคำถาม เกณฑ์กราฟ และกรอกสะท้อนคิด</p>';
  const message = draft.completionFeedback.retainedEvidence
    ? draft.completionFeedback.passed ? '✓ ฉบับปัจจุบันครบตามเกณฑ์ หลักฐานที่เคยบันทึกยังคงเดิม' : 'ฉบับปัจจุบันยังไม่ครบตามเกณฑ์ ผลที่เคยทำครบและหลักฐานเดิมยังคงอยู่'
    : draft.completionFeedback.passed ? '✓ ทำกิจกรรมครบแล้ว บันทึกหลักฐานสำหรับทบทวนแล้ว' : 'ยังทำกิจกรรมไม่ครบ โปรดตรวจรายการต่อไปนี้';
  return `<p>${message}</p><ul class="criteria">${draft.completionFeedback.criteria.map(item => `<li>${item.passed ? '✓' : '○'} ${esc(item.label)}${!item.passed && item.hint ? `<p class="help">${esc(item.hint)}</p>` : ''}</li>`).join('')}</ul>`;
}

export function completionReviewHtml(task, draft) {
  if (!draft.completion) return '';
  const saved = draft.completion;
  const predictionText = task.prediction === 'text' ? saved.prediction : (predictions[task.prediction] || th.prediction).find(([id]) => id === saved.prediction)?.[1] || saved.prediction;
  return `<details id="completed-review" class="original"><summary>ทบทวนหลักฐานเมื่อทำกิจกรรมครบ</summary><p class="help">กราฟและข้อความส่วนนี้เป็นสำเนาที่บันทึกเมื่อทำครบ การทดลองเพิ่มเติมไม่เปลี่ยนหลักฐานเดิม</p>${evidenceHtml(saved, `completed-${task.id}`, 'completion')}<h4>คำคาดการณ์ที่บันทึก</h4><p class="saved-text">${esc(predictionText)}</p><h4>สะท้อนคิด · ยังไม่ได้ประเมินเหตุผล</h4>${saved.reflections.map((note, i) => `<p class="saved-text">${i + 1}. ${esc(note)}</p>`).join('')}</details>`;
}
