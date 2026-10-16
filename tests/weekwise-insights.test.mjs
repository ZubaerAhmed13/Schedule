import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-data.js';
import '../js/weekwise-planning.js';
import '../js/weekwise-timezones.js';
import '../js/weekwise-calendar-range.js';
import '../js/weekwise-insights.js';
const insights=globalThis.WeekwiseInsights,week='2026-10-11';
const record=(id,date,start,duration,extra={})=>({dateKey:date,task:{id,title:id,start,duration,unscheduled:false,done:false,...extra}});
test('weekly scheduled workload unions overlaps and carries overnight time across days and weeks',()=>{
 const entries=[
  record('prior','2026-10-10',1380,180),
  record('morning','2026-10-11',540,120),
  record('overlap','2026-10-11',600,120),
  record('late','2026-10-12',1380,120),
  record('all-day','2026-10-13',null,0,{allDay:true}),
  record('no-time','2026-10-14',null,90,{unscheduled:true})
 ];
 const before=JSON.stringify(entries),result=insights.weekly(entries,week);
 assert.deepEqual(result.days.map(d=>d.minutes),[300,60,60,0,0,0,0]);
 assert.equal(result.totalMinutes,420);
 assert.equal(result.days.length,7);
 assert.equal(JSON.stringify(entries),before,'Insights calculation never changes stored planner data');
});
test('replanning uses actual recorded events; comparisons use only task-linked focus with explicit estimates',()=>{
 const changes=[{changedAt:'2026-10-12T12:00:00',fromWeek:week,fromStart:600,toStart:720},{changedAt:'2026-10-12T12:00:00',fromWeek:week,fromStart:600,toStart:720},{changedAt:'2026-10-02T12:00:00',fromWeek:week,fromStart:720,toStart:800}];
 const records=[record('a','2026-10-12',600,90,{estimatedDurationMinutes:120,reschedulingHistory:changes}),record('b','2026-10-12',800,60)];
 const sessions=[{taskId:'a',endedAt:'2026-10-12T13:00:00',seconds:1800},{taskId:'a',endedAt:'2026-10-12T14:00:00',seconds:900},{taskId:'b',endedAt:'2026-10-12T14:00:00',seconds:600},{taskId:'unknown',endedAt:'2026-10-12T14:00:00',seconds:600},{taskId:'a',endedAt:'2026-10-12T14:00:00',seconds:-20}];
 const report=insights.weekly(records,week,sessions);
 assert.equal(report.recordedMoves,1);
 assert.equal(report.movedTasks,1);
 assert.equal(report.comparedTasks,1);
 assert.equal(report.linkedFocusMinutes,45);
 assert.equal(report.estimateMinutes,120);
});
test('missing actual work stays missing rather than inferred from scheduled or estimated time',()=>{
 const result=insights.weekly([record('never-timed','2026-10-12',600,60,{focusEstimateMinutes:75})],week,[]);
 assert.equal(result.totalMinutes,60);
 assert.equal(result.recordedMoves,0);
 assert.equal(result.comparedTasks,0);
 assert.equal(result.linkedFocusMinutes,0);
 assert.equal(result.estimateMinutes,0);
 assert.throws(()=>insights.weekly([], '2026-02-30'),/date/i);
});

test('weekly completion excludes unplanned Inbox, while due-only deadlines remain separately visible',()=>{
 const values=[
  record('meeting','2026-10-12',540,60,{done:true,listId:'work'}),
  record('class','2026-10-13',600,90,{done:false,listId:'study'}),
  record('highlighted-inbox','2026-10-12',null,45,{unscheduled:true,listId:'inbox',todayPriority:true}),
  record('due-only','2026-10-10',null,45,{unscheduled:true,listId:'inbox',dueDate:'2026-10-13'}),
  record('optional','2026-10-13',720,30,{done:true,requiresCompletion:false}),
  record('all-day','2026-10-14',null,1440,{allDay:true,done:true})
 ];
 const before=JSON.stringify(values),result=insights.weekly(values,week);
 assert.deepEqual(result.completion,{total:3,completed:2});
 assert.equal(result.unplannedDue,1);
 assert.equal(JSON.stringify(values),before);
});

test('focus comparisons use the saved task week and refuse ambiguous legacy links',()=>{const a={...record('same','2030-01-07',600,30,{estimatedDurationMinutes:30}),week:'2030-01-06'},b={...record('same','2030-01-13',600,60,{estimatedDurationMinutes:90}),week:'2030-01-13'};const sessions=[{taskId:'same',taskWeek:'2030-01-06',endedAt:'2030-01-08T12:00:00Z',minutes:10},{taskId:'same',taskWeek:'2030-01-13',endedAt:'2030-01-13T13:00:00Z',minutes:20},{taskId:'same',endedAt:'2030-01-09T12:00:00Z',minutes:5},{taskId:'unassigned',endedAt:'2030-01-10T12:00:00Z',minutes:15}];const result=insights.weekly([a,b],'2030-01-07',sessions,'UTC');assert.equal(result.focusMinutes,50);assert.equal(result.focusCount,4);assert.equal(result.comparedTasks,2);assert.equal(result.estimateMinutes,120);assert.equal(result.linkedFocusMinutes,30);assert.equal(result.ambiguousFocus,1);});
test('invalid focus amounts and skipped completion requirements do not create misleading totals',()=>{const values=[record('skipped','2030-01-07',600,30,{status:'skipped'}),record('required','2030-01-08',650,30,{done:true})],sessions=[{endedAt:'2030-01-08T12:00:00Z',minutes:Infinity},{endedAt:'2030-01-08T12:00:00Z',minutes:-20},{endedAt:'2030-01-08T12:00:00Z',minutes:1500},{endedAt:'bad',minutes:20},{endedAt:'2030-01-08T12:00:00Z',minutes:25}];const result=insights.weekly(values,'2030-01-07',sessions,'UTC');assert.deepEqual(result.completion,{total:1,completed:1});assert.equal(result.focusMinutes,25);assert.equal(result.focusCount,1);assert.equal(result.hasEvidence,true);assert.equal(insights.weekly([],'2030-01-07',[],'UTC').hasEvidence,false);});
