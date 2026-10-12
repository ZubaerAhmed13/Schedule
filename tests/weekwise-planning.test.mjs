import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-data.js';
import '../js/weekwise-planning.js';
const engine=globalThis.WeekwisePlanning;
const week='2026-10-11';
const task=(id,options={})=>({id,title:id,day:1,start:null,duration:30,unscheduled:true,focusEstimateMinutes:60,...options});
const store=tasks=>({settings:{},weeks:{[week]:{tasks}}});
const build=(tasks,prefs={})=>engine.build({store:store(tasks),weekStart:week,prefs:{days:[1],start:540,end:1020,buffer:60,breakMinutes:10,...prefs}});
test('overlapping commitments are unioned and capacity excludes breaks and buffer',()=>{
 const result=build([task('fixed1',{start:540,duration:120,unscheduled:false}),task('fixed2',{start:600,duration:120,unscheduled:false})]);
 assert.equal(result.available,480);assert.equal(result.committed,180);assert.equal(result.existingBreaks,10);assert.equal(result.reservedBuffer,60);assert.equal(result.capacity,230);assert.equal(result.overlaps.length,1);
});
test('priority and deadlines produce deterministic placements without overlapping',()=>{
 const tasks=[task('low',{priority:'low'}),task('high',{priority:'high'}),task('due',{dueDate:'2026-10-12'})];
 const result=build(tasks);assert.deepEqual(result.proposals.map(x=>x.id),['due','high','low']);
 assert.deepEqual(build(tasks),result);
 for(let i=1;i<result.proposals.length;i++)assert.ok(result.proposals[i].start>=result.proposals[i-1].start+result.proposals[i-1].duration+10);
});
test('unknown estimates are never inferred from automatic calendar duration',()=>{
 const result=build([task('unknown',{focusEstimateMinutes:null})]);assert.equal(result.proposals.length,0);assert.equal(result.unknown,1);assert.match(result.unscheduled[0].reason,/Duration unknown/);
});
test('impossible workloads remain unscheduled rather than expanding availability',()=>{
 const result=build([task('one',{focusEstimateMinutes:180}),task('two',{focusEstimateMinutes:180})],{end:840});
 assert.equal(result.proposals.length,1);assert.equal(result.unscheduled.length,1);assert.ok(result.overcommitted>0);
});
test('fixed, recurring, all-day, completed and already scheduled tasks are never candidates',()=>{
 const result=build([task('fixed',{schedulingMode:'fixed'}),task('work',{workday:true}),task('rec',{seriesId:'s'}),task('all',{allDay:true,day:0}),task('done',{done:true}),task('timed',{start:600,unscheduled:false})]);
 assert.equal(result.proposals.length,0);assert.equal(result.unscheduled.length,0);
});
test('preview is pure and selected acceptance preserves identifiers and task details',()=>{
 const value=store([task('one',{reminderTimes:['2026-10-12T08:00'],subtasks:[{id:'s',title:'Part',done:true}],notes:'keep'}),task('two')]);
 const before=JSON.stringify(value), plan=engine.build({store:value,weekStart:week});
 assert.equal(JSON.stringify(value),before);
 const next=engine.apply(value,plan,[week+'::one']);
 assert.equal(JSON.stringify(value),before);assert.equal(next.weeks[week].tasks[0].id,'one');assert.deepEqual(next.weeks[week].tasks[0].reminderTimes,value.weeks[week].tasks[0].reminderTimes);assert.deepEqual(next.weeks[week].tasks[0].subtasks,value.weeks[week].tasks[0].subtasks);assert.equal(next.weeks[week].tasks[1].start,null);
});
test('past deadlines and past hours are never scheduled',()=>{
 const result=engine.build({store:store([task('expired',{dueDate:'2026-10-11'}),task('later')]),weekStart:week,prefs:{days:[1],buffer:0,breakMinutes:0},notBefore:{date:'2026-10-12',minute:660}});
 assert.match(result.unscheduled[0].reason,/Deadline has passed/);assert.equal(result.proposals[0].start,660);
});
test('overnight event from previous week blocks the beginning of this week',()=>{
 const value=store([task('later',{day:0})]);value.weeks['2026-10-04']={tasks:[task('overnight',{day:6,start:1380,duration:180,unscheduled:false})]};
 const result=engine.build({store:value,weekStart:week,prefs:{days:[0],start:0,end:240,buffer:0,breakMinutes:0}});
 assert.equal(result.committed,120);assert.equal(result.proposals[0].start,120);
});
test('calendar date offsets remain correct across DST and year boundaries',()=>{
 assert.equal(engine.ordinal('2026-10-26')-engine.ordinal('2026-10-25'),1);assert.equal(engine.dateAt('2026-12-27',6),'2027-01-02');assert.throws(()=>engine.ordinal('2026-02-30'));
});
test('cross-week acceptance moves one original record without duplicates or lost metadata',()=>{
 const value=store([]);value.weeks['2026-10-04']={notes:'old',tasks:[task('backlog')]};value.weeks[week].notes='new';
 const plan=engine.build({store:value,weekStart:week});const next=engine.apply(value,plan,['2026-10-04::backlog']);
 assert.equal(next.weeks['2026-10-04'].tasks.length,0);assert.equal(next.weeks['2026-10-04'].notes,'old');assert.equal(next.weeks[week].notes,'new');assert.equal(next.weeks[week].tasks.length,1);
});
test('failed validation or changed task rejects an entire plan without partial mutation',()=>{
 const value=store([task('one'),task('two')]);const plan=engine.build({store:value,weekStart:week});value.weeks[week].tasks[1].fixed=true;const before=JSON.stringify(value);
 assert.throws(()=>engine.apply(value,plan,[week+'::one',week+'::two']));assert.equal(JSON.stringify(value),before);
});

