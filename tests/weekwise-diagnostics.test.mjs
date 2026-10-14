import test from 'node:test';import assert from 'node:assert/strict';
import '../js/weekwise-data.js';import '../js/weekwise-diagnostics.js';import '../js/weekwise-account-privacy.js';
const api=globalThis.WeekwiseDiagnostics,build='1234567890abcdef';
function storage(){const map=new Map();return {map,get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}}
test('diagnostics require explicit owner consent and drop private event fields',()=>{
 const s=storage(),event={operation:'sync-save',outcome:'failed',build,durationMs:91.8,message:'Private task and token',url:'https://private.invalid',owner:'private-user'};
 assert.equal(api.record(s,'a',event),false);assert.equal(s.map.size,0);api.configure(s,'a',true);assert.equal(api.record(s,'a',event),true);
 assert.equal(api.read(s,'b').value.enabled,false);const saved=api.read(s,'a').value;assert.equal(saved.events[0].durationMs,92);assert.doesNotMatch(JSON.stringify(saved),/Private|token|private-user|https/);
 api.configure(s,'a',false);const before=s.getItem(api.key('a'));assert.equal(api.record(s,'a',event),false);assert.equal(s.getItem(api.key('a')),before);
});
test('diagnostics bound history, isolate builds, reject malformed bytes and clear without planner writes',()=>{
 const s=storage();s.setItem('weekwise-planner-v2','private canonical bytes');api.configure(s,'a',true);for(let i=0;i<110;i++)api.record(s,'a',{operation:'sync-read',outcome:i%2?'success':'failed',build,durationMs:i});
 assert.equal(api.read(s,'a').value.events.length,80);assert.equal(api.summary(api.read(s,'a').value,build).events,80);assert.equal(api.summary(api.read(s,'a').value,'another-build').events,0);
 const erased=globalThis.WeekwiseAccountPrivacy.ownedEntries(s,'a');assert.equal(erased.length,1);globalThis.WeekwiseAccountPrivacy.removeOwned(s,erased);assert.equal(s.getItem('weekwise-planner-v2'),'private canonical bytes');
 s.setItem(api.key('a'),'{broken');assert.throws(()=>api.read(s,'a'),/retained/);assert.equal(s.getItem(api.key('a')),'{broken');
});
