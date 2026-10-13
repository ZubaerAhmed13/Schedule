import test from 'node:test';import assert from 'node:assert/strict';
import '../js/weekwise-data.js';import '../js/weekwise-task-history.js';
const week='2026-10-11';
const task={id:'original',title:'Keep all details',day:1,start:600,duration:45,done:true,note:'Retained private note',tags:['language'],subtasks:[{id:'sub',title:'Practice',done:true}],reminderTimes:['2026-10-12T09:00'],reschedulingHistory:[{from:{week,day:0,start:300}}]};
const fixture=()=>({settings:{theme:'dark'},weeks:{[week]:{tasks:[structuredClone(task)],notes:'Week metadata'}},recurringTemplates:[],customLists:[]});
const move=(store,kind='archive')=>WeekwiseTaskHistory.move(store,{week,id:'original',kind,historyId:'history-1',at:'2026-10-13T08:00:00.000Z'});

test('archive and recently removed retain exact records and week metadata across backup/restore',()=>{
 for(const kind of ['archive','trash']){const before=fixture(),raw=JSON.stringify(before),next=move(before,kind);assert.equal(JSON.stringify(before),raw);assert.equal(next.weeks[week].tasks.length,0);assert.equal(next.weeks[week].notes,'Week metadata');assert.deepEqual(next.taskHistory[0].items[0].task,task);const imported=WeekwiseData.parseBackup(JSON.stringify({...next,app:'Weekwise',version:6}));const restored=WeekwiseTaskHistory.restore(imported,'history-1');assert.deepEqual(restored.weeks[week].tasks,[task]);assert.equal(restored.taskHistory.length,0);}
});
test('linked parts move and restore as one group with their original IDs and states',()=>{
 const store=fixture();store.weeks[week].tasks[0].planningChildren=['part'];store.weeks['2026-10-18']={tasks:[{id:'part',title:'Child',day:2,start:null,duration:30,unscheduled:true,done:false,parentTaskId:'original'}]};
 const next=move(store);assert.equal(next.taskHistory[0].items.length,2);assert.equal(next.weeks['2026-10-18'].tasks.length,0);const restored=WeekwiseTaskHistory.restore(next,'history-1');assert.deepEqual(restored.weeks,store.weeks);
});
test('fixed blocks and ambiguous linked identities cannot be removed',()=>{
 const store=fixture();store.weeks[week].tasks[0].fixed=true;assert.throws(()=>move(store),/Fixed/);
 const ambiguous=fixture();ambiguous.weeks[week].tasks[0].planningChildren=['part'];ambiguous.weeks[week].tasks.push({id:'part',title:'Part A',day:0,start:null});ambiguous.weeks['2026-10-18']={tasks:[{id:'part',title:'Part B',day:0,start:null}]};assert.throws(()=>move(ambiguous),/ambiguous/);
});
test('ordinary removal does not accidentally remove an unrelated same-ID legacy record in another week',()=>{
 const store=fixture();store.weeks['2026-10-18']={tasks:[{...task,title:'Different legacy activity'}]};const next=move(store);assert.equal(next.weeks['2026-10-18'].tasks.length,1);assert.equal(next.taskHistory[0].items.length,1);
});
test('restoration refuses duplicate identities and overlapping schedules instead of overwriting',()=>{
 const next=move(fixture());next.weeks[week].tasks.push({id:'busy',title:'Occupied slot',day:1,start:610,duration:60});assert.throws(()=>WeekwiseTaskHistory.restore(next,'history-1'),/overlaps/);const restored=WeekwiseTaskHistory.restore(next,'history-1',{unscheduled:true}),original=restored.weeks[week].tasks.find(t=>t.id==='original');assert.equal(original.start,null);assert.equal(original.done,true);assert.equal(original.restoredSchedule.start,600);assert.deepEqual(original.reschedulingHistory,task.reschedulingHistory);
 next.weeks[week].tasks.push(structuredClone(task));assert.throws(()=>WeekwiseTaskHistory.restore(next,'history-1',{unscheduled:true}),/identity already exists/);assert.equal(next.taskHistory.length,1);
});
test('recurrence exclusions stop regeneration and restore only the unchanged original rule',()=>{
 const store=fixture();Object.assign(store.weeks[week].tasks[0],{seriesId:'rule',occurrenceDate:'2026-10-12',recurrence:'weekly'});store.recurringTemplates=[{id:'rule',title:task.title,excludedDates:[]}];const next=move(store);assert.deepEqual(next.recurringTemplates[0].excludedDates,['2026-10-12']);assert.deepEqual(WeekwiseTaskHistory.restore(next,'history-1').recurringTemplates,store.recurringTemplates);
 next.recurringTemplates[0].title='Newer rule';assert.equal(WeekwiseTaskHistory.restore(next,'history-1').recurringTemplates[0].title,'Newer rule');
});
test('invalid history is rejected during local, cloud and backup validation',()=>{
 const next=move(fixture());next.taskHistory[0].items[0].task.day=9;assert.throws(()=>WeekwiseData.validateStore(next),/weekday/);assert.throws(()=>WeekwiseData.parseBackup(JSON.stringify(next)),/weekday/);const bad=fixture();bad.taskHistory=[{id:'x',kind:'purged',createdAt:'now',items:[],rules:[]}];assert.throws(()=>WeekwiseData.validateStore(bad),/history/);
});
