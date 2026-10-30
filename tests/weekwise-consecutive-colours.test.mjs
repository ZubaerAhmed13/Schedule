import test from 'node:test';import assert from 'node:assert/strict';import '../js/weekwise-task-options.js';
const r=(id,start,duration=30,taskColor='auto',date='2030-01-07')=>({date,start,duration,task:{id,taskColor}});
test('consecutive automatic activities receive different deterministic accents without mutations',()=>{
 const records=[r('a',600),r('b',630),r('c',660)],before=structuredClone(records),result=WeekwiseTaskOptions.consecutive(records);
 assert.notEqual(result.get(records[0]),result.get(records[1]));assert.notEqual(result.get(records[1]),result.get(records[2]));
 const reordered=WeekwiseTaskOptions.consecutive([...records].reverse());for(const item of records)assert.equal(result.get(item),reordered.get(item));
 assert.deepEqual(records,before);
});
test('real gaps, overlaps alone, separate dates and all-day records keep category appearance',()=>{
 for(const records of [[r('a',600),r('b',635)],[r('a',600),r('b',615)],[r('a',600),r('b',630,30,'auto','2030-01-08')],[{...r('a',600),allDay:true},r('b',630)]]){
 const result=WeekwiseTaskOptions.consecutive(records);for(const item of records)assert.equal(result.get(item),undefined);
 }
});
test('manual neighbours remain chosen colours and automatic blocks avoid both sides',()=>{
 const records=[r('a',600,30,'blue'),r('b',630),r('c',660,30,'purple')],result=WeekwiseTaskOptions.consecutive(records);
 assert.equal(result.get(records[0]),'blue');assert.equal(result.get(records[2]),'purple');
 assert.ok(!['blue','purple'].includes(result.get(records[1])));
 assert.match(WeekwiseTaskOptions.attributes({taskColor:'blue'},'purple'),/data-task-color="blue"/);
 assert.match(WeekwiseTaskOptions.attributes({taskColor:'auto'},result.get(records[1])),/data-task-color/);
});
test('invalid durations and unscheduled records do not enter the adjacency palette',()=>{
 const records=[r('a',600,0),r('b',600),{...r('c',630),task:{id:'c',unscheduled:true}}];
 assert.equal(WeekwiseTaskOptions.consecutive(records).size,0);
});
