import { serializeProgress, restoreProgress } from './schema.js';
import { storageNames, openDatabase, readDatabase, writeDatabase, removeProgress, RevisionConflict } from './database.js';

export function createPersistence({ state, basePath, onChange = () => {}, preferences, indexedDBFactory = globalThis.indexedDB }) {
  try { preferences ||= globalThis.localStorage; }
  catch { preferences = { getItem() { throw new Error('Storage blocked'); } }; }
  const names = storageNames(basePath);
  let db, revision = 0, queue = Promise.resolve(), timer, epoch = 0;
  let enabled = false, blocked = false, needsReplacement = false;
  let info = { status: 'off', enabled: false, blocked: false, message: 'ยังไม่เปิดบันทึก ข้อมูลอยู่ในหน้านี้และหายเมื่อโหลดใหม่' };
  const emit = (status, message) => { info = { status, enabled, blocked, message }; onChange(info); };
  const error = exception => {
    if (exception instanceof RevisionConflict) blocked = true;
    emit('error', exception instanceof RevisionConflict ? exception.message : 'บันทึกไม่สำเร็จ ข้อมูลยังอยู่ในหน้านี้ กรุณาตรวจพื้นที่ว่างแล้วลองใหม่');
  };
  const ensureDb = async () => db ||= await openDatabase(names.database, indexedDBFactory);

  async function initialize() {
    try {
      enabled = preferences.getItem(names.preference) === 'true';
      if (!enabled) { emit('off', info.message); return; }
      emit('loading', 'กำลังกู้คืนความคืบหน้าจากเครื่องนี้');
      const payload = await readDatabase(await ensureDb());
      if (!payload) { emit('ready', 'เปิดบันทึกแล้ว ยังไม่มีความคืบหน้าที่บันทึก'); return; }
      revision = payload.revision;
      const restored = restoreProgress(payload);
      blocked = restored.blocked;
      if (restored.state) {
        state.guided = restored.state.guided;
        state.labId = restored.state.labId;
        state.taskIndex = restored.state.taskIndex;
      }
      needsReplacement = restored.status === 'partial';
      emit(blocked ? 'recovery' : 'restored', blocked ? restored.warnings.join(' · ') + ' · ยังไม่เขียนทับข้อมูลเดิม' : 'กู้คืนความคืบหน้าแล้ว ตรวจว่าเป็นการฝึกของคุณก่อนเรียนต่อบนเครื่องที่ใช้ร่วมกัน');
    } catch (exception) { blocked = true; emit('error', 'เปิดพื้นที่บันทึกไม่ได้ ใช้หน้านี้ต่อได้ แต่ข้อมูลใหม่ยังไม่ถูกบันทึก'); }
  }

  function save({ draft = false } = {}) {
    clearTimeout(timer);
    if (!enabled || blocked) return queue;
    if (draft) { emit('pending', 'กำลังเตรียมบันทึกข้อความ'); timer = setTimeout(() => save(), 500); return queue; }
    const token = epoch;
    const payload = serializeProgress(state);
    emit('saving', 'กำลังบันทึก');
    queue = queue.then(async () => {
      if (token !== epoch || !enabled || blocked) return;
      try {
        revision = await writeDatabase(await ensureDb(), payload, revision);
        if (token === epoch) emit('saved', 'บันทึกแล้วบนเครื่องนี้');
      } catch (exception) { if (token === epoch) error(exception); }
    });
    return queue;
  }

  async function enable() {
    try {
      const existing = await readDatabase(await ensureDb());
      if (existing) {
        blocked = true;
        emit('recovery', 'มีข้อมูลเก่าบนเครื่องนี้ กรุณาโหลดใหม่เพื่อกู้คืน หรือยืนยันเริ่มการฝึกใหม่ทั้งหมด');
        preferences.setItem(names.preference, 'true'); enabled = true;
        emit('recovery', 'พบความคืบหน้าเดิม กรุณาโหลดหน้าใหม่เพื่อกู้คืนก่อนบันทึกต่อ');
        return;
      }
      preferences.setItem(names.preference, 'true');
      enabled = true; blocked = false; revision = 0;
      await save();
    } catch (exception) { error(exception); }
  }

  async function reset() {
    clearTimeout(timer); epoch++;
    await queue;
    if (!enabled) return;
    try {
      const latest = await readDatabase(await ensureDb());
      revision = await writeDatabase(db, serializeProgress(state), latest?.revision || 0, { replace: true });
      blocked = false; needsReplacement = false;
      emit('saved', 'เริ่มรอบใหม่และล้างความคืบหน้าเดิมบนเครื่องแล้ว');
    } catch (exception) { error(exception); }
  }

  async function acceptRecovery() {
    if (!needsReplacement) return;
    clearTimeout(timer); epoch++;
    await queue;
    try {
      revision = await writeDatabase(await ensureDb(), serializeProgress(state), revision, { replace: true });
      blocked = false; needsReplacement = false;
      emit('saved', 'เริ่มเฉพาะสถานการณ์ที่อ่านไม่ได้หรือเนื้อหาเปลี่ยน และรักษาส่วนที่กู้คืนได้แล้ว');
    } catch (exception) { error(exception); }
  }

  async function disable() {
    clearTimeout(timer); epoch++; enabled = false;
    await queue;
    try {
      await removeProgress(await ensureDb());
      preferences.removeItem(names.preference);
      revision = 0; blocked = false; needsReplacement = false;
      emit('off', 'ลบความคืบหน้าจากเครื่องแล้ว ข้อมูลปัจจุบันยังใช้ต่อในหน้านี้ได้');
    } catch {
      blocked = true;
      emit('error', 'ยังลบข้อมูลจากเครื่องไม่สำเร็จ กรุณาปิดแท็บอื่นและลองลบอีกครั้ง');
    }
  }

  function pauseForOtherTab() { clearTimeout(timer); epoch++; blocked = true; emit('error', 'ตัวเลือกบันทึกเปลี่ยนจากอีกแท็บ กรุณาโหลดหน้านี้ใหม่ก่อนบันทึกต่อ'); }
  return { initialize, enable, save, flush: () => { clearTimeout(timer); return save(); }, reset, disable, acceptRecovery, pauseForOtherTab, getInfo: () => ({ ...info, canRecover: needsReplacement, preferenceKey: names.preference }) };
}
