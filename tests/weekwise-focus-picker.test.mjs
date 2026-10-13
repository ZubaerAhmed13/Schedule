import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-focus-picker.js';

const records=()=>Array.from({length:10000},(_,id)=>({week:'2026-10-11',date:new Date(2026,9,11),task:{id:String(id),title:'Responsibility '+id,done:false}}));

test('focus selection keeps every page bounded without mutating 10,000 tasks',()=>{
 const rows=records(),before=JSON.stringify(rows);
 const first=WeekwiseFocusPicker.page(rows),next=WeekwiseFocusPicker.page(rows,{index:1});
 assert.equal(first.items.length,100);assert.equal(first.total,10000);assert.equal(first.hasPrevious,false);assert.equal(first.hasNext,true);
 assert.equal(next.items.length,100);assert.equal(next.items[0].task.id,'100');assert.equal(next.start,101);assert.equal(next.end,200);
 assert.equal(JSON.stringify(rows),before);
});
test('focus search finds title, note, folder, section and tags outside the initial page',()=>{
 const rows=records();Object.assign(rows[9999].task,{note:'German practice',folderName:'Languages',sectionName:'Evening',tags:['B1']});
 for(const query of ['9999',' GERMAN PRACTICE ','languages','evening','b1']){
  const result=WeekwiseFocusPicker.page(rows,{query,index:99});assert.equal(result.total,1);assert.equal(result.index,0);assert.equal(result.items[0].task.id,'9999');
 }
});
test('selected tasks stay visible outside the page or search without changing match counts',()=>{
 const rows=records(),selectedRef=WeekwiseFocusPicker.ref(rows[9999]);
 let result=WeekwiseFocusPicker.page(rows,{selectedRef});assert.equal(result.items.length,100);assert.equal(result.pinned.task.id,'9999');assert.equal(result.total,10000);
 result=WeekwiseFocusPicker.page(rows,{selectedRef,query:'no match'});assert.equal(result.items.length,0);assert.equal(result.pinned.task.id,'9999');assert.equal(result.total,0);
 result=WeekwiseFocusPicker.page(rows,{selectedRef,query:'9999'});assert.equal(result.pinned,null);
});
test('a completed session task stays pinned while other completed tasks stay excluded',()=>{
 const rows=records();rows[0].task.done=true;rows[9999].task.done=true;
 const result=WeekwiseFocusPicker.page(rows,{selectedRef:WeekwiseFocusPicker.ref(rows[9999])});
 assert.equal(result.total,9998);assert.equal(result.pinned.task.done,true);assert.ok(result.items.every(record=>!record.task.done));
});
test('a removed session task retains its captured identity without creating a canonical task',()=>{
 const rows=records(),sessionTask={id:'removed',week:'2026-10-04',title:'Original responsibility'};
 const result=WeekwiseFocusPicker.page(rows,{selectedRef:'2026-10-04::removed',sessionTask});
 assert.equal(result.pinned.task.title,sessionTask.title);assert.equal(result.pinned.unavailable,true);assert.equal(rows.length,10000);
 assert.equal(WeekwiseFocusPicker.page(rows,{selectedRef:'2026-10-11::removed',sessionTask}).pinned,null);
});
test('page bounds adapt to empty or shortened results and invalid indices',()=>{
 const rows=records();assert.equal(WeekwiseFocusPicker.page(rows,{index:999}).index,99);
 for(const index of [-1,NaN,1.5])assert.equal(WeekwiseFocusPicker.page(rows,{index}).index,0);
 const empty=WeekwiseFocusPicker.page([],{index:9});assert.equal(empty.start,0);assert.equal(empty.end,0);assert.equal(empty.hasNext,false);assert.equal(empty.hasPrevious,false);
});
