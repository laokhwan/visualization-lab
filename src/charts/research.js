import { dataView } from '../data/view.js';
import { computeHistogram, computeBoxSummary, calculationVersion } from '../statistics/distribution.js';
import { escapeHtml as esc } from '../ui/html.js';
import { formatNumber as n } from './scales.js';

const palettes = { blue:['#e5edf8','#245d91'],teal:['#e0f2ed','#08725d'],purple:['#eee5f7','#70429c'] };
const categoryColors = ['#0072b2','#d55e00','#009e73','#7d4a91','#6a5610','#263d66'];
const mix = (a,b,t) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const range = values => { const lo=Math.min(...values),hi=Math.max(...values); return lo===hi ? [lo-.5,hi+.5] : [lo,hi]; };
const scale = (domain,lo,hi) => value => lo+(value-domain[0])/(domain[1]-domain[0])*(hi-lo);
const text = (x,y,value,anchor='start',size=14,fill='#24354a') => `<text x="${x}" y="${y}" text-anchor="${anchor}" pointer-events="none" font-family="Sarabun" font-size="${size}" fill="${fill}">${esc(value)}</text>`;
const line = (x1,y1,x2,y2,stroke='#526175',extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" ${extra}/>`;
const fieldName = (data,id) => { const f=data.fields.find(item=>item.id===id); return f ? `${f.label}${f.unit ? ` (${f.unit})` : ''}` : ''; };

export function researchAnalysis(data,config) {
  const view=dataView(data,config), values=view.rows.map(r=>r.value);
  const histogram=config.kind==='histogram' ? computeHistogram(values,config.histogram) : null;
  const groups=config.kind==='box' ? [...new Set(view.rows.map(r=>config.grouped?r.group:'รวมข้อมูล'))].map(label=>({label,...computeBoxSummary(view.rows.filter(r=>!config.grouped||r.group===label).map(r=>r.value))})) : [];
  const time=data.fields.find(f=>f.id===view.encoding.x)?.type==='time';
  const fullXs=data.records.map(r=>r[view.encoding.x]).filter(Number.isFinite);
  const fullYs=data.records.map(r=>r[view.encoding.y]).filter(Number.isFinite);
  const color=config.color;
  const colorValues=view.rows.map(r=>r.record[color.field]).filter(Number.isFinite);
  const categories=[...new Set(view.rows.map(r=>r.record[color.field]).filter(v=>typeof v==='string'))];
  const colorDomain=colorValues.length?range(colorValues):[0,1];
  if(color.schemeType==='diverging') { colorDomain[0]=Math.min(colorDomain[0],color.midpoint);colorDomain[1]=Math.max(colorDomain[1],color.midpoint); }
  return { calculationVersion,n:view.rows.length,total:view.total,excluded:view.excluded,unit:view.unit,variables:{x:fieldName(data,view.encoding.x),y:fieldName(data,view.encoding.y),secondY:fieldName(data,view.encoding.secondY)},histogram,groups,color:{...color,domain:colorDomain,categories},timeContext:time?{fullRange:[Math.min(...fullXs),Math.max(...fullXs)],selectedRange:view.rows.length?[view.rows[0].x,view.rows.at(-1).x]:[],fullValueRange:[Math.min(...fullYs),Math.max(...fullYs)],fullFirst:fullYs[0],fullLast:fullYs.at(-1),selectedFirst:values[0],selectedLast:values.at(-1),shown:view.rows.length}:null,illustrative:config.presentation==='3d',presentation:config.presentation,base:config.presentation==='indexed'?{x:view.rows[0]?.x,y:values[0],secondY:view.rows[0]?.secondValue,formula:'ค่า / ค่าแรก × 100'}:null };
}
export function semanticColor(analysis,config,value) {
  const c=analysis.color;
  if(config.grayscale) {
    const original=semanticColor(analysis,{...config,grayscale:false},value);
    const luma=Math.round([.2126,.7152,.0722].reduce((sum,weight,i)=>sum+weight*parseInt(original.slice(1+i*2,3+i*2),16),0)).toString(16).padStart(2,'0');
    return `#${luma}${luma}${luma}`;
  }
  if(c.schemeType==='uniform') return config.grayscale?'#555555':palettes[c.paletteId][1];
  if(c.schemeType==='categorical') return categoryColors[(Math.max(0,c.categories.indexOf(value))+(c.paletteId==='teal'?2:c.paletteId==='purple'?3:0))%categoryColors.length];
  if(!Number.isFinite(value)) return '#777777';
  const [lo,hi]=c.domain;
  const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));
  if(c.schemeType==='sequential') return mix(...palettes[c.paletteId],t);
  const mid=c.midpoint;
  const ends={blue:['#2166ac','#b35806'],teal:['#8e4585','#08725d'],purple:['#0072b2','#88419d']}[c.paletteId];
  return value<=mid ? mix(ends[0],'#f7f7f7',mid===lo?1:(value-lo)/(mid-lo)) : mix('#f7f7f7',ends[1],hi===mid?0:(value-mid)/(hi-mid));
}
export function analysisLines(data,config,analysis=researchAnalysis(data,config)) {
  const a=analysis;
  return [ `ข้อมูลจำลอง · ใช้ ${a.n}/${a.total} รายการ · ขาดข้อมูลที่จำเป็น ${a.excluded} รายการ`,
    ...(config.kind==='bar'&&data.fields.find(f=>f.id===config.encoding.x)?.type!=='nominal'?['กราฟแท่งแยกหน่วยสังเกตเป็นรายการ ระยะห่างของแท่งไม่ได้แทนระยะของค่า X']:[]),
    ...(a.histogram ? [`ช่วงชั้น [ซ้าย, ขวา) ยกเว้นช่วงสุดท้ายรวมขวา · ${a.histogram.density?'ความสูง = ความถี่ / ความกว้าง; พื้นที่ = จำนวน':'ความสูง = จำนวนข้อมูล'}`] : []),
    ...a.groups.map(g=>`${g.label}: n=${g.n} · Q1=${n(g.q1)} · มัธยฐาน=${n(g.median)} · Q3=${n(g.q3)} · IQR=${n(g.iqr)} · หนวด ${g.whiskers.map(n).join('–')} · ค่านอกเกณฑ์ ${g.outliers.map(n).join(', ')||'ไม่มี'}`),
    ...(a.groups.length?['ควอร์ไทล์ R type 7 · หนวดเป็นค่าจริงในขอบเขต 1.5 IQR · ไม่ลบค่านอกเกณฑ์อัตโนมัติ']:[]),
    ...(a.timeContext?[`ช่วงเต็ม ${a.timeContext.fullRange.map(n).join('–')} · แสดง ${a.timeContext.selectedRange.map(n).join('–')} (${a.timeContext.shown} รายการ) · ค่าเต็มช่วง ${n(a.timeContext.fullFirst)} → ${n(a.timeContext.fullLast)} · ช่วงที่แสดง ${n(a.timeContext.selectedFirst)} → ${n(a.timeContext.selectedLast)} ${a.unit}`]:[]),
    ...(a.illustrative?['ภาพประกอบจำลอง 3 มิติ — ความลึกไม่ได้แทนค่าที่วัด']:[]),
    ...(a.base?[`ดัชนีฐาน 100 · วันฐาน ${n(a.base.x)} · ${a.base.formula} · ค่าฐาน ${n(a.base.y)} / ${n(a.base.secondY)} ตามหน่วยเดิม`]:[]),
    ...(a.presentation==='dual'?['สองแกนใช้สเกลแยกกัน จุดตัดขึ้นกับสเกล ไม่ได้แปลว่าค่าเท่ากันหรือเป็นเหตุและผล']:[]),
    ...(!['box','histogram'].includes(config.kind)&&!['dual','small-multiples','indexed'].includes(config.presentation)&&a.color.schemeType!=='uniform'?[`สี: ${a.color.schemeType} · ${fieldName(data,a.color.field)}${a.color.schemeType==='categorical'?` · ${a.color.categories.join(', ')}`:` · ช่วง ${a.color.domain.map(n).join('–')}`}${a.color.schemeType==='diverging'?` · จุดอ้างอิง ${n(a.color.midpoint)}`:''}`]:[]),
    ...(['histogram','box'].includes(config.kind)?['กราฟสรุปการกระจายใช้สีเดียว; การระบุกลุ่มใช้ป้ายชื่อ']:[]),
  ];
}
export function researchLegend(data,config) {
  const a=researchAnalysis(data,config),c=a.color;
  if(['dual','small-multiples','indexed'].includes(config.presentation)) return `<li><span class="swatch" style="border-radius:50%;background:${config.grayscale?'#333333':'#0f766e'}"></span>${esc(a.variables.y)} (เส้นทึบ)</li><li><span class="swatch" style="background:${config.grayscale?'#555555':'#70429c'}"></span>${esc(a.variables.secondY)} (เส้นประ)</li>`;
  if(['histogram','box'].includes(config.kind)||c.schemeType==='uniform') return '<li>สีเดียว · อ่านค่าจากตำแหน่งและป้ายกำกับ</li>';
  if(c.schemeType==='categorical') return c.categories.map(value=>`<li><span style="background:${semanticColor(a,config,value)}" class="swatch"></span>${esc(value)}</li>`).join('');
  return `<li><span class="swatch" style="background:${semanticColor(a,config,c.domain[0])}"></span>${n(c.domain[0])}</li>${c.schemeType==='diverging'?`<li><span class="swatch" style="background:${semanticColor(a,config,c.midpoint)}"></span>จุดอ้างอิง ${n(c.midpoint)}</li>`:''}<li><span class="swatch" style="background:${semanticColor(a,config,c.domain[1])}"></span>${n(c.domain[1])} · ${esc(fieldName(data,c.field))} · ${config.grayscale?'โหมดขาวดำ':'สีเรียงตามค่า'}</li>`;
}
export function researchSvg(data,config,prefix) {
  const view=dataView(data,config),a=researchAnalysis(data,config),rows=view.rows;
  const multi=config.presentation==='small-multiples',H=multi?500:400;
  let svg=`<svg data-research="true" viewBox="0 0 640 ${H}" role="group" aria-labelledby="${prefix}-title ${prefix}-desc"><title id="${prefix}-title">${esc(data.title)}</title><desc id="${prefix}-desc">${esc(analysisLines(data,config,a).join('; '))}</desc>`;
  const left=76,right=552,top=44,bottom=multi?225:302;
  let yd=range(rows.map(r=>r.value));
  if(['bar','line','dot'].includes(config.kind)) yd=[config.baseline,config.upper??Math.max(...rows.map(r=>r.value),config.baseline+1)];
  if(config.kind==='bar') yd=[Math.min(0,...yd),Math.max(0,...yd)];
  if(a.histogram) yd=[0,Math.max(1,...a.histogram.bins.map(b=>b.height))];
  if(config.presentation==='indexed') yd=range(rows.flatMap(r=>[r.value/rows[0].value*100,r.secondValue/rows[0].secondValue*100]));
  const y=scale(yd,bottom,top);
  function axes(domain,unit,y0,y1) {
    const sy=scale(domain,y0,y1);let html=text(left,y1-18,unit);
    for(let i=0;i<=4;i++){const v=domain[0]+(domain[1]-domain[0])*i/4, yy=sy(v);html+=line(left,yy,right,yy,'#dce4ed')+text(left-8,yy+4,n(v),'end');}
    return html+line(left,y1,left,y0)+line(left,y0,right,y0);
  }
  svg+=axes(yd,a.histogram?(a.histogram.density?`ความถี่ / ${view.unit}`:'จำนวนข้อมูล'):config.presentation==='indexed'?'ดัชนี (ฐาน 100)':a.variables.y,bottom,top);
  if(config.kind==='bar'&&yd[0]<0&&yd[1]>0)svg+=line(left,y(0),right,y(0),'#526175','stroke-width="2"');
  const mark=(html,index,label)=>`<g tabindex="0" role="button" data-point="${index}" aria-label="${esc(label)}">${html}<title>${esc(label)}</title></g>`;
  if(a.histogram) {
    const x=scale([a.histogram.edges[0],a.histogram.edges.at(-1)],left,right);
    a.histogram.bins.forEach((b,i)=>{const cx=(x(b.lo)+x(b.hi))/2,label=`[${n(b.lo)}, ${n(b.hi)}${b.last?']':')'}: ${b.count} รายการ · ความสูง ${n(b.height)}`;
      svg+=`<g tabindex="0" role="button" data-bin="${i}" aria-label="${esc(label)}"><rect x="${x(b.lo)}" y="${y(b.height)}" width="${x(b.hi)-x(b.lo)}" height="${bottom-y(b.height)}" fill="${config.grayscale?'#666666':'#0f766e'}" stroke="#ffffff"/><rect x="${Math.max(left,cx-22)}" y="${Math.min(y(b.height),bottom-44)}" width="${Math.min(44,right-Math.max(left,cx-22))}" height="44" fill="transparent"/><title>${esc(label)}</title></g>`;
      if(config.labels)svg+=text(cx,Math.max(top-4,y(b.height)-5),String(b.count),'middle');
    });
    // Label interval boundaries at a readable cadence; every boundary is in the table.
    a.histogram.edges.forEach((v,i)=>{if(i%Math.ceil(a.histogram.edges.length/8)===0||i===a.histogram.edges.length-1)svg+=text(x(v),bottom+20,n(v),'middle');});
    svg+=text((left+right)/2,bottom+45,a.variables.y,'middle');
  } else if(a.groups.length) {
    a.groups.forEach((g,i)=>{const cx=left+(i+.5)*(right-left)/a.groups.length,w=Math.min(100,(right-left)/a.groups.length*.5);
      // Reuse the chart's domain so marks and ticks always agree.
      const sy=y;
      svg+=`<g tabindex="0" role="button" data-box="${i}" aria-label="${esc(`${g.label} มัธยฐาน ${n(g.median)} IQR ${n(g.iqr)}`)}">`+line(cx,sy(g.whiskers[0]),cx,sy(g.whiskers[1]))+line(cx-12,sy(g.whiskers[0]),cx+12,sy(g.whiskers[0]))+line(cx-12,sy(g.whiskers[1]),cx+12,sy(g.whiskers[1]))+`<rect x="${cx-w/2}" y="${sy(g.q3)}" width="${w}" height="${Math.max(1,sy(g.q1)-sy(g.q3))}" fill="${config.grayscale?'#dddddd':'#d4e9e5'}" stroke="${config.grayscale?'#555555':'#0f766e'}"/>`+line(cx-w/2,sy(g.median),cx+w/2,sy(g.median),'#17324d','stroke-width="3"')+`<rect x="${cx-22}" y="${Math.max(top,sy(g.median)-22)}" width="44" height="44" fill="transparent"/>`;
      g.outliers.forEach(v=>svg+=`<circle cx="${cx}" cy="${sy(v)}" r="5" fill="${config.grayscale?'#555555':'#a83e1d'}"/>`);svg+='</g>'+text(cx,bottom+20,`${g.label} (n=${g.n})`,'middle');
    });svg+=text((left+right)/2,bottom+45,'กลุ่มข้อมูล','middle');
  } else {
    const numeric=['scatter','line','dot'].includes(config.kind)&&view.xType!=='category';
    const xd=numeric?range(rows.map(r=>r.x)):[0,rows.length];
    const sx=scale(xd,left,right),xp=(r,i)=>numeric?sx(r.x):left+(i+.5)*(right-left)/rows.length;
    const primaryColor=config.grayscale?'#333333':'#0f766e';
    const fill=r=>['dual','small-multiples','indexed'].includes(config.presentation)?primaryColor:semanticColor(a,config,r.record[config.color.field]);
    let path=''; const seen=new Map();
    rows.forEach((r,i)=>{const key=`${r.x}:${r.value}`;if(numeric&&config.kind==='scatter'&&seen.has(key)){seen.get(key).push(i);}else seen.set(numeric&&config.kind==='scatter'?key:String(i),[i]);});
    for(const indexes of seen.values()) {
      const i=indexes[0],r=rows[i],x=xp(r,i),value=config.presentation==='indexed'?r.value/rows[0].value*100:r.value,yy=y(value);
      const label=`${r.label}: ${a.variables.x} ${r.x}; ${a.variables.y} ${n(r.value)}${indexes.length>1?` · ตำแหน่งซ้อนกัน ${indexes.length} รายการ`:''}${config.color.schemeType==='categorical'?` · ${r.record[config.color.field]}`:''}`;
      if(config.kind==='bar') {
        const w=Math.max(1,Math.min(48,(right-left)/rows.length*.7)),zero=y(Math.max(yd[0],Math.min(yd[1],0))),h=Math.abs(zero-yy),t=Math.min(zero,yy);
        let shapes=`<rect x="${x-w/2}" y="${t}" width="${w}" height="${h}" fill="${fill(r)}" stroke="#526175"/>`;
        if(config.presentation==='3d')shapes+=`<path d="M${x-w/2},${t} l12,-10 h${w} l-12,10 Z M${x+w/2},${t} l12,-10 v${h} l-12,10 Z" fill="${config.grayscale?'#bbbbbb':'#a8c7c2'}" stroke="#526175"/>`;
        svg+=mark(shapes+`<rect x="${x-22}" y="${Math.max(top,Math.min(t,bottom-44))}" width="44" height="44" fill="transparent"/>`,i,label);
      }else { path+=`${i?'L':'M'}${x},${yy} `;svg+=mark(`<circle cx="${x}" cy="${yy}" r="6" fill="${fill(r)}" stroke="#17324d"/><circle cx="${x}" cy="${yy}" r="22" fill="transparent"/>`,i,label);if(indexes.length>1)svg+=text(x+10,yy+16,`n=${indexes.length}`,'start',12); }
      if(config.labels&&rows.length<=24)svg+=text(x,Math.max(top-4,yy-5),n(value),'middle',11);
      if(!numeric&&(i%Math.ceil(rows.length/8)===0||i===rows.length-1))svg+=text(x,bottom+20,view.xType==='category'?r.label:n(r.x),'middle',11);
    }
    if(config.kind==='line')svg+=`<path d="${path}" fill="none" stroke="${primaryColor}" stroke-width="2" pointer-events="none"/>`;
    if(numeric){const ticks=view.xType==='time'?[...new Set(Array.from({length:5},(_,i)=>rows[Math.round((rows.length-1)*i/4)].x))]:Array.from({length:5},(_,i)=>xd[0]+(xd[1]-xd[0])*i/4);for(const v of ticks)svg+=text(sx(v),bottom+20,n(v),'middle');}
    if(['dual','small-multiples','indexed'].includes(config.presentation)) {
      const sd=config.presentation==='dual'?[config.axes.rightMin,config.axes.rightMax]:config.presentation==='indexed'?yd:range(rows.map(r=>r.secondValue));
      const y0=multi?432:bottom,y1=multi?290:top,sy=scale(sd,y0,y1);
      if(multi)svg+=axes(sd,a.variables.secondY,y0,y1);
      else if(config.presentation==='dual'){for(let i=0;i<=4;i++){const v=sd[0]+(sd[1]-sd[0])*i/4;svg+=text(right+10,sy(v)+4,n(v));}svg+=text(right+10,top-18,data.fields.find(f=>f.id===view.encoding.secondY).unit);}
      let p='';rows.forEach((r,i)=>{const x=xp(r,i),v=config.presentation==='indexed'?r.secondValue/rows[0].secondValue*100:r.secondValue,yy=sy(v);p+=`${i?'L':'M'}${x},${yy} `;svg+=mark(`<rect x="${x-4}" y="${yy-4}" width="8" height="8" fill="${config.grayscale?'#555555':'#70429c'}"/><circle cx="${x}" cy="${yy}" r="22" fill="transparent"/>`,i,`${a.variables.secondY}: ${n(r.secondValue)}`);});
      svg+=`<path d="${p}" fill="none" stroke="${config.grayscale?'#555555':'#70429c'}" stroke-dasharray="7 4" stroke-width="2" pointer-events="none"/>`;
      const legendY=multi?475:373;
      svg+=`<circle cx="${left+4}" cy="${legendY-4}" r="4" fill="${primaryColor}"/>`+text(left+15,legendY,a.variables.y,'start',11)+`<rect x="335" y="${legendY-8}" width="8" height="8" fill="${config.grayscale?'#555555':'#70429c'}"/>`+text(350,legendY,a.variables.secondY,'start',11);
    }
    svg+=text((left+right)/2,bottom+43,a.variables.x,'middle');
  }
  if(!['histogram','box'].includes(config.kind)&&!['dual','small-multiples','indexed'].includes(config.presentation)&&a.color.schemeType!=='uniform') {
    const entries=a.color.schemeType==='categorical'?a.color.categories.slice(0,6):[a.color.domain[0],...(a.color.schemeType==='diverging'?[a.color.midpoint]:[]),a.color.domain[1]];
    entries.forEach((value,i)=>{const x=left+i*(right-left)/entries.length;svg+=`<rect x="${x}" y="364" width="12" height="12" fill="${semanticColor(a,config,value)}" stroke="#526175"/>`+text(x+17,375,typeof value==='number'?n(value):value,'start',11);});
  }
  svg+=text(left,H-8,a.illustrative?'ภาพประกอบจำลอง 3 มิติ · ความลึกไม่ใช่ตัวแปรที่วัด':`ข้อมูลจำลอง · n=${a.n} · ขาดข้อมูล ${a.excluded}`, 'start',11);
  return svg+'</svg>';
}
