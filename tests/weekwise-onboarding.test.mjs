import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-onboarding.js';
const guide=globalThis.WeekwiseOnboarding;
function storage(){
 const map=new Map();
 return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),map};
}
test('the getting-started guide is optional, account-isolated, and never modifies planner data',()=>{
 const storage1=storage(),accountA='user:first',accountB='user:second';
 assert.equal(guide.visible(storage1,accountA,false),true);
 assert.equal(guide.visible(storage1,accountA,true),false);
 assert.equal(guide.setMode(storage1,accountA,'dismissed'),true);
 assert.equal(guide.visible(storage1,accountA,false),false);
 assert.equal(guide.visible(storage1,accountB,false),true);
 assert.equal(guide.setMode(storage1,accountA,'shown'),true);
 assert.equal(guide.visible(storage1,accountA,true),true);
 assert.ok([...storage1.map.keys()].every(key=>key.startsWith('weekwise-onboarding-v1:')));
 assert.notEqual(guide.key(accountA),guide.key(accountB));
 assert.throws(()=>guide.key(''),/Invalid planner owner/);
});
test('the optional guide remains usable if local preferences cannot be saved',()=>{
 const blocked={getItem(){throw new Error('Storage unavailable')},setItem(){throw new Error('Quota')}};
 assert.equal(guide.visible(blocked,'local',false),true);
 assert.equal(guide.setMode(blocked,'local','dismissed'),false);
 assert.equal(guide.markup().includes('data-experience-capture'),true);
 assert.equal(guide.markup().includes('data-experience-plan'),true);
 assert.equal(guide.markup().includes('data-experience-calendar'),true);
 assert.equal(guide.markup().includes('data-experience-guide-dismiss'),true);
 assert.throws(()=>guide.setMode(storage(),'local','wrong'),/Unsupported/);
});
test('a started guide continues after capture and finishes from saved planning evidence',()=>{
 const s=storage();guide.setMode(s,'a','started');const records=[{task:{start:null,unscheduled:true}}];
 assert.equal(guide.visible(s,'a',true,false),true);assert.deepEqual(guide.progress(records,{settings:{}}).steps,[true,false,false]);
 const planned=guide.progress([{task:{start:540,unscheduled:false}}],{settings:{planning:{days:[1]}}});assert.equal(planned.complete,true);assert.equal(guide.visible(s,'a',true,planned.complete),false);
 assert.equal(guide.visible(s,'b',true,false),false,'existing users do not get a new forced guide');guide.setMode(s,'a','shown');assert.equal(guide.visible(s,'a',true,true),true);
 assert.equal(guide.progress([{task:{start:540,unscheduled:true}}],{settings:{}}).steps[2],false);assert.equal(guide.progress([{task:{start:null}}],{settings:{}}).steps[2],false);
});
