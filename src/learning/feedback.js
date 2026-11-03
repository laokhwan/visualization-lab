import { hints } from '../content/hints.js';

export function feedbackLevel(progress) {
  let incorrect = 0;
  for (let i = progress.history.length - 1; i >= 0 && !progress.history[i].correct; i--) incorrect++;
  return incorrect ? Math.min(3, Math.max(incorrect, progress.requestedHintLevel || 0)) : 0;
}

export function adaptiveFeedback(question, progress) {
  const level = feedbackLevel(progress);
  if (!level) return { level: 0, messages: [], repeated: false };
  const last = progress.history.at(-1), previous = progress.history.at(-2);
  const signature = attempt => JSON.stringify([...attempt.selectedOptionIds].sort());
  const repeated = Boolean(previous && !previous.correct && signature(last) === signature(previous));
  const messages = last.selectedOptionIds.map(id => question.options.find(option => option.id === id).retryFeedback);
  for (let i = 1; i < level; i++) messages.push(hints[question.id][i]);
  if (level === 1) messages.push(hints[question.id][0]);
  if (repeated) messages.push('ลองใช้ตารางหรือกราฟอีกแบบเพื่อตรวจแต่ละข้อความ แทนการส่งตัวเลือกเดิมจากความจำ');
  return { level, messages: [...new Set(messages)], repeated };
}

export function requestHint(progress) {
  const level = feedbackLevel(progress);
  if (level) progress.requestedHintLevel = Math.min(3, level + 1);
}
