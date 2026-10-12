import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-calendar-layout.js';
const layout=globalThis.WeekwiseCalendarLayout;
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');

test('month and year grids rotate week headers without changing calendar dates',()=>{
 assert.deepEqual(layout.weekdays(0),[0,1,2,3,4,5,6]);
 assert.deepEqual(layout.weekdays(1),[1,2,3,4,5,6,0]);
 const sunday=layout.month(2026,9,0),monday=layout.month(2026,9,1);
 assert.equal(dateKey(sunday.start),'2026-09-27');
 assert.equal(dateKey(monday.start),'2026-09-28');
 assert.equal(sunday.count,35);
 assert.equal(monday.count,35);
 assert.deepEqual(monday.weekdays.map(i=>layout.DAY_SHORT[i]),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
});
test('month layout handles leap days and calendar years without DST drift',()=>{
 for(const [year,month] of [[2024,1],[2026,2],[2026,9],[2026,10],[2027,0],[2030,11]]){
  for(const firstDay of [0,1]){
   const grid=layout.month(year,month,firstDay);
   assert.ok(grid.count===28||grid.count===35||grid.count===42);
   let previous=null;
   for(let i=0;i<grid.count;i++){
    const d=new Date(grid.start);
    d.setDate(grid.start.getDate()+i);
    if(previous){assert.equal(dateKey(d)!==dateKey(previous),true);assert.equal(Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(previous.getFullYear(),previous.getMonth(),previous.getDate()))/86400000),1);}
    previous=d;
   }
   assert.equal(grid.start.getDay(),firstDay);
  }
 }
});
test('unexpected preference values use stable Sunday first; invalid months fail',()=>{
 assert.equal(layout.firstDay(undefined),0);assert.equal(layout.firstDay('1'),1);assert.equal(layout.firstDay(7),0);
 assert.throws(()=>layout.month(2026,12,1),/valid calendar/);
 assert.throws(()=>layout.month(2026,-1,1),/valid calendar/);
});