test('multiple windows, daily cap and weekly buffer reserve only user availability',()=>{
 const p=build([task('a')],{buffer:0,breakMinutes:0,windows:[{days:[1],start:540,end:660},{days:[1],start:840,end:960}],maxDailyMinutes:180,weeklyBuffer:30});assert.equal(p.available,240);assert.equal(p.capacity,150);assert.equal(p.dailyLimitReserved,60);assert.equal(p.weeklyBufferReserved,30);assert.equal(p.proposals[0].start,540);
});
test('preferred focus placement and requested slots remain inside free windows',()=>{
 const tasks=[task('a')],prefs={buffer:0,breakMinutes:0,focusStart:840,focusEnd:960};assert.equal(build(tasks,prefs).proposals[0].start,840);const p=engine.build({store:store(tasks),weekStart:week,prefs,overrides:{[week+'::a']:{date:'2026-10-12',start:300}}});assert.equal(p.proposals.length,0);assert.match(p.unscheduled[0].reason,/requested time/);
});
test('recovery excludes fixed, completed and attendance-only events and preserves original occurrence',()=>{
 const tasks=[task('missed',{start:600,duration:60,unscheduled:false,seriesId:'r',occurrenceDate:'2026-10-12',note:'Keep'}),task('fixed',{start:600,unscheduled:false,fixed:true}),task('attendance',{start:600,unscheduled:false,requiresCompletion:false}),task('done',{start:600,unscheduled:false,done:true})],value=store(tasks);const p=engine.build({store:value,weekStart:week,prefs:{days:[1],buffer:0,breakMinutes:0},notBefore:{date:'2026-10-12',minute:720},mode:'recover'});assert.deepEqual(p.proposals.map(x=>x.id),['missed']);const n=engine.apply(value,p,[week+'::missed']),m=n.weeks[week].tasks[0];assert.equal(m.id,'missed');assert.equal(m.occurrenceDate,'2026-10-12');assert.equal(m.note,'Keep');assert.equal(m.reschedulingHistory.length,1);assert.equal(m.recurrenceOverride,true);assert.equal(value.weeks[week].tasks[0].start,600);
});
test('split keeps parent ID/history and creates linked unscheduled parts with explicit estimates',()=>{
 const value=store([task('large',{note:'Keep',subtasks:[{id:'old',title:'Existing',done:true}]})]);let id=0;const n=engine.splitTask(value,{week,id:'large'},[{title:'First',minutes:30},{title:'Second',minutes:45}],()=> 'child'+ ++id);const [parent,first,second]=n.weeks[week].tasks;assert.equal(parent.id,'large');assert.equal(parent.subtasks[0].id,'old');assert.equal(parent.planningChildren.length,2);assert.equal(first.parentTaskId,'large');assert.equal(second.estimatedDurationMinutes,45);assert.equal(first.start,null);assert.equal(first.reminderAt,null);assert.equal(value.weeks[week].tasks.length,1);assert.equal(engine.build({store:n,weekStart:week}).proposals.length,2);
});
test('acceptance rejects a tampered placement outside availability before mutating data',()=>{const value=store([task('a')]),p=build(value.weeks[week].tasks);p.proposals[0].start=300;const before=JSON.stringify(value);assert.throws(()=>engine.apply(value,p,[week+'::a']),/no longer feasible/);assert.equal(JSON.stringify(value),before);});
