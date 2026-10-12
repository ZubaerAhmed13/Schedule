import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-focus.js';
const timer=globalThis.WeekwiseFocus;
const make=()=>timer.create({id:'session',owner:'user',seconds:60,task:{id:'task',week:'2026-10-11',title:'A task'}},1000);
test('pause time is excluded from focus history',()=>{
 let state=timer.resume(make(),1000);state=timer.pause(state,11000);assert.equal(timer.remaining(state,50000),50);
 state=timer.resume(state,50000);const result=timer.finish(state,60000);
 assert.equal(result.record.seconds,20);assert.equal(result.record.taskId,'task');assert.equal(result.record.completed,false);
});
test('running timer restores from persisted timestamps without restarting its duration',()=>{
 const original=timer.resume(make(),1000),restored=timer.validate(JSON.parse(JSON.stringify(original)));
 assert.equal(timer.remaining(restored,31000),30);assert.equal(timer.remaining(restored,200000),0);
 assert.equal(timer.finish(restored,200000).record.seconds,60);
});
test('breaks do not manufacture focus records',()=>{
 const state=timer.resume(timer.create({id:'break',owner:'user',mode:'long-break',seconds:900}),1000);
 assert.equal(timer.finish(state,31000).record,null);
});
test('backwards clock changes never produce negative recorded duration',()=>{
 const state=timer.resume(make(),1000);assert.equal(timer.elapsed(state,500),0);
 assert.throws(()=>timer.validate({...state,activeMs:-1}));
});
