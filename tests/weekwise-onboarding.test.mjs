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
