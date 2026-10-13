import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../js/weekwise-data.js';
import '../js/weekwise-timezones.js';
import '../js/weekwise-calendar-range.js';
import '../js/weekwise-recurring-placement.js';
const data = globalThis.WeekwiseData;
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8') + "\n" + fs.readFileSync(new URL("../js/weekwise-app.js", import.meta.url), "utf8");
const task = { id:'legacy', title:'German practice', day:1, start:600, duration:30, custom:false, fixed:true, done:true, completionAt:'2026-10-01', reminderTimes:['2026-10-12T09:00'], subtasks:[{id:'s',title:'Practice',done:true}], futureField:{preserve:true} };
const fixture = () => ({ settings:{theme:'dark'}, weeks:{'2026-10-11':{notes:'Keep week metadata',tasks:[structuredClone(task)]}}, recurringTemplates:[], futureField:{keep:true} });
function functionSource(start, end) { return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))); }
function memoryStorage(initial={}, failAt) {
  const map = new Map(Object.entries(initial)); let writes=0;
  return { getItem:key=>map.get(key)??null, setItem(key,value){ if(++writes===failAt)throw new Error('quota');map.set(key,value);}, removeItem:key=>map.delete(key), map };
}
test('legacy backup retains fixed, completed, non-custom and unknown fields unchanged',()=>{
  const value=fixture(), raw=JSON.stringify({...value,app:'Weekwise',version:6});
  assert.deepEqual(data.storeFromBackup(data.parseBackup(raw)),value);
  assert.deepEqual(data.parseStore(JSON.stringify(value)),value);
});
test('backup validation rejects future versions, malformed dates, duplicate IDs and unsafe properties',()=>{
  const f=fixture();
  for(const value of [{...f,version:7},{...f,weeks:{'2026-02-30':{tasks:[]}}},{...f,weeks:{'2026-10-11':{tasks:[task,task]}}},{...f,settings:[]}])assert.throws(()=>data.parseBackup(JSON.stringify(value)));
  assert.throws(()=>data.parseBackup('{"settings":{},"weeks":{},"__proto__":{}}'));
  assert.throws(()=>data.parseBackup('x'.repeat(data.MAX_BACKUP_BYTES+1)),/10 MB/);
});
test('restore transaction retains checkpoint and rolls back all writes after quota failure',()=>{
  const s=memoryStorage({planner:'old',habits:'old-habits'},3);
  assert.throws(()=>data.commitStorage(s,[['planner','new'],['habits','new-habits']],'checkpoint'),/Previous local data was restored/);
  assert.equal(s.getItem('planner'),'old');assert.equal(s.getItem('habits'),'old-habits');
  assert.deepEqual(JSON.parse(s.getItem('checkpoint')).entries,[['planner','old'],['habits','old-habits']]);
});
test('failed checkpoint write stops before replacing any data',()=>{
  const s=memoryStorage({planner:'old'},1);
  assert.throws(()=>data.commitStorage(s,[['planner','new']],'checkpoint'));
  assert.equal(s.getItem('planner'),'old');
});
test('loadWeek preserves every legacy record, field and week metadata',()=>{
  const store=fixture();let saves=0;
  const c={store,tasks:[],currentWeek:'',JSON,materializeCurrentAndUpcoming(){},syncSettingsForm(){},renderAll(){},saveCurrent(){saves++;}};
  vm.runInNewContext(functionSource('function loadWeek(week){','function setWeekFromInput'),c);
  c.loadWeek('2026-10-11');
  assert.equal(JSON.stringify(c.tasks),JSON.stringify(store.weeks['2026-10-11'].tasks));assert.equal(saves,0);
  assert.ok(!html.includes('removeAutoPopulatedSampleData('),'no title-based startup deletion remains');
});
test('corrupt local JSON blocks saving without overwriting its original bytes',()=>{
  const storage=memoryStorage({'weekwise-planner-v2':'{broken'});
  const c={STORE_KEY:'weekwise-planner-v2',localStorage:storage,WeekwiseData:data,defaultSettings:()=>({}),JSON};
  vm.runInNewContext('let plannerStorageBlocked=false,plannerStorageError="";'+functionSource('function loadStore(){','function loadReminders()')+'\nglobalThis.blocked=()=>plannerStorageBlocked;',c);
  c.loadStore();assert.equal(c.blocked(),true);assert.equal(storage.getItem(c.STORE_KEY),'{broken');
});
test('recurrence reload preserves existing occurrence edits and history',()=>{
  const existing={...task,id:'rec_1',seriesId:'series',occurrenceDate:'2026-10-12',note:'An occurrence exception',start:900};
  const store={settings:{timeZone:'UTC'},weeks:{},recurringTemplates:[{id:'series',title:'Template',duration:60,start:600,startDate:'2026-10-12',frequency:'weekly'}]};
  const c={store,currentWeek:'2026-10-11',tasks:[existing],Date,Array,Number,dateKey:d=>d.toISOString().slice(0,10),sundayOf:d=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()-x.getUTCDay());return x;},recurrenceDateMatches:()=>true};
  c.WeekwiseRecurringPlacement=globalThis.WeekwiseRecurringPlacement;c.plannerSnapshot=()=>({store:{...c.store,weeks:{...c.store.weeks,[c.currentWeek]:{tasks:c.tasks}}},currentWeek:c.currentWeek});
  c.workspaceRecords=()=>Object.values(c.store.weeks).flatMap(w=>w.tasks||[]).concat(c.tasks).map(task=>({task}));
  vm.runInNewContext(functionSource('function materializeRecurringRange(','function materializeCurrentAndUpcoming()'),c);
  const before=JSON.stringify(existing);c.materializeRecurringRange(new Date('2026-10-12T00:00:00Z'),new Date('2026-10-12T00:00:00Z'));
  assert.equal(JSON.stringify(existing),before);assert.equal(c.tasks.length,1);
});
test('sync badge never reports synced for errors, pending writes or conflicts',()=>{
  assert.equal(data.syncLabel('Cloud save failed',true,false),'Sync failed');
  assert.equal(data.syncLabel('Changes saved on this device. Syncing to cloud…',true,false),'Syncing');
  assert.equal(data.syncLabel('All changes synced',true,true),'Needs review');
  assert.equal(data.syncLabel('All changes synced',true,false),'Synced');
});

