import test from 'node:test';import assert from 'node:assert/strict';
import '../js/weekwise-data.js';import '../js/weekwise-timezones.js';import '../js/weekwise-calendar-range.js';import '../js/weekwise-planning.js';import '../js/weekwise-today.js';import '../js/weekwise-insights.js';
const record=(id,day,start,duration,extra={})=>({week:'2030-01-06',dateKey:WeekwisePlanning.dateAt('2030-01-06',day),task:{id,title:id,day,start,duration,...extra}});
test('Today derives the saved-zone date, protects canonical records and carries previous-night blocks',()=>{const rows=[record('night',0,1380,120),record('morning',1,30,90),record('later',1,120,30),record('ignored',1,null,40,{unscheduled:true})],store={settings:{timeZone:'Asia/Tokyo'}},raw=JSON.stringify(rows),result=WeekwiseToday.daily(rows,store,Date.parse('2030-01-06T15:45:00Z'));assert.equal(result.date,'2030-01-07');assert.equal(result.minute,45);assert.equal(result.next.task.id,'night');assert.equal(result.next.carried,true);assert.equal(result.next.start,0);assert.equal(result.scheduled,150);assert.equal(WeekwiseToday.occursOn(rows[0],result.date),true);assert.equal(WeekwiseToday.occursOn(record('midnight-end',0,1380,60),result.date),false);assert.equal(JSON.stringify(rows),raw);});
test('Today uses captured instants in a DST fold, while ambiguous old times remain review items',()=>{const slot=WeekwiseCalendarRange.slot('2030-10-27',30,30,'UTC','Europe/Berlin'),exact={week:slot.week,task:{id:'exact',title:'exact',day:slot.day,start:slot.start,duration:slot.duration,scheduleInstant:slot.scheduleInstant}},legacy={week:slot.week,task:{id:'legacy',title:'legacy',day:slot.day,start:150,duration:30}},store={settings:{timeZone:'Europe/Berlin'}},raw=JSON.stringify([exact,legacy]),result=WeekwiseToday.daily([exact,legacy],store,Date.parse('2030-10-27T00:45:00Z'));assert.equal(result.next.task.id,'exact');assert.equal(result.scheduled,30);assert.equal(result.next.clockChange,true);assert.equal(result.next.instant.end,Date.parse('2030-10-27T01:00:00Z'));assert.equal(result.review[0].task.id,'legacy');assert.equal(JSON.stringify([exact,legacy]),raw);});
test('completed blocks do not become the next commitment and all-day spans keep calendar dates',()=>{const rows=[record('done',1,60,120,{status:'done'}),record('next',1,240,30),record('trip',0,null,2880,{allDay:true})],result=WeekwiseToday.daily(rows,{settings:{timeZone:'UTC'}},Date.parse('2030-01-07T02:00:00Z'));assert.equal(result.next.task.id,'next');assert.equal(WeekwiseToday.occursOn(rows[2],'2030-01-07'),true);assert.equal(WeekwiseToday.occursOn(rows[2],'2030-01-08'),false);});
test('Today completion is derived from due dates, carried activities and explicit completion requirements without changing records',()=>{
 const rows=[record('done',1,600,60,{done:true}),record('status',1,null,30,{unscheduled:true,status:'done'}),record('optional',1,720,30,{done:true,requiresCompletion:false}),record('deadline',4,null,30,{unscheduled:true,dueDate:'2030-01-07'}),record('overnight',0,1380,120),record('all-day',0,null,2880,{allDay:true}),record('tomorrow',2,600,30)],raw=JSON.stringify(rows),epoch=Date.parse('2030-01-07T12:00:00Z');
 assert.deepEqual(WeekwiseToday.daily(rows,{settings:{timeZone:'UTC'}},epoch).completion,{total:3,completed:1});
 assert.deepEqual(WeekwiseToday.daily([],{settings:{timeZone:'UTC'}},epoch).completion,{total:0,completed:0});
 assert.equal(JSON.stringify(rows),raw);
});
test('Insights assigns recorded focus and move timestamps to the saved-zone week',()=>{const row=record('work',1,600,60,{estimatedDurationMinutes:50,reschedulingHistory:[{changedAt:'2030-01-06T23:30:00Z',fromStart:500,toStart:600}]}),session={taskId:'work',endedAt:'2030-01-06T23:30:00Z',seconds:1200};assert.equal(WeekwiseInsights.localDay(session.endedAt,'Asia/Tokyo'),'2030-01-07');const report=WeekwiseInsights.weekly([row],'2030-01-07',[session],'Asia/Tokyo');assert.equal(report.recordedMoves,1);assert.equal(report.linkedFocusMinutes,20);assert.equal(report.estimateMinutes,50);assert.equal(WeekwiseInsights.weekly([row],'2030-01-07',[session],'UTC').linkedFocusMinutes,0);});

test('unscheduled Inbox, highlighted backlog and due-only tasks do not inflate Today at a Glance',()=>{
 const rows=[
  record('scheduled',1,540,60,{done:true,listId:'study'}),
  record('second',1,660,60,{listId:'study'}),
  record('inbox',1,null,45,{unscheduled:true,listId:'inbox',todayPriority:true}),
  record('deadline',4,null,30,{unscheduled:true,listId:'inbox',dueDate:'2030-01-07'}),
  record('all-day',1,null,1440,{allDay:true,listId:'personal',done:true}),
  record('optional',1,720,60,{requiresCompletion:false,done:true}),
 ];
 const before=JSON.stringify(rows),result=WeekwiseToday.daily(rows,{settings:{timeZone:'UTC'}},Date.parse('2030-01-07T12:00:00Z'));
 assert.deepEqual(result.completion,{total:3,completed:2});
 assert.deepEqual(result.due,{total:1,unplanned:1,overdue:0});
 assert.equal(result.inboxCount,2);
 assert.equal(JSON.stringify(rows),before,'statistics never mutate stored tasks');
});
test('due-only backlog stays actionable even on a day with no appointments',()=>{
 const rows=[record('inbox',1,null,45,{unscheduled:true,listId:'inbox',dueDate:'2030-01-06',todayPriority:true})],
 result=WeekwiseToday.daily(rows,{settings:{timeZone:'UTC'}},Date.parse('2030-01-07T12:00:00Z'));
 assert.deepEqual(result.completion,{total:0,completed:0});
 assert.deepEqual(result.due,{total:1,unplanned:1,overdue:1});
 assert.equal(result.inboxCount,1);
});
