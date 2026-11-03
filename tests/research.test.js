import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { computeHistogram, computeBoxSummary, quantile } from '../src/statistics/distribution.js';
import { copyDataset } from '../src/content/datasets.js';
import { initialConfig, dataView, deriveRecords } from '../src/data/view.js';
import { chartSvg, legendHtml } from '../src/charts/render.js';
import { validateChart, validateDataset } from '../src/charts/validation.js';
import { researchAnalysis, semanticColor } from '../src/charts/research.js';
import { labs } from '../src/content/labs.js';
import { questions } from '../src/content/questions.js';
import { createState, resetChart, resetGuided } from '../src/state.js';
import { prepareTask } from './helpers/learning.js';
import { serializeProgress, restoreProgress, assessmentManifest } from '../src/storage/schema.js';
import { writeDatabase, readDatabase, openDatabase } from '../src/storage/database.js';
import { recordExperiment } from '../src/learning/experiments.js';
import { submitAnswer, retryQuestion, completeTask } from '../src/learning/practice.js';
import { evaluateDesign } from '../src/learning/evaluate.js';
import { buildLearningSummary } from '../src/learning/report.js';
import { buildLearningReport } from '../src/report/model.js';
import { buildPdfDefinition, exportChartSvg } from '../src/report/pdf.js';
import { adaptiveFeedback } from '../src/learning/feedback.js';

