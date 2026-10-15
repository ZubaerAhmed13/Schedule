import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-schedule-gaps.js';
const gaps=WeekwiseScheduleGaps;

test('labels only the real free interval between two actual schedules',()=>{
 const result=gaps.between([{start:540,end:600},{start:660,end:720}]);
 assert.deepEqual(result,[{start:600,end:660,minutes:60}]);
 assert.equal(gaps.label(result[0].minutes),'1h gap');
 assert.equal(gaps.clock(result[0].start),'10:00');
 assert.equal(gaps.clock(result[0].end),'11:00');
});
test('back-to-back, overlapping, and nested schedules create no false free time',()=>{
 assert.deepEqual(gaps.between([{start:540,end:600},{start:600,end:660}]),[]);
 assert.deepEqual(gaps.between([{start:540,end:660},{start:555,end:600},{start:630,end:690}]),[]);
 assert.deepEqual(gaps.between([{start:600,end:660},{start:540,end:570},{start:565,end:620},{start:700,end:730}]),[{start:660,end:700,minutes:40}]);
});
test('gap math ignores zero-duration, invalid and unplanned activities, and does not count day edges',()=>{
 assert.deepEqual(gaps.between([{start:0,end:60},{start:undefined,end:600},{start:120,end:120},{start:180,end:240},{start:1440,end:1500}]),[{start:60,end:180,minutes:120}]);
 assert.deepEqual(gaps.between([{start:200,end:230}]),[]);
 assert.deepEqual(gaps.between([{start:100,end:200},{start:204,end:230}]),[]);
 assert.deepEqual(gaps.between([{start:100,end:200},{start:215,end:230}]),[{start:200,end:215,minutes:15}]);
});
test('projected view gaps use that calendar day and ignore all-day and unscheduled reminders',()=>{
 const rows=[
  {date:'2030-01-07',endDate:'2030-01-07',start:540,endMinute:600,task:{id:'a'}},
  {date:'2030-01-07',endDate:'2030-01-07',start:660,endMinute:720,task:{id:'b'}},
  {date:'2030-01-07',endDate:'2030-01-07',start:null,allDay:true,task:{id:'all'}},
  {date:'2030-01-07',endDate:'2030-01-07',start:620,endMinute:640,zoneError:true,task:{id:'review'}},
  {date:'2030-01-07',start:null,task:{id:'unscheduled'}}
 ];
 assert.deepEqual(gaps.fromRecords(rows,'2030-01-07'),[{start:600,end:660,minutes:60}]);
});
test('overnight schedules occupy the appropriate portion of each date',()=>{
 const rows=[
  {date:'2030-01-06',endDate:'2030-01-07',start:1380,endMinute:60,task:{id:'overnight'}},
  {date:'2030-01-07',endDate:'2030-01-07',start:90,endMinute:120,task:{id:'morning'}},
  {date:'2030-01-07',endDate:'2030-01-08',start:1320,endMinute:120,task:{id:'late'}}
 ];
 assert.deepEqual(gaps.fromRecords(rows,'2030-01-07'),[{start:60,end:90,minutes:30},{start:120,end:1320,minutes:1200}]);
 assert.deepEqual(gaps.fromRecords(rows,'2030-01-06'),[]);
 assert.equal(gaps.label(75),'1h 15m gap');
});
