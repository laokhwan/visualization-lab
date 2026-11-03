import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createState, resetGuided } from '../src/state.js';
import { serializeProgress, restoreProgress } from '../src/storage/schema.js';
import { openDatabase, readDatabase, writeDatabase, RevisionConflict, storageNames } from '../src/storage/database.js';
import { createPersistence } from '../src/storage/controller.js';
import { buildLearningSummary } from '../src/learning/report.js';
import { prepareTask } from './helpers/learning.js';

const preferences = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('round-trip restores history, evidence and historical completion but never Free', () => {
  const state = createState();
  prepareTask(state);
  state.free.dataset.rows[0].value = 999;
  const raw = serializeProgress(state);
  assert.equal(raw.free, undefined);
  const restored = restoreProgress(raw);
  assert.equal(restored.status, 'restored');
  assert.deepEqual(buildLearningSummary(restored.state), buildLearningSummary(state));
  assert.notEqual(restored.state.free.dataset.rows[0].value, 999);
  assert.deepEqual(restored.state.guided.choose.compare.completion, state.guided.choose.compare.completion);
});

test('stored correctness and mastery flags cannot override answer replay', () => {
  const raw = serializeProgress(createState());
  const state = createState();
  prepareTask(state, 'choose', 'compare', { complete: false });
  const payload = serializeProgress(state);
  const q = payload.tasks['choose/compare'].questions['compare-reason'];
  q.history[0].selectedOptionIds = ['a']; q.selectedOptionIds = ['a']; q.history[0].correct = true; q.masteryStatus = 'mastered';
  const result = restoreProgress(payload);
  assert.equal(result.status, 'restored');
  assert.equal(result.state.guided.choose.compare.questions['compare-reason'].masteryStatus, 'not-mastered');
  assert.equal(restoreProgress(raw).state.guided.choose.compare.questions['compare-reason'].history.length, 0);
});

test('corrupt task is isolated; unknown schema is blocked without overwrite', () => {
  const state = createState(); prepareTask(state); prepareTask(state, 'color', 'focus');
  const payload = serializeProgress(state);
  payload.tasks['choose/compare'].questions['compare-reason'].history[0].attemptNumber = 9;
  const result = restoreProgress(payload);
  assert.equal(result.status, 'partial');
  assert.equal(result.blocked, true);
  assert.equal(result.issues[0].key, 'choose/compare');
  assert.ok(result.state.guided.color.focus.completion);
  assert.equal(result.state.guided.choose.compare.completion, null);
  payload.storageSchemaVersion = 99;
  assert.equal(restoreProgress(payload).status, 'unsupported');
  assert.equal(restoreProgress(null).status, 'corrupt');
});

test('content-only changes preserve results; changed assessments invalidate one task', () => {
  const state = createState(); prepareTask(state); prepareTask(state, 'color', 'focus');
  const payload = serializeProgress(state);
  payload.contentVersion = 'old-presentation';
  assert.equal(restoreProgress(payload).status, 'restored');
  payload.assessmentManifest['choose/compare'].assessmentVersion = 99;
  const result = restoreProgress(payload);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].reason, 'content');
  assert.ok(result.state.guided.color.focus.completion);
});

test('malformed selections, evidence and completion checkpoints are quarantined', () => {
  const state = createState(); prepareTask(state);
  for (const mutate of [
    raw => raw.tasks['choose/compare'].experiments[0].dataset.rows[0].value = 999,
    raw => raw.tasks['choose/compare'].questions['compare-reason'].selectedOptionIds = ['unknown'],
    raw => raw.tasks['choose/compare'].completion.questionAttemptNumbers['compare-reason'] = 0,
    raw => raw.tasks['choose/compare'].note = 'x'.repeat(2001),
  ]) {
    const raw = serializeProgress(state); mutate(raw);
    assert.equal(restoreProgress(raw).status, 'partial');
  }
});

test('IndexedDB appends histories atomically, rejects stale revisions and resets', async () => {
  const db = await openDatabase('test', new IDBFactory());
  const state = createState(); prepareTask(state);
  assert.equal(await writeDatabase(db, serializeProgress(state), 0), 1);
  assert.equal(await writeDatabase(db, serializeProgress(state), 1), 2);
  const raw = await readDatabase(db);
  assert.equal(raw.tasks['choose/compare'].questions['compare-reason'].history.length, 1);
  await assert.rejects(writeDatabase(db, serializeProgress(state), 1), RevisionConflict);
  assert.equal((await readDatabase(db)).revision, 2);
  resetGuided(state);
  await writeDatabase(db, serializeProgress(state), 2, { replace: true });
  assert.equal((await readDatabase(db)).tasks['choose/compare'].questions['compare-reason'].history.length, 0);
  db.close();
});

test('opt-in controller restores after reload and deletion cannot resurrect queued drafts', async () => {
  const factory = new IDBFactory(), prefs = preferences(), state = createState();
  const make = target => createPersistence({ state: target, basePath: '/lab/', preferences: prefs, indexedDBFactory: factory });
  const first = make(state);
  await first.initialize();
  assert.equal(first.getInfo().status, 'off');
  prepareTask(state);
  await first.enable();
  assert.equal(first.getInfo().status, 'saved');
  const secondState = createState(), second = make(secondState);
  await second.initialize();
  assert.ok(secondState.guided.choose.compare.completion);
  secondState.guided.choose.compare.note = 'ข้อความร่างใหม่';
  second.save({ draft: true });
  await second.disable();
  await new Promise(resolve => setTimeout(resolve, 550));
  const third = make(createState()); await third.initialize();
  assert.equal(third.getInfo().status, 'off');
  assert.equal(await readDatabase(await openDatabase(storageNames('/lab/').database, factory)), null);
});

test('permission failures stay in memory and namespace separates project sites', async () => {
  const state = createState(); prepareTask(state);
  const controller = createPersistence({ state, basePath: '/a/', preferences: { getItem() { throw new Error('blocked'); } }, indexedDBFactory: new IDBFactory() });
  await controller.initialize();
  assert.equal(controller.getInfo().status, 'error');
  assert.ok(state.guided.choose.compare.completion);
  assert.notEqual(storageNames('/a/').database, storageNames('/b/').database);
});
