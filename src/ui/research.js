import { escapeHtml as esc, options } from './html.js';
import { getPath } from '../data/config.js';
import { researchAnalysis, analysisLines } from '../charts/research.js';
import { formatNumber as n } from '../charts/scales.js';
import { deriveRecords } from '../data/view.js';

const kinds=[['bar','กราฟแท่ง (Bar)'],['dot','กราฟจุด (Dot)'],['line','กราฟเส้น (Line)'],['scatter','กราฟกระจาย (Scatter)'],['histogram','ฮิสโทแกรม (Histogram)'],['box','แผนภาพกล่อง (Box Plot)']];
function select(config,path,label,items) {const id=path.replaceAll('.','-');return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-config="${path}">${options(items,getPath(config,path))}</select></div>`;}
function number(config,path,label,min='',max='') {const id=path.replaceAll('.','-');return `<div class="field"><label for="${id}">${label}</label><input id="${id}" data-config="${path}" data-value-type="number" type="number" step="any" inputmode="decimal" min="${min}" max="${max}" value="${getPath(config,path)??''}"></div>`;}
function check(config,path,label){return `<label class="check"><input id="${path}" data-config="${path}" type="checkbox"${getPath(config,path)?' checked':''}> ${label}</label>`;}
export function researchControls(data,config,free = false) {
  const fields=type=>data.fields.filter(f=>!type||f.type===type).map(f=>[f.id,`${f.label}${f.unit?` (${f.unit})`:''}`]);
  let html='<h3>ปรับกราฟ</h3>'+select(config,'kind','ชนิดกราฟ',kinds)+(free?select(config,'encoding.y','ตัวแปรที่ศึกษา',fields('quantitative')):'');
  if(free&&['scatter','line','dot','bar'].includes(config.kind))html+=select(config,'encoding.x','ตัวแปรแกนนอน',fields());
  if(config.kind==='histogram') {
    html+=select(config,'histogram.mode','การแบ่งช่วงชั้น',[['count','จำนวนช่วง'],['width','ความกว้างช่วง'],['edges','ขอบช่วงกำหนดเอง']]);
    if(config.histogram.mode==='count')html+=number(config,'histogram.count','จำนวนช่วงชั้น',1,20);
    if(config.histogram.mode==='width')html+=number(config,'histogram.width','ความกว้างช่วงชั้น',0);
    if(config.histogram.mode==='edges')html+=`<div class="field"><label for="histogram-edges">ขอบช่วง คั่นด้วยจุลภาค (2–21 ค่า)</label><input id="histogram-edges" data-config="histogram.edges" data-value-type="numbers" value="${esc(config.histogram.edges.join(', '))}" inputmode="text"></div>`;
    html+=select(config,'histogram.measure','ความสูงของแท่ง',[['count','จำนวนข้อมูล (ช่วงเท่ากัน)'],['density','ความหนาแน่นความถี่']])+'<p class="help">ช่วงไม่เท่ากันใช้ความหนาแน่นอัตโนมัติ เพื่อให้พื้นที่แทนจำนวนข้อมูล</p>';
  }
  if(config.kind==='box')html+=check(config,'grouped','แยกกลุ่ม')+(free?select(config,'encoding.group','ตัวแปรกลุ่ม',fields('nominal')):'');
  if(config.kind==='bar')html+=select(config,'presentation','มุมมอง',[['2d','2 มิติ'],['3d','ภาพประกอบจำลอง 3 มิติ']]);
  else if(config.kind==='line'&&data.encoding.secondY)html+=select(config,'presentation','การเปรียบเทียบสองตัวแปร',[['2d','ตัวแปรเดียว'],['dual','สองแกนตั้ง'],['small-multiples','กราฟแยกช่อง'],['indexed','ดัชนีฐาน 100']])+(free?select(config,'encoding.secondY','ตัวแปรที่สอง',fields('quantitative')):'');
  if(config.presentation==='dual')html+=number(config,'axes.rightMin','แกนขวา: จุดเริ่ม')+number(config,'axes.rightMax','แกนขวา: จุดสิ้นสุด');
  if(['bar','line','dot'].includes(config.kind))html+=number(config,'baseline','แกนตั้ง: จุดเริ่ม')+number(config,'upper','แกนตั้ง: จุดสิ้นสุด (ว่าง = อัตโนมัติ)');
  if(data.fields.find(f=>f.id===config.encoding.x)?.type==='time'){
    html+=select(config,'windowMode','ช่วงเวลา',[['full','เต็มช่วง'],['recent','3 วันสุดท้าย'],['custom','กำหนดช่วงเอง']]);
    if(config.windowMode==='custom')html+=number(config,'timeWindow.start','วันเริ่ม')+number(config,'timeWindow.end','วันสิ้นสุด');
  }
  if(!['box','histogram'].includes(config.kind)&&!['dual','small-multiples','indexed'].includes(config.presentation)) {
    html+=select(config,'color.schemeType','รูปแบบสี',[['uniform','สีเดียว'],['categorical','แยกหมวดหมู่ (Categorical)'],['sequential','เรียงลำดับ (Sequential)'],['diverging','สองฝั่งจุดอ้างอิง (Diverging)']]);
    if(config.color.schemeType!=='uniform')html+=select(config,'color.field','ตัวแปรสี',fields(config.color.schemeType==='categorical'?'nominal':'quantitative'));
    html+=select(config,'color.paletteId','ชุดสี',[['blue','น้ำเงิน'],['teal','เขียว'],['purple','ม่วง']]);
    if(config.color.schemeType==='diverging')html+=number(config,'color.midpoint','จุดอ้างอิงสี');
  }
  return html+check(config,'labels','แสดงค่าบนกราฟ')+check(config,'grayscale','ตรวจการอ่านแบบขาวดำ')+'<p class="help">ป้ายชื่อและตารางข้อมูลช่วยให้อ่านได้โดยไม่พึ่งสีเพียงอย่างเดียว</p>';
}
export function researchTable(data,config) {
  let html=`<p class="help">${esc(data.provenance.description)} · ${esc(data.provenance.limitation)}</p><p>ตัวแปร: ${data.fields.map(f=>`${esc(f.label)} (${esc(f.type)}${f.unit?`, ${esc(f.unit)}`:''})`).join(' · ')}</p>`;
  try {
    const a=researchAnalysis(data,config);
    html+=analysisLines(data,config,a).map(s=>`<p class="help">${esc(s)}</p>`).join('');
    if(a.histogram)html+=`<table><caption>สถิติช่วงชั้น</caption><thead><tr><th>ช่วง (${esc(a.unit)})</th><th>จำนวน</th><th>ความสูง${a.histogram.density?' (ความถี่ / หน่วย)':''}</th></tr></thead><tbody>${a.histogram.bins.map(b=>`<tr><th>[${n(b.lo)}, ${n(b.hi)}${b.last?']':')'}</th><td>${b.count}</td><td>${n(b.height)}</td></tr>`).join('')}</tbody></table>`;
  }catch {html+='<p>กรุณาปรับการตั้งค่าให้ถูกต้องเพื่อดูสถิติ</p>';}
  return html+`<table><caption>${esc(data.title)} · ข้อมูลดิบจำลอง ${data.records.length} รายการ</caption><thead><tr><th scope="col">ลำดับ</th>${data.fields.map(f=>`<th scope="col">${esc(f.label)}${f.unit?` (${esc(f.unit)})`:''}</th>`).join('')}</tr></thead><tbody>${data.records.map((r,i)=>`<tr><th scope="row">${i+1}</th>${data.fields.map(f=>`<td>${r[f.id]===null||r[f.id]===undefined?'ขาดข้อมูล':esc(r[f.id])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
// The independent Free editor keeps unsaved pages in memory only.
export function researchEditor(data,page=0) {
  const pages=Math.ceil(data.records.length/20);
  return `<details id="data-editor" open><summary>แก้ไขข้อมูลจำลอง (ไม่บันทึกความคืบหน้า)</summary><form id="research-data-form" novalidate><p class="help">ใช้ข้อมูลจำลองเท่านั้น ช่องว่างหมายถึงข้อมูลขาด · สูงสุด 200 รายการ · หน้าละ 20 รายการ · ปิดหน้าหรือโหลดใหม่แล้วข้อมูลหาย</p><div class="table-scroll"><table><caption>หน้า ${page+1}/${pages}</caption><thead><tr><th>ลำดับ</th>${data.fields.map(f=>`<th>${esc(f.label)} (${esc(f.unit||f.type)})</th>`).join('')}</tr></thead><tbody>${data.records.slice(page*20,page*20+20).map((r,i)=>`<tr><th>${page*20+i+1}</th>${data.fields.map(f=>`<td><input data-record="${page*20+i}" data-field="${f.id}" aria-label="${esc(f.label)} แถว ${page*20+i+1}" ${f.derived?'readonly aria-readonly="true" title="คำนวณจากอุณหภูมิลบ 30°C"':''} ${f.type==='nominal'?'maxlength="60"':'type="number" step="any" inputmode="decimal"'} value="${esc(r[f.id]??'')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="button-row"><button type="button" class="secondary" data-editor-page="${page-1}"${page?'':' disabled'}>หน้าก่อน</button><button type="button" class="secondary" data-editor-page="${page+1}"${page+1>=pages?' disabled':''}>หน้าถัดไป</button><button type="submit" class="primary">นำข้อมูลไปใช้</button></div><p id="data-errors" role="status"></p></form></details>`;
}
export function readResearchPage(root,data){
  root.querySelectorAll('[data-record]').forEach(input=>{const f=data.fields.find(f=>f.id===input.dataset.field),value=input.value.trim();data.records[Number(input.dataset.record)][f.id]=!value?null:f.type==='nominal'?value:Number(value);});
  data.records=deriveRecords(data);
}