function planBridgeFixture(options={}) {
 const storage=memoryStorage({'weekwise-planner-v2':JSON.stringify(fixture())},options.failAt);
 let bridge;
 const c={store:fixture(),currentWeek:'2026-10-11',tasks:[structuredClone(task)],cloudUser:{id:'user-a'},currentDataOwner:'user-a',cloudConflict:null,plannerStorageBlocked:false,zoneNeedsReview:()=>false,WeekwiseData:data,localStorage:storage,STORE_KEY:'weekwise-planner-v2',lastSavedDisk:storage.getItem('weekwise-planner-v2'),JSON,Date,syncSettingsForm(){},renderAll(){},queueCloudSave(){},window:{WeekwisePlanUI:{init(value){bridge=value;}}}};
 const start=html.indexOf('const plannerBridge={'),end=html.indexOf('\n};',start)+3;
 vm.runInNewContext(html.slice(start,end)+'\nwindow.WeekwisePlanUI.init(plannerBridge);',c);
 return {c,storage,get bridge(){return bridge;}};
}
test('plan bridge refuses changed account, stale snapshot and cloud conflicts before writing',()=>{
 const f=planBridgeFixture(),expected=JSON.stringify(f.bridge.snapshot()),next=fixture();next.weeks['2026-10-11'].tasks[0].start=900;
 const old=f.storage.getItem('weekwise-planner-v2');
 assert.throws(()=>f.bridge.commit(expected,'different-account',next),/account changed/);
 f.c.store.settings.theme='light';assert.throws(()=>f.bridge.commit(expected,'user-a',next),/planner changed/);
 f.c.cloudConflict={};assert.throws(()=>f.bridge.commit(expected,'user-a',next),/cloud conflict/);
 assert.equal(f.storage.getItem('weekwise-planner-v2'),old);
});
test('plan bridge does not install changes in memory when durable storage fails',()=>{
 const f=planBridgeFixture({failAt:1}),before=JSON.stringify(f.c.store),expected=JSON.stringify(f.bridge.snapshot()),next=fixture();next.weeks['2026-10-11'].tasks[0].start=900;
 assert.throws(()=>f.bridge.commit(expected,'user-a',next,'checkpoint'));
 assert.equal(JSON.stringify(f.c.store),before);assert.equal(f.c.tasks[0].start,600);
});
test('plan bridge installs one checked transaction and retains prior raw data in its checkpoint',()=>{
 const f=planBridgeFixture(),old=f.storage.getItem('weekwise-planner-v2'),expected=JSON.stringify(f.bridge.snapshot()),next=fixture();next.weeks['2026-10-11'].tasks[0].start=900;
 f.bridge.commit(expected,'user-a',next,'checkpoint');assert.equal(f.c.tasks[0].start,900);
 assert.equal(JSON.parse(f.storage.getItem('checkpoint')).entries[0][1],old);
});

test('a collection changed by another tab is rejected before overwriting its records',()=>{const s=memoryStorage({habits:'[]'});data.readCollection(s,'habits');s.setItem('habits','[{"id":"other-tab","title":"Retain"}]');assert.throws(()=>data.writeCollection(s,'habits',[]),/Another tab/);assert.equal(JSON.parse(s.getItem('habits'))[0].id,'other-tab');assert.throws(()=>data.commitStorage(s,[['habits','[]']],'checkpoint'),/Another tab/);assert.equal(s.getItem('checkpoint'),null);});

test('successive checked writes from the same tab refresh the baseline',()=>{const s=memoryStorage({planner:'first'});data.commitStorage(s,[['planner','second']]);data.commitStorage(s,[['planner','third']]);assert.equal(s.getItem('planner'),'third');s.setItem('planner','other-tab');assert.throws(()=>data.commitStorage(s,[['planner','stale']]),/Another tab/);assert.equal(s.getItem('planner'),'other-tab');});

test('malformed habit history and focus measurements are rejected without replacing raw records',()=>{const raw='[{"id":"h","title":"Retain","checkIns":{"original":"bad"}}]',s=memoryStorage({'weekwise-habits-v1':raw});assert.deepEqual(data.readCollection(s,'weekwise-habits-v1'),[]);assert.equal(s.getItem('weekwise-habits-v1'),raw);assert.ok(data.blockedKeys().includes('weekwise-habits-v1'));assert.throws(()=>data.writeCollection(s,'weekwise-habits-v1',[]),/needs recovery/);data.clearBlocked(['weekwise-habits-v1']);assert.throws(()=>data.validateCollection([{minutes:-1}], 'focusSessions'),/focus time/);assert.throws(()=>data.parseBackup(JSON.stringify({...fixture(),habits:[{checkIns:{}}]})),/habit checkIns/);});
