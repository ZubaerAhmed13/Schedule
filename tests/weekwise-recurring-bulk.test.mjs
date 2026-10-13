import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-data.js';
import '../js/weekwise-recurring-bulk.js';
const bulk=globalThis.WeekwiseRecurringBulk,week='2026-10-11';
const base=(id,occurrenceDate,extra={})=>({id,seriesId:'s1',occurrenceDate,title:'Original',note:'Old note',type:'other',listId:'other',folderName:'Other',sectionName:'',priority:'none',importance:'unclassified',urgency:'unclassified',estimatedDurationMinutes:null,focusEstimateMinutes:null,requiresCompletion:true,tags:[],attachments:[],day:1,start:600,duration:45,reminderTimes:[occurrenceDate+'T09:00'],done:false,status:'todo',...extra});
const rule={id:'s1',startDate:'2026-10-12',frequency:'daily',title:'Original',note:'Old note',type:'other',listId:'other',folderName:'Other',sectionName:'',priority:'none',importance:'unclassified',urgency:'unclassified',estimatedDurationMinutes:null,focusEstimateMinutes:null,requiresCompletion:true,tags:[],attachments:[]};
function fixture(){return {settings:{},recurringTemplates:[rule],weeks:{[week]:{tasks:[
 base('past','2026-10-12'),base('source','2026-10-13'),
 base('safe','2026-10-14',{reminderNotifiedTimes:['2026-10-14T09:00']}),
 base('done','2026-10-15',{done:true,status:'done',completedAt:'2026-10-15T13:00:00Z'}),
 base('edited','2026-10-16',{note:'Keep my own note',recurrenceOverride:true}),
 base('custom','2026-10-17',{priority:'high'}),
 base('moved','2026-10-18',{reschedulingHistory:[{reason:'manual'}]})
 ]}}};}
const edited={title:'New rule title',note:'New default note',type:'study',listId:'study',folderName:'Learning',sectionName:'',priority:'medium',importance:'unclassified',urgency:'unclassified',estimatedDurationMinutes:90,focusEstimateMinutes:null,requiresCompletion:true,tags:['course'],attachments:[]};
test('preview targets only unchanged unfinished future series records',()=>{
 const source=fixture(),before=JSON.stringify(source);
 const plan=bulk.preview(source,{seriesId:'s1',fromDate:'2026-10-13',fields:edited,excludeId:'source'});
 assert.deepEqual(plan.changes.map(c=>c.id),['safe']);
 assert.equal(plan.skipped.completed,1);assert.equal(plan.skipped.customized,3);
 assert.equal(JSON.stringify(source),before);
});
test('accepted metadata updates keep IDs, hours, alerts and completion history unmodified',()=>{
 const source=fixture(),plan=bulk.preview(source,{seriesId:'s1',fromDate:'2026-10-13',fields:edited,excludeId:'source'});
 const changed=bulk.apply(source,plan);
 assert.equal(source.weeks[week].tasks[2].title,'Original');
 assert.equal(changed.weeks[week].tasks[2].title,'New rule title');
 assert.equal(changed.weeks[week].tasks[2].priority,'medium');
 for(const field of ['id','seriesId','occurrenceDate','day','start','duration','reminderTimes','reminderNotifiedTimes'])
  assert.deepEqual(changed.weeks[week].tasks[2][field],source.weeks[week].tasks[2][field]);
 for(const id of ['past','source','done','edited','custom','moved']){
  const x=changed.weeks[week].tasks.find(t=>t.id===id),y=source.weeks[week].tasks.find(t=>t.id===id);
  assert.deepEqual(x,y);
 }
});
test('stale or tampered previews cannot change planner state',()=>{
 const source=fixture(),plan=bulk.preview(source,{seriesId:'s1',fromDate:'2026-10-13',fields:edited,excludeId:'source'});
 source.weeks[week].tasks[2].note='Edited in another tab';
 const prior=JSON.stringify(source);
 assert.throws(()=>bulk.apply(source,plan),/changed/);
 assert.equal(JSON.stringify(source),prior);
 assert.throws(()=>bulk.preview(source,{seriesId:'s1',fromDate:'2026-10-13',fields:{start:720}}),/requires a separate scheduling review/);
});
