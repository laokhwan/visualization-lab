import { test,expect } from '@playwright/test';

const scenarios={
  choose:[
    [2,'scatter-relationship',[['kind','scatter']],['b'],['a','c']],
    [3,'histogram-distribution',[['histogram-count','6']],['a'],['b','d']],
    [4,'boxplot-groups',[['grouped',true]],['c'],['a','b','d']],
  ],
  color:[
    [1,'categorical-colors',[['color-schemeType','categorical'],['color-field','surface']],['a'],['b','c']],
    [2,'sequential-colors',[['color-schemeType','sequential']],['b'],['a','d']],
    [3,'diverging-reference',[['color-schemeType','diverging']],['c'],['a','b']],
  ],
  misleading:[
    [1,'perspective-3d',[['presentation','2d']],['b'],['a','c']],
    [2,'binning-context',[['histogram-count','6']],['c'],['b','d']],
    [3,'time-window',[['windowMode','recent']],['a'],['a','c']],
    [4,'dual-axis',[['presentation','small-multiples']],['b'],['a','c','d']],
  ],
  redesign:[
    [1,'redesign-distribution',[['kind','histogram']],['b'],['a','c']],
    [2,'redesign-time-context',[['presentation','indexed']],['c'],['a','b','d']],
  ],
};
async function adjust(page,id,value){
  const input=page.locator(`#${id}`),tag=await input.evaluate(e=>e.tagName);
  if(tag==='SELECT')await input.selectOption(value);
  else if(typeof value==='boolean')await input.setChecked(value);
  else{await input.fill(value);await input.blur();}
}
async function answer(page,id,values){
  const q=page.locator(`#question-${id}`);for(const value of values)await q.locator(`input[value="${value}"]`).check();
  await q.getByRole('button',{name:'ส่งคำตอบ',exact:true}).click();
  await expect(q.locator('.question-mastery')).toContainText('เคยตอบถูกแล้ว');
}
test.beforeEach(async({page})=>{await page.goto('./');});
for(const [lab,items]of Object.entries(scenarios))test(`new ${lab} activities preserve the complete learning flow`,async({page},testInfo)=>{
  test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [index,id,changes,single,multiple]of items){
    await page.locator(`[data-lab="${lab}"]`).click();await page.locator(`[data-task="${index}"]`).click();
    await expect(page.locator('#reasoning')).toBeHidden();await expect(page.locator('#kind')).toBeDisabled();
    await page.locator('#prediction').fill('คาดว่าต้องตรวจชนิดตัวแปร การกระจาย สี และบริบท');await page.locator('#save-prediction').click();
    await page.locator('#record-experiment').click();await expect(page.locator('#experiments-list')).toContainText('✓ บันทึกแล้ว');
    await page.locator('#labels').uncheck();await page.locator('#record-experiment').click();await expect(page.locator('#reasoning')).toBeHidden();
    for(const [control,value]of changes)await adjust(page,control,value);
    await expect(page.locator('#chart svg')).toBeVisible();await page.locator('#record-experiment').click();
    await expect(page.locator('#reasoning')).toBeVisible();
    await answer(page,`${id}-reason`,single);await answer(page,`${id}-principles`,multiple);
    await page.locator('#reflection').fill('อธิบายจากกราฟเปรียบเทียบและข้อมูลจำลอง โดยไม่สรุปเกินขอบเขตที่วัด');
    if(lab==='redesign')await page.locator('#reflection-2').fill('การตั้งค่าที่ผ่านเกณฑ์ยังต้องมีเหตุผลและการทบทวนร่วมกับครู');
    await page.locator('#complete-task').click();await expect(page.locator('#completion-feedback')).toContainText('ทำกิจกรรมครบแล้ว');
    await page.locator('#completed-review > summary').click();await expect(page.locator('#completed-review svg')).toBeVisible();
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));expect(width.scroll).toBeLessThanOrEqual(width.view+1);
  }
  await page.locator('.preview').screenshot({path:`artifacts/${testInfo.project.name}-${lab}-research.png`});expect(errors).toEqual([]);
});

