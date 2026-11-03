export class RevisionConflict extends Error {}

export function storageNames(basePath) {
  const scope = `visualization-lab:${basePath}`;
  return { database: scope, preference: `${scope}:enabled` };
}

export function openDatabase(name, indexedDBFactory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDBFactory) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDBFactory.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ['meta', 'tasks', 'attempts']) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('มีแท็บอื่นขวางการเปิดพื้นที่บันทึก กรุณาปิดแท็บนั้น'));
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
  });
}

export function readDatabase(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta', 'tasks', 'attempts'], 'readonly');
    const metaRequest = tx.objectStore('meta').get('progress');
    const taskRequest = tx.objectStore('tasks').getAll();
    const attemptRequest = tx.objectStore('attempts').getAll();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('อ่านข้อมูลไม่สำเร็จ'));
    tx.oncomplete = () => {
      const meta = metaRequest.result;
      if (!meta) return resolve(null);
      const tasks = Object.fromEntries(taskRequest.result.map(({ key, draft }) => [key, draft]));
      for (const { taskKey, questionId, attempt } of attemptRequest.result) {
        const progress = tasks[taskKey]?.questions?.[questionId];
        if (progress && Array.isArray(progress.history)) progress.history.push(attempt);
      }
      for (const draft of Object.values(tasks)) for (const progress of Object.values(draft.questions || {})) if (Array.isArray(progress.history)) progress.history.sort((a, b) => a.attemptNumber - b.attemptNumber);
      resolve({ ...meta, tasks });
    };
  });
}

export function writeDatabase(db, payload, expectedRevision, { replace = false } = {}) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta', 'tasks', 'attempts'], 'readwrite');
    let conflict = false, writeError;
    const request = tx.objectStore('meta').get('progress');
    request.onsuccess = () => {
      try {
      const previous = request.result;
      if ((previous?.revision || 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      if (replace) { tx.objectStore('tasks').clear(); tx.objectStore('attempts').clear(); }
      const historyCounts = {};
      for (const [key, source] of Object.entries(payload.tasks)) {
        const draft = { ...source, questions: {} };
        for (const [questionId, progress] of Object.entries(source.questions)) {
          const countKey = `${key}/${questionId}`;
          const count = replace ? 0 : previous?.historyCounts?.[countKey] || 0;
          if (count > progress.history.length) { conflict = true; tx.abort(); return; }
          progress.history.slice(count).forEach(attempt => tx.objectStore('attempts').put({ taskKey: key, questionId, attempt }, [key, questionId, attempt.attemptNumber]));
          historyCounts[countKey] = progress.history.length;
          draft.questions[questionId] = { ...progress, history: [] };
        }
        tx.objectStore('tasks').put({ key, draft }, key);
      }
      const { tasks, ...meta } = payload;
      tx.objectStore('meta').put({ ...meta, revision: expectedRevision + 1, historyCounts }, 'progress');
      } catch (error) { writeError = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(expectedRevision + 1);
    tx.onerror = () => reject(tx.error || new Error('บันทึกไม่สำเร็จ'));
    tx.onabort = () => reject(conflict ? new RevisionConflict('ข้อมูลในอีกแท็บเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนบันทึกต่อ') : writeError || tx.error || new Error('บันทึกไม่สำเร็จ'));
  });
}

export function removeProgress(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta', 'tasks', 'attempts'], 'readwrite');
    for (const store of ['meta', 'tasks', 'attempts']) tx.objectStore(store).clear();
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('ลบข้อมูลไม่สำเร็จ'));
  });
}
