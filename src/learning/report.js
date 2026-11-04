import { labs } from '../content/labs.js';
import { contentVersion } from '../content/questions.js';
import { questionCounts, taskMastered } from './practice.js';
import { experimentComplete } from './experiments.js';
import { evaluateDesign } from './evaluate.js';

/** LearningSummaryV2: identity-free DTO for UI and future PDF/Classroom adapters.
 * No answer keys, selected answers, predictions, or reflection text are exposed.
 */
export function buildLearningSummary(state) {
  const reportLabs = labs.map(lab => {
    const tasks = lab.tasks.map(task => {
      const draft = state.guided[lab.id][task.id];
      const taskQuestions = task.questionIds.map(questionId => {
        const progress = draft.questions[questionId];
        return {
          labId: lab.id, taskId: task.id, questionId,
          masteryStatus: progress.masteryStatus,
          completionStatus: progress.masteryStatus === 'mastered' ? 'complete' : 'incomplete',
          ...questionCounts(progress), firstMasteredAttempt: progress.firstMasteredAttempt,
          latestCorrect: progress.history.at(-1)?.correct ?? null,
        };
      });
      return {
        labId: lab.id, taskId: task.id, title: task.title || task.mission, section: task.section || 'foundation',
        masteryStatus: taskMastered(task, draft) ? 'mastered' : 'not-mastered',
        completionStatus: draft.completion ? 'complete' : 'incomplete',
        experimentStatus: experimentComplete(task, draft) ? 'complete' : 'incomplete',
        designStatus: evaluateDesign(task, draft.config).passed ? 'met' : 'not-met',
        reflectionProvided: Boolean(draft.note.trim()) && (!task.secondPrompt || Boolean(draft.note2.trim())),
        reflectionEvaluation: 'not-evaluated',
        started: draft.predictionSaved || draft.experiments.length > 0 || taskQuestions.some(q => q.attemptCount > 0) || Boolean(draft.note.trim()) || Boolean(draft.note2.trim()),
        attemptCount: taskQuestions.reduce((sum, item) => sum + item.attemptCount, 0),
        incorrectAttemptCount: taskQuestions.reduce((sum, item) => sum + item.incorrectAttemptCount, 0),
        questions: taskQuestions,
      };
    });
    const all = tasks.flatMap(task => task.questions);
    return {
      labId: lab.id, labTitle: lab.title, masteryStatus: tasks.every(task => task.masteryStatus === 'mastered') ? 'mastered' : 'not-mastered',
      completionStatus: tasks.every(task => task.completionStatus === 'complete') ? 'complete' : 'incomplete',
      attemptCount: all.reduce((sum, item) => sum + item.attemptCount, 0),
      incorrectAttemptCount: all.reduce((sum, item) => sum + item.incorrectAttemptCount, 0), tasks,
    };
  });
  const tasks = reportLabs.flatMap(lab => lab.tasks);
  const all = tasks.flatMap(task => task.questions);
  const reference = item => ({ labId: item.labId, taskId: item.taskId, questionId: item.questionId });
  return {
    schemaVersion: 2, contentVersion, labs: reportLabs,
    sections: ['foundation','extension'].map(section => { const selected=tasks.filter(task=>task.section===section), qs=selected.flatMap(t=>t.questions);return { section,taskCount:selected.length,completedTaskCount:selected.filter(t=>t.completionStatus==='complete').length,questionCount:qs.length,masteredQuestionCount:qs.filter(q=>q.masteryStatus==='mastered').length }; }),
    totals: {
      questionCount: all.length, masteredQuestionCount: all.filter(item => item.masteryStatus === 'mastered').length,
      taskCount: tasks.length, completedTaskCount: tasks.filter(item => item.completionStatus === 'complete').length,
      labCount: reportLabs.length, completedLabCount: reportLabs.filter(lab => lab.completionStatus === 'complete').length,
      attemptCount: all.reduce((sum, item) => sum + item.attemptCount, 0),
      incorrectAttemptCount: all.reduce((sum, item) => sum + item.incorrectAttemptCount, 0),
    },
    questionsNeedingPractice: all.filter(item => item.masteryStatus !== 'mastered' && item.attemptCount > 0).map(reference),
    repeatedAttemptQuestions: all.filter(item => item.firstMasteredAttempt > 1 || (item.masteryStatus !== 'mastered' && item.incorrectAttemptCount > 0)).map(reference),
    integrity: 'browser-unverified',
  };
}