test('histogram boundaries conserve counts, include final edge, and do not round nearby values into another bin',()=>{
  const result=computeHistogram([0,5-1e-14,5,10,15,20,25,null,NaN],{mode:'edges',edges:[0,5,10,15,20,25]});
  assert.deepEqual(result.bins.map(b=>b.count),[2,1,1,1,2]);assert.equal(result.n,7);assert.equal(result.excluded,2);
  assert.equal(result.bins.at(-1).last,true);
  const source=[4,5,5,6,6,7,7,8,8,9,10,24,3,4,4,4,5,5,5,6,6,6,7,8];
  assert.deepEqual(computeHistogram(source,{mode:'edges',edges:[0,5,10,15,20,25]}).bins.map(b=>b.count),[5,17,1,0,1]);
});
test('unequal bins use frequency density and preserve area, with width/count/constant/singleton safety',()=>{
  const r=computeHistogram([0,1,2,3,4,8],{mode:'edges',edges:[0,2,8]});
  assert.equal(r.density,true);assert.equal(r.unequal,true);assert.deepEqual(r.bins.map(b=>b.height),[1,4/6]);
  assert.equal(r.bins.reduce((sum,b)=>sum+b.height*(b.hi-b.lo),0),6);
  for(const values of [[5],[5,5,5],[-4,-2,0],Array.from({length:200},(_,i)=>i/10)])for(const settings of [{count:4},{mode:'width',width:5}]){
    const h=computeHistogram(values,settings);assert.equal(h.bins.reduce((sum,b)=>sum+b.count,0),values.length);assert.ok(h.bins.every(b=>Number.isFinite(b.height)));
  }
  for(const settings of [{count:0},{count:21},{count:2.1},{mode:'width',width:0},{mode:'edges',edges:[0,0,10]},{mode:'edges',edges:[1,10]},{mode:'edges',edges:[0,Infinity]}])assert.throws(()=>computeHistogram([0,10],settings));
  assert.deepEqual(computeHistogram([null,NaN]).bins,[]);
});
test('R type 7 quartiles, actual whiskers, inclusive fences and outliers are mathematically consistent',()=>{
  const values=[4,5,5,6,6,7,7,8,8,9,10,24], before=[...values];const b=computeBoxSummary(values);
  assert.deepEqual([b.q1,b.median,b.q3,b.iqr],[5.75,7,8.25,2.5]);assert.deepEqual(b.whiskers,[4,10]);assert.deepEqual(b.outliers,[24]);assert.deepEqual(values,before);
  const two=computeBoxSummary([1,2]);assert.deepEqual([two.q1,two.median,two.q3],[1.25,1.5,1.75]);
  assert.deepEqual(computeBoxSummary([7]).whiskers,[7,7]);assert.equal(computeBoxSummary([7,7,7]).iqr,0);
  assert.deepEqual(computeBoxSummary([0,0,0,0,1]).outliers,[1]);assert.equal(computeBoxSummary([]).median,null);
  assert.equal(quantile([2,8,4],.25),3);assert.throws(()=>quantile([1],2));
  assert.deepEqual(computeBoxSummary([0,2,4,6,8,12]).outliers,[]);
});
test('V2 metadata, missing values, compatibility, repeated X and exact overlapping observations',()=>{
  const data=copyDataset('shade'),config=initialConfig(data);
  assert.deepEqual(validateChart(data,config),[]);assert.equal(dataView(data,config).rows.length,12);
  data.records[1].shade=data.records[0].shade;data.records[1].temperature=data.records[0].temperature;
  assert.match(chartSvg(data,config),/ตำแหน่งซ้อนกัน 2 รายการ/);assert.doesNotMatch(chartSvg(data,config),/NaN|Infinity/);
  data.records[2].temperature=null;assert.equal(dataView(data,config).excluded,1);assert.deepEqual(validateDataset(data),[]);
  data.records[2].temperature='invalid';assert.ok(validateDataset(data).length);
  assert.ok(validateChart(copyDataset('soil'),{...initialConfig(copyDataset('soil')),kind:'scatter'}).length);
  assert.ok(validateChart(copyDataset('shade'),{...config,kind:'line'}).some(e=>e.includes('ไม่ซ้ำ')));
  const many=copyDataset('soil');many.records=Array.from({length:201},(_,i)=>({id:String(i),group:'ก',minutes:1}));assert.ok(validateDataset(many).length);
});
test('color is checked by variable semantics, accepts multiple palettes, and includes an external midpoint',()=>{
  const data=copyDataset('environment'),config=initialConfig(data);config.color={schemeType:'categorical',field:'surface',paletteId:'blue',midpoint:0};
  const task=labs.find(l=>l.id==='color').tasks.find(t=>t.id==='categorical-colors');
  for(const paletteId of ['blue','teal','purple']){config.color.paletteId=paletteId;assert.equal(evaluateDesign(task,config).passed,true);assert.match(legendHtml(data,config),/หญ้า/);}
  config.color.field='temperature';assert.ok(validateChart(data,config).length);
  config.color={schemeType:'diverging',field:'temperature',paletteId:'blue',midpoint:0};const a=researchAnalysis(data,config);assert.equal(a.color.domain[0],0);
  assert.notEqual(semanticColor(a,config,28),semanticColor(a,config,34));config.grayscale=true;const gray=semanticColor(a,config,28);assert.equal(gray.slice(1,3),gray.slice(3,5));
});
test('derived reference differences remain consistent after editing or clearing a source value',()=>{
  const data=copyDataset('environment');data.records[0].temperature=35;data.records[1].temperature=null;
  assert.ok(validateDataset(data).some(e=>e.includes('ผลต่าง')));
  data.records=deriveRecords(data);assert.equal(data.records[0].difference,5);assert.equal(data.records[1].difference,null);assert.deepEqual(validateDataset(data),[]);
});
test('every new scenario renders, unlocks, masters, completes, and restores frozen V2 evidence',()=>{
  const state=createState();
  for(const lab of labs)for(const task of lab.tasks){
    const {draft}=prepareTask(state,lab.id,task.id);assert.ok(draft.completion,task.id);
    for(const snapshot of [...draft.experiments,draft.completion]){
      assert.deepEqual(validateChart(snapshot.dataset,snapshot.config),[],task.id);
      const svg=chartSvg(snapshot.dataset,snapshot.config);assert.match(svg,/<svg/);assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
    }
  }
  const restored=restoreProgress(serializeProgress(state));assert.equal(restored.status,'restored',JSON.stringify(restored.issues));
  assert.deepEqual(buildLearningSummary(restored.state),buildLearningSummary(state));
  const draft=state.guided.choose['histogram-distribution'],before=structuredClone(draft.completion);
  draft.config.histogram.count=17;resetChart(labs[0].tasks[3],draft);assert.deepEqual(draft.completion,before);
  assert.equal(draft.completion.config.histogram.count,6);
});
test('changing labels, unused bin parameters or only frequency measure does not satisfy the second bin experiment',()=>{
  const state=createState(),task=labs[0].tasks.find(t=>t.id==='histogram-distribution'),draft=state.guided.choose[task.id];
  draft.predictionSaved=true;draft.prediction='ลองหลายช่วง';assert.equal(recordExperiment(task,draft).accepted,true);
  draft.config.labels=false;draft.config.histogram.width=99;draft.config.histogram.measure='density';assert.equal(recordExperiment(task,draft).accepted,false);
  draft.config.histogram.count=8;assert.equal(recordExperiment(task,draft).accepted,true);
});
test('unused invalid controls cannot corrupt evidence when changing histogram mode or chart type',()=>{
  const state=createState(),task=labs[0].tasks.find(t=>t.id==='histogram-distribution'),draft=state.guided.choose[task.id];
  draft.prediction='ทดลองช่วง';draft.predictionSaved=true;draft.config.histogram.count=NaN;draft.config.histogram.mode='width';draft.config.histogram.width=5;draft.config.color.midpoint=NaN;
  assert.equal(recordExperiment(task,draft).accepted,true);draft.config.histogram.width=3;assert.equal(recordExperiment(task,draft).accepted,true);
  for(const id of task.questionIds){draft.questions[id].selectedOptionIds=[...questions[id].correctOptionIds];submitAnswer(task,draft,id);}
  draft.note='เปรียบเทียบช่วงชั้นโดยรักษาข้อมูลดิบ';assert.equal(completeTask(task,draft).accepted,true);
  let restored=restoreProgress(serializeProgress(state));assert.equal(restored.status,'restored');assert.ok(restored.state.guided.choose[task.id].completion);assert.ok(Number.isNaN(restored.state.guided.choose[task.id].config.histogram.count));
  assert.equal(restored.state.guided.choose[task.id].experiments[0].config.histogram.count,6);
  draft.config.histogram.width=1e9;assert.ok(validateChart(copyDataset('soil'),draft.config).length);
});
test('new questions retain unlimited retries, progressive hints, counts and monotone mastery',()=>{
  const state=createState(),{task,draft}=prepareTask(state,'choose','scatter-relationship',{complete:false});const id=task.questionIds[1],p=draft.questions[id];
  const start=p.history.length;
  for(let i=0;i<3;i++){retryQuestion(p);p.selectedOptionIds=['b'];submitAnswer(task,draft,id);const hint=adaptiveFeedback(questions[id],p);assert.equal(hint.level,i+1);for(const o of questions[id].options)assert.ok(!hint.messages.includes(o.explanation));}
  assert.equal(p.history.length,start+3);assert.equal(p.masteryStatus,'mastered');
});
test('time windows disclose full and selected contexts; dual axes, indexing and 3D carry explicit semantics',()=>{
  const data=copyDataset('researchTime'),c=initialConfig(data);c.windowMode='recent';const a=researchAnalysis(data,c);
  assert.deepEqual(a.timeContext.fullRange,[1,24]);assert.deepEqual(a.timeContext.selectedRange,[22,24]);assert.equal(a.timeContext.selectedFirst,31.2);assert.equal(a.timeContext.fullFirst,28);
  const dual=copyDataset('dualResearch'),dc=initialConfig(dual);dc.presentation='indexed';assert.equal(researchAnalysis(dual,dc).base.y,26);
  dual.records[0].temperature=0;assert.ok(validateChart(dual,dc).length);dc.presentation='dual';dc.axes={rightMin:60,rightMax:65};assert.ok(validateChart(dual,dc).length);
  const env=copyDataset('environment'),ec=initialConfig(env);ec.presentation='3d';assert.equal(researchAnalysis(env,ec).illustrative,true);assert.match(chartSvg(env,ec),/ภาพประกอบจำลอง/);
});
test('real V1 golden migrates to V2 without losing old fingerprints, attempts or completed evidence',async()=>{
  const original=JSON.parse(readFileSync(new URL('./fixtures/progress-v1.json',import.meta.url),'utf8'));
  const before=JSON.stringify(original),manifest=assessmentManifest();for(const [key,value]of Object.entries(original.assessmentManifest))assert.deepEqual(manifest[key],value);
  const result=restoreProgress(original);assert.equal(result.status,'restored');assert.equal(result.migrated,true);
  assert.ok(result.state.guided.choose.compare.completion);assert.ok(result.state.guided.color.focus.completion);
  assert.equal(result.state.guided.choose.compare.questions['compare-reason'].history.length,1);
  const summary=buildLearningSummary(result.state);assert.equal(summary.sections[0].masteredQuestionCount,4);assert.equal(summary.sections[1].masteredQuestionCount,0);
  assert.equal(JSON.stringify(original),before);
  const db=await openDatabase('v1-upgrade',new IDBFactory());
  await writeDatabase(db,original,0);const old=restoreProgress(await readDatabase(db));await writeDatabase(db,serializeProgress(old.state),1);
  const next=await readDatabase(db);assert.equal(next.storageSchemaVersion,2);assert.equal(restoreProgress(next).status,'restored');assert.equal(next.tasks['choose/compare'].questions['compare-reason'].history.length,1);db.close();
});
test('V2 corrupted fields and changed criteria quarantine only the affected task',()=>{
  const state=createState();prepareTask(state,'choose','boxplot-groups');prepareTask(state);
  const raw=serializeProgress(state);raw.tasks['choose/boxplot-groups'].config.color.midpoint='bad';let r=restoreProgress(raw);assert.equal(r.issues.length,1);assert.ok(r.state.guided.choose.compare.completion);
  const changed=serializeProgress(state);changed.assessmentManifest['choose/boxplot-groups'].fingerprint='future-method';r=restoreProgress(changed);assert.equal(r.issues.length,1);assert.equal(r.issues[0].reason,'content');
  resetGuided(state);assert.equal(state.guided.choose['boxplot-groups'].experiments.length,0);
});
test('report V2 contains distributions and context, scoped evidence, all questions and standalone SVG',()=>{
  const state=createState();prepareTask(state,'choose','boxplot-groups');prepareTask(state,'misleading','time-window');
  const report=buildLearningReport(state,{labIds:['choose']});assert.equal(report.reportSchemaVersion,2);assert.ok(report.evidence.every(t=>t.labId==='choose'));
  const box=report.evidence.find(e=>e.taskId==='boxplot-groups');assert.equal(box.finalChart.analysis.groups[0].median,7);assert.equal(box.experiments[1].analysis.groups[0].iqr,2.5);
  const definition=buildPdfDefinition(report),json=JSON.stringify(definition);assert.match(json,/R type 7/);assert.doesNotMatch(json,/correctOptionIds|selectedOptionIds/);
  const svg=exportChartSvg(box.finalChart,'box-export');assert.match(svg,/xmlns=/);assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
});
