import test from 'node:test';import assert from 'node:assert/strict';import '../js/weekwise-data.js';import '../js/weekwise-drafts.js';
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const draft=(sessionId='session')=>({version:2,owner:'owner',sessionId,week:'2026-10-11',base:null,fields:{editTaskId:'',modalTitleInput:'Retain my note',modalNoSchedule:true}});
test('drafts are owner scoped, reject unsafe fields and preserve malformed raw bytes',()=>{assert.throws(()=>WeekwiseDrafts.parse(JSON.stringify(draft()),'other'),/different planner/);assert.throws(()=>WeekwiseDrafts.parse(JSON.stringify({...draft(),fields:{constructor:'bad'}}),'owner'),/Unsupported field/);const s=storage(),raw='{original damaged';s.setItem(WeekwiseDrafts.key('owner'),raw);assert.ok(WeekwiseDrafts.read(s,'owner').error);assert.throws(()=>WeekwiseDrafts.save(s,draft()),/damaged editor draft/);assert.equal(s.getItem(WeekwiseDrafts.key('owner')),raw);});
test('new draft sessions archive prior records and checked discard permits a later draft',()=>{const s=storage();WeekwiseDrafts.save(s,draft('one'));const old=s.getItem(WeekwiseDrafts.key('owner'));WeekwiseDrafts.save(s,draft('two'));assert.ok([...s.map].some(([key,raw])=>key.includes('-archive-')&&raw===old));const current=s.getItem(WeekwiseDrafts.key('owner'));WeekwiseDrafts.discard(s,'owner',current);assert.equal(s.getItem(WeekwiseDrafts.key('owner')),null);WeekwiseDrafts.save(s,draft('three'));assert.equal(WeekwiseDrafts.read(s,'owner').draft.sessionId,'three');});
test('changed drafts cannot be discarded from a stale tab',()=>{const s=storage();WeekwiseDrafts.save(s,draft());const old=s.getItem(WeekwiseDrafts.key('owner'));s.setItem(WeekwiseDrafts.key('owner'),JSON.stringify(draft('other-tab')));assert.throws(()=>WeekwiseDrafts.discard(s,'owner',old),/changed in another tab/);assert.equal(WeekwiseDrafts.read(s,'owner').draft.sessionId,'other-tab');});
test('legacy field-only drafts remain recoverable as copies',()=>{const value=WeekwiseDrafts.parse(JSON.stringify({editTaskId:'legacy',modalTitleInput:'Retain'}),'owner');assert.equal(value.version,1);assert.equal(value.base,null);assert.equal(value.week,null);assert.equal(value.fields.modalTitleInput,'Retain');});

test('editor history export includes raw damaged archives without touching their bytes',()=>{
 const s=storage();s.key=i=>[...s.map.keys()][i]??null;Object.defineProperty(s,'length',{get:()=>s.map.size});
 WeekwiseDrafts.save(s,draft('one'));WeekwiseDrafts.save(s,draft('two'));
 s.setItem('weekwise-editor-draft-archive-v1:owner:broken','{raw damaged backup');
 s.setItem('weekwise-editor-draft-archive-v1:other:private','secret other owner');
 s.setItem('weekwise-editor-draft-v1:other','private current');
 const before=[...s.map.entries()];
 const result=WeekwiseDrafts.exportHistory(s,'owner');
 assert.equal(result.kind,'editor-draft-history');
 assert.equal(result.owner,'owner');
 assert.equal(result.entries.length,3);
 assert.equal(result.entries.find(e=>e.key.endsWith(':broken')).raw,'{raw damaged backup');
 assert.ok(result.entries.every(e=>e.key.includes(':owner')));
 assert.deepEqual([...s.map.entries()],before);
});
test('editor history export refuses overlarge archives and preserves originals',()=>{
 const s=storage();s.key=i=>[...s.map.keys()][i]??null;Object.defineProperty(s,'length',{get:()=>s.map.size});
 s.setItem('weekwise-editor-draft-archive-v1:owner:large','x'.repeat(10*1024*1024+1));
 assert.throws(()=>WeekwiseDrafts.exportHistory(s,'owner'),/too large/);
 assert.equal(s.map.size,1);
 assert.throws(()=>WeekwiseDrafts.exportHistory(s,'owner:other'),/Invalid planner owner/);
});
