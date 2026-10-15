import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-data.js';
import '../js/weekwise-timezones.js';
import '../js/weekwise-task-options.js';
import '../js/weekwise-calendar-range.js';
import '../js/weekwise-task-schedule.js';
import '../js/weekwise-recurring-placement.js';
import '../js/weekwise-task-history.js';

const week='2030-01-06',nextWeek='2030-01-13';
const fixture=()=>({settings:{timeZone:'UTC'},weeks:{[week]:{tasks:[]},[nextWeek]:{tasks:[]}},recurringTemplates:[],customLists:[]});

test('task palettes are a strict allowlist, and time-zone choices are real IANA zones',()=>{
 assert.equal(WeekwiseTaskOptions.colour('not-a-colour'),'auto');
 assert.equal(WeekwiseTaskOptions.accent('blue'),'#397bc4');
 assert.equal(WeekwiseTaskOptions.attributes({taskColor:'blue'}).includes('data-task-color="blue"'),true);
 assert.equal(WeekwiseTaskOptions.attributes({taskColor:'";alert(1)'}),'');
 assert.equal(WeekwiseTaskOptions.breakAfter(20),20);
 assert.equal(WeekwiseTaskOptions.breakAfter(999),0);
 assert.equal(WeekwiseTaskOptions.zones().includes('Europe/Berlin'),true);
 assert.equal(WeekwiseTaskOptions.zones().includes('Asia/Dhaka'),true);
});

test('editor respects an existing recovery buffer and never silently moves an unchanged task when adding a conflicting buffer',()=>{
 const value=fixture();value.weeks[week].tasks.push({id:'first',title:'Focus',day:1,start:600,duration:30,breakAfter:15});
 const before=JSON.stringify(value);
 const slot=WeekwiseTaskSchedule.placement(value,{week,day:1,start:630,duration:15});
 assert.equal(slot.start,645);assert.equal(JSON.stringify(value),before);
 value.weeks[week].tasks.push({id:'second',title:'Appointment',day:1,start:650,duration:30},{id:'third',title:'Next call',day:1,start:685,duration:30});
 assert.throws(()=>WeekwiseTaskSchedule.placement(value,{week,id:'second',day:1,start:650,duration:30,breakAfter:20}),/recovery break/);
});
test('recurring placement reserves next slots for its recovery break',()=>{
 const value=fixture(),index=WeekwiseRecurringPlacement.create(value);
 const slot=index.place('2030-01-07',600,30,20);
 assert.equal(slot.start,600);
 index.add({week:slot.week,task:{id:'first',day:1,title:'Repeat',start:600,duration:30,breakAfter:20}});
 assert.equal(index.place('2030-01-07',630,15).start,660);
});
test('removing this and future repeat tasks preserves completed future records, stops generation, and restores original series',()=>{
 const value=fixture(),past={id:'rec_rule_20300107',title:'Workout',day:1,start:600,duration:30,seriesId:'rule',recurrence:'weekly',occurrenceDate:'2030-01-07',done:true},
 first={id:'rec_rule_20300114',title:'Workout',day:1,start:600,duration:30,seriesId:'rule',recurrence:'weekly',occurrenceDate:'2030-01-14',done:false},
 future={id:'rec_rule_20300121',title:'Workout',day:1,start:600,duration:30,seriesId:'rule',recurrence:'weekly',occurrenceDate:'2030-01-21',done:false},
 completed={id:'rec_rule_20300128',title:'Workout',day:1,start:600,duration:30,seriesId:'rule',recurrence:'weekly',occurrenceDate:'2030-01-28',done:true};
 value.weeks[week].tasks.push(past);value.weeks[nextWeek].tasks.push(first);
 value.weeks['2030-01-20']={tasks:[future]};value.weeks['2030-01-27']={tasks:[completed]};
 value.recurringTemplates.push({id:'rule',title:'Workout',startDate:'2030-01-07',frequency:'weekly',excludedDates:[]});
 const before=JSON.stringify(value);
 const preview=WeekwiseTaskHistory.seriesPreview(value,{week:nextWeek,id:first.id,scope:'future'});
 assert.equal(preview.items.length,2);assert.equal(preview.retained.length,1);
 const next=WeekwiseTaskHistory.moveSeries(value,{week:nextWeek,id:first.id,scope:'future',historyId:'history1',at:'2030-01-14T08:00:00.000Z'});
 assert.equal(JSON.stringify(value),before);
 assert.equal(next.recurringTemplates[0].endDate,'2030-01-13');
 assert.equal(next.weeks[week].tasks.length,1);
 assert.equal(next.weeks['2030-01-27'].tasks.length,1);
 assert.equal(next.weeks[nextWeek].tasks.length,0);
 const restored=WeekwiseTaskHistory.restore(next,'history1');
 assert.deepEqual(restored.weeks,value.weeks);
 assert.deepEqual(restored.recurringTemplates,value.recurringTemplates);
});
test('entire series removal is reversible and includes completed occurrences after an explicit scope choice',()=>{
 const value=fixture();const task={id:'rec_x_20300107',title:'Class',day:1,start:600,duration:45,done:true,seriesId:'x',occurrenceDate:'2030-01-07'};
 value.weeks[week].tasks.push(task);
 value.recurringTemplates=[{id:'x',startDate:'2030-01-07',frequency:'weekly',title:'Class'}];
 const removed=WeekwiseTaskHistory.moveSeries(value,{week,id:task.id,scope:'all',historyId:'full',at:'2030-01-10T08:00:00.000Z'});
 assert.equal(removed.weeks[week].tasks.length,0);
 assert.equal(removed.taskHistory[0].items[0].task.done,true);
 assert.deepEqual(WeekwiseTaskHistory.restore(removed,'full').weeks,value.weeks);
});
