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


test('readiness uses the selected week and exactly the build estimate rules without modifying records',()=>{
 const value=store([task('ready',{unknown:{keep:true},todayPriority:true}),task('missing',{focusEstimateMinutes:null}),task('zero',{estimatedDurationMinutes:0}),task('done',{done:true}),task('skip',{status:'skipped'}),task('fixed',{fixed:true}),task('parent',{planningChildren:['child']}),task('fraction',{estimatedDurationMinutes:2.5}),task('scheduled',{start:600,unscheduled:false})]);
 value.weeks['2026-11-01']={notes:'Future notes',tasks:[task('future')]};const before=JSON.stringify(value),r=engine.readiness(value,week),p=engine.build({store:value,weekStart:week});
 assert.deepEqual(r.ready.map(r=>r.task.id),['ready']);assert.deepEqual(r.missing.map(r=>r.task.id),['missing','zero','fraction']);assert.equal(r.future,1);assert.equal(r.scheduled,1);assert.equal(r.highlighted.length,1);
 assert.equal(p.proposals.length+p.unscheduled.length,r.ready.length+r.missing.length);assert.equal(JSON.stringify(value),before);
});
test('planning distinguishes missing hours, exhausted capacity, fragmented gaps and deadline constraints',()=>{
 const none=build([task('one')],{days:[]});assert.equal(none.unscheduled[0].code,'availability');
 const full=build([task('all',{allDay:true,day:1,duration:1440}),task('one')]);assert.equal(full.unscheduled[0].code,'capacity');
 const fragmented=build([task('one',{estimatedDurationMinutes:70})],{buffer:0,breakMinutes:10,windows:[{days:[1],start:540,end:600},{days:[1],start:660,end:720}]});assert.equal(fragmented.unscheduled[0].code,'continuous-slot');assert.equal(fragmented.unscheduled[0].largestSlotMinutes,50);assert.match(fragmented.unscheduled[0].reason,/needs 70 min/);
 const deadline=build([task('one',{estimatedDurationMinutes:70,dueDate:'2026-10-12'})],{buffer:0,breakMinutes:10,windows:[{days:[1],start:540,end:600},{days:[1],start:660,end:720}]});assert.equal(deadline.unscheduled[0].code,'deadline-slot');
 const earlier=engine.build({store:store([task('one',{dueDate:'2026-10-13'})]),weekStart:'2026-10-18',notBefore:{date:'2026-10-12',minute:600}});assert.equal(earlier.unscheduled[0].code,'deadline-week');
 const passed=engine.build({store:store([task('one',{dueDate:'2026-10-11'})]),weekStart:week,notBefore:{date:'2026-10-12',minute:600}});assert.equal(passed.unscheduled[0].code,'deadline-passed');
});
test('placement explanations identify preferred focus hours, chosen slots and ordinary earliest slots',()=>{
 const tasks=[task('one')],prefs={buffer:0,breakMinutes:0,focusStart:840,focusEnd:960};const preferred=build(tasks,prefs).proposals[0];assert.equal(preferred.placement,'preferred');assert.match(preferred.reason,/preferred focus hours/);assert.equal(preferred.start,840);
 const chosen=engine.build({store:store(tasks),weekStart:week,prefs,overrides:{[week+'::one']:{date:'2026-10-12',start:600}}}).proposals[0];assert.equal(chosen.placement,'chosen');assert.match(chosen.reason,/Your chosen slot/);assert.doesNotMatch(chosen.reason,/Earliest/);
 assert.equal(build(tasks,{buffer:0,breakMinutes:0}).proposals[0].placement,'earliest');
 const invalid=engine.build({store:store(tasks),weekStart:week,prefs,overrides:{[week+'::one']:{date:'2026-10-12',start:300}}});assert.equal(invalid.unscheduled[0].code,'placement');
});
test('selection review follows selected minutes, breaks, remaining capacity and last selected finish',()=>{
 const value=store([task('a',{estimatedDurationMinutes:60,note:'Keep'}),task('b',{estimatedDurationMinutes:30})]),p=engine.build({store:value,weekStart:week,prefs:{days:[1],start:540,end:720,buffer:0,breakMinutes:10}}),before=JSON.stringify(p);
 const r=engine.review(p,[week+'::a',week+'::a','unknown']);assert.equal(r.count,1);assert.equal(r.unchanged,1);assert.equal(r.taskMinutes,60);assert.equal(r.breakMinutes,10);assert.equal(r.remaining,110);assert.equal(r.days[0].lastFinish,600);assert.equal(r.days[0].remaining,110);
 const empty=engine.review(p,[]);assert.equal(empty.remaining,p.capacity);assert.equal(empty.days[0].lastFinish,null);assert.equal(JSON.stringify(p),before);
 const next=engine.apply(value,p,[week+'::a']);assert.equal(next.weeks[week].tasks[0].start,540);assert.equal(next.weeks[week].tasks[1].start,null);assert.equal(value.weeks[week].tasks[0].start,null);
});
test('selection review retains daily limits and weekly buffers across partial recovery approval',()=>{
 const value=store([task('past',{start:540,duration:30,estimatedDurationMinutes:30,unscheduled:false}),task('other',{day:2,start:540,duration:30,estimatedDurationMinutes:30,unscheduled:false})]);const p=engine.build({store:value,weekStart:week,prefs:{days:[1,2],start:540,end:720,buffer:10,weeklyBuffer:20,maxDailyMinutes:120,breakMinutes:10},notBefore:{date:'2026-10-12',minute:600},mode:'recover'}),r=engine.review(p,p.proposals.slice(0,1).map(p=>p.week+'::'+p.id));
 assert.equal(r.remaining,r.days.reduce((n,d)=>n+d.remaining,0));assert.equal(r.taskMinutes,30);assert.equal(r.remaining,p.capacity-40);assert.equal(p.protectedCount,2);
});

test('chosen start minutes cannot silently roll into another date',()=>{for(const start of [-1,1440,1500]){const p=engine.build({store:store([task('one')]),weekStart:week,overrides:{[week+'::one']:{date:'2026-10-12',start}}});assert.equal(p.proposals.length,0);assert.equal(p.unscheduled[0].code,'placement');}});
