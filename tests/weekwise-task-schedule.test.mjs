import test from 'node:test';import assert from 'node:assert/strict';
import '../js/weekwise-data.js';import '../js/weekwise-timezones.js';import '../js/weekwise-calendar-range.js';import '../js/weekwise-task-schedule.js';
const model=WeekwiseTaskSchedule,fixture=()=>({settings:{timeZone:'UTC'},weeks:{'2030-01-06':{tasks:[]},'2030-01-13':{tasks:[]}}});
test('overnight editor arithmetic requires an explicit next day and stays within 24 hours',()=>{assert.equal(model.duration(1410,60,true),90);assert.equal(model.duration(1380,1440),60);assert.equal(model.duration(600,600,true),1440);assert.throws(()=>model.duration(1410,60,false),/next day/);assert.throws(()=>model.duration(600,900,true),/within 24/);assert.throws(()=>model.duration(1440,60,true),/valid 24-hour/);});
test('an overnight placement retains its canonical source week and exact next-day instant',()=>{const value=fixture(),raw=JSON.stringify(value),slot=model.placement(value,{week:'2030-01-06',day:6,start:1410,duration:90});assert.equal(slot.week,'2030-01-06');assert.equal(slot.day,6);assert.equal(slot.start,1410);assert.equal(slot.duration,90);assert.equal(new Date(slot.scheduleInstant.end).toISOString(),'2030-01-13T01:00:00.000Z');assert.equal(JSON.stringify(value),raw);});
test('next-week activities and carried all-day spans block overnight slots without moving them',()=>{const value=fixture();value.weeks['2030-01-13'].tasks.push({id:'busy',title:'Next Sunday',day:0,start:30,duration:60});assert.throws(()=>model.placement(value,{week:'2030-01-06',day:6,start:1410,duration:90}),/overnight.*overlaps/);value.weeks['2030-01-13'].tasks=[];value.weeks['2030-01-06'].tasks.push({id:'trip',title:'Two-day trip',day:5,start:null,allDay:true,duration:2880});assert.throws(()=>model.placement(value,{week:'2030-01-06',day:6,start:1410,duration:90}),/overlaps/);});
test('same-day search sees previous-night spills, keeps exact free minutes and retains unchanged legacy overlaps',()=>{const value=fixture();value.weeks['2030-01-06'].tasks.push({id:'overnight',title:'Carried busy',day:6,start:1410,duration:90});const shifted=model.placement(value,{week:'2030-01-13',day:0,start:30,duration:30});assert.equal(shifted.start,60);assert.equal(model.placement(value,{week:'2030-01-13',day:1,start:607,duration:30}).start,607);value.weeks['2030-01-13'].tasks.push({id:'legacy',title:'Existing overlap',day:0,start:30,duration:30});assert.equal(model.placement(value,{week:'2030-01-13',id:'legacy',day:0,start:30,duration:30}).start,30);});
test('new DST gaps, folds and discontinuities require review; exact Calendar fold captures stay valid',()=>{const value=fixture();value.settings.timeZone='Europe/Berlin';value.weeks['2030-03-31']={tasks:[]};value.weeks['2030-10-27']={tasks:[]};for(const args of [{week:'2030-03-31',day:0,start:150,duration:30},{week:'2030-10-27',day:0,start:150,duration:30},{week:'2030-03-31',day:0,start:90,duration:120}])assert.throws(()=>model.placement(value,args),/Nonexistent|Ambiguous|clock change/);const exact=WeekwiseCalendarRange.slot('2030-10-27',30,30,'UTC','Europe/Berlin');assert.equal(model.placement(value,{...exact,exact}).scheduleInstant.start,exact.scheduleInstant.start);});
test('dated editor choices cover Monday through Sunday across canonical weeks and years',()=>{
 const choices=WeekwiseTaskSchedule.dateChoices('2026-12-31');
 assert.deepEqual(choices.map(c=>c.date),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.deepEqual(choices.map(c=>c.day),[1,2,3,4,5,6,0]);
 assert.equal(choices[6].week,'2027-01-03');
 assert.equal(WeekwiseTaskSchedule.destination('2026-10-25').week,'2026-10-25');
 assert.throws(()=>WeekwiseTaskSchedule.destination('2026-02-30'),/valid activity date/);
});
test('relocating an edited task retains its identity, metadata, reminder instants and unrelated records',()=>{
 const task={id:'retained',title:'Original',day:2,start:600,duration:30,customMetadata:{source:'old'},reminderTimes:['2026-10-13T09:00'],reminderInstants:{'2026-10-13T09:00':'2026-10-13T07:00:00.000Z'},seriesId:'series',occurrenceDate:'2026-10-13',recurrenceOverride:true};
 const store={settings:{timeZone:'Europe/Berlin'},weeks:{'2026-10-11':{tasks:[task,{id:'other',title:'Keep',day:3,start:null,duration:30}],notes:'Keep week notes'}},recurringTemplates:[]};
 const before=JSON.stringify(store),next=WeekwiseTaskSchedule.relocate(store,'2026-10-11','retained','2026-10-25');
 assert.equal(JSON.stringify(store),before);assert.equal(next.weeks['2026-10-11'].notes,'Keep week notes');
 assert.deepEqual(next.weeks['2026-10-11'].tasks.map(t=>t.id),['other']);
 assert.deepEqual(next.weeks['2026-10-25'].tasks[0],{...task,day:0});
 const duplicate=structuredClone(store);duplicate.weeks['2026-10-25']={tasks:[{...task}]};
 assert.throws(()=>WeekwiseTaskSchedule.relocate(duplicate,'2026-10-11','retained','2026-10-25'),/already exists/);
 assert.equal(duplicate.weeks['2026-10-11'].tasks.length,2);
});