test('Free research editing pages, missing data, invalid bins and grayscale remain independent',async({page})=>{
  await page.locator('[data-mode="free"]').click();await page.locator('[data-dataset="soil"]').click();
  await expect(page.locator('[data-record]')).toHaveCount(40);
  await page.locator('[data-record="0"][data-field="minutes"]').fill('11');await page.locator('[data-editor-page="1"]').click();
  await page.locator('[data-record="20"][data-field="minutes"]').fill('');await page.locator('[data-editor-page="0"]').click();
  await expect(page.locator('[data-record="0"][data-field="minutes"]')).toHaveValue('11');
  await page.locator('#research-data-form button[type="submit"]').click();await expect(page.locator('#axis-range')).toContainText('ขาดข้อมูลที่จำเป็น 1');
  await page.locator('#histogram-mode').selectOption('edges');await adjust(page,'histogram-edges','0,5,10,25');
  await expect(page.locator('#axis-range')).toContainText('ความสูง = ความถี่ / ความกว้าง');
  await page.locator('#chart [data-bin="0"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#inspection')).toContainText('รายการ');
  await adjust(page,'histogram-edges','0,5,5');await expect(page.locator('#chart')).toContainText('ขอบ bin');
  await adjust(page,'histogram-edges','0,5,10,25');await expect(page.locator('#chart svg')).toBeVisible();
  await page.locator('[data-dataset="environment"]').click();await adjust(page,'color-schemeType','sequential');await page.locator('#grayscale').check();
  await expect(page.locator('#legend')).toContainText('ขาวดำ');await expect(page.locator('[data-question-form]')).toHaveCount(0);
  await page.locator('[data-mode="guided"]').click();await expect(page.locator('#progress')).toHaveAttribute('value','0');
});
test('V1 browser migration and V2 reload preserve old and new completed evidence',async({page})=>{
  await page.evaluate(async()=>{
    const old=await(await fetch('./tests/fixtures/progress-v1.json')).json();
    const {openDatabase,writeDatabase,storageNames}=await import('./src/storage/database.js');const names=storageNames(new URL('./',location.href).pathname),db=await openDatabase(names.database);
    await writeDatabase(db,old,0);db.close();localStorage.setItem(names.preference,'true');
  });await page.reload();await expect(page.locator('#storage-status')).toContainText('กู้คืน');
  await expect(page.locator('#completion-text')).toContainText('พื้นฐาน 4/10 ข้อ · เพิ่มเติม 0/24 ข้อ');
  await page.locator('[data-task="4"]').click();await page.locator('#prediction').fill('เปรียบเทียบกลุ่มโดยไม่ลบค่านอกเกณฑ์');await page.locator('#save-prediction').click();
  await page.locator('#record-experiment').click();await page.locator('#grouped').check();await page.locator('#record-experiment').click();
  await answer(page,'boxplot-groups-reason',['c']);await answer(page,'boxplot-groups-principles',['a','b','d']);
  await page.locator('#reflection').fill('มัธยฐาน IQR และค่านอกเกณฑ์แสดงคนละด้านของการกระจาย');await page.locator('#complete-task').click();
  await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');await page.reload();
  await expect(page.locator('#completed-review')).toContainText('มัธยฐาน IQR');await expect(page.locator('#completion-text')).toContainText('พื้นฐาน 4/10 ข้อ · เพิ่มเติม 2/24 ข้อ');
});
test('expanded PDF exports all chart semantics or scoped evidence entirely on the client',async({page},testInfo)=>{
  test.setTimeout(120000);const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4174/')&&!r.url().startsWith('blob:'))external.push(r.url());});
  await page.evaluate(async()=>{
    const {createState}=await import('./src/state.js');const {labs}=await import('./src/content/labs.js');const {prepareTask}=await import('./tests/helpers/learning.js');
    const {serializeProgress}=await import('./src/storage/schema.js');const {openDatabase,writeDatabase,storageNames}=await import('./src/storage/database.js');
    const state=createState();for(const lab of labs)for(const task of lab.tasks)prepareTask(state,lab.id,task.id);
    const names=storageNames(new URL('./',location.href).pathname),db=await openDatabase(names.database);await writeDatabase(db,serializeProgress(state),0);db.close();localStorage.setItem(names.preference,'true');
  });await page.reload();await expect(page.locator('#progress')).toHaveAttribute('value','34');
  await page.locator('#show-summary').click();await page.locator('#report-scope').selectOption('choose');await page.locator('#preview-report').click();
  await expect(page.locator('#report-preview details')).toHaveCount(5);await page.locator('#generate-pdf').click();
  await expect(page.locator('#pdf-actions')).toBeVisible({timeout:60000});
  const downloaded=page.waitForEvent('download');await page.locator('#download-pdf').click();await(await downloaded).saveAs(`artifacts/${testInfo.project.name}-research-report.pdf`);
  await expect(page.locator('#progress')).toHaveAttribute('value','34');expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('hidden invalid controls do not corrupt saved comparisons and derived values update after applying edits',async({page})=>{
  test.setTimeout(60000);
  await page.locator('[data-task="3"]').click();await page.locator('#prediction').fill('เปรียบเทียบช่วงชั้น');await page.locator('#save-prediction').click();
  await adjust(page,'histogram-count','');await expect(page.locator('#chart')).toContainText('จำนวน bin');
  await adjust(page,'histogram-mode','width');await page.locator('#record-experiment').click();await adjust(page,'histogram-width','3');await page.locator('#record-experiment').click();
  await answer(page,'histogram-distribution-reason',['a']);await answer(page,'histogram-distribution-principles',['b','d']);
  await page.locator('#reflection').fill('ตรวจข้อมูลดิบและวิธีแบ่งช่วงร่วมกัน');await page.locator('#complete-task').click();
  await expect(page.locator('#completion-feedback')).toContainText('ทำกิจกรรมครบแล้ว');await page.locator('#enable-storage').click();await expect(page.locator('#storage-status')).toContainText('บันทึกแล้ว');
  await page.reload();await expect(page.locator('#completed-review')).toContainText('ตรวจข้อมูลดิบ');await expect(page.locator('#accept-recovery')).toHaveCount(0);
  await page.locator('[data-mode="free"]').click();await page.locator('[data-dataset="environment"]').click();
  const derived=page.locator('[data-record="0"][data-field="difference"]');await expect(derived).toHaveAttribute('readonly','');
  await page.locator('[data-record="0"][data-field="temperature"]').fill('35');await page.locator('#research-data-form button[type="submit"]').click();await expect(derived).toHaveValue('5');
  await page.locator('[data-mode="guided"]').click();await expect(page.locator('#progress')).toHaveAttribute('value','2');
});
