import test from 'node:test';import assert from 'node:assert/strict';
import '../js/weekwise-data.js';import '../js/weekwise-timezones.js';import '../js/weekwise-calendar-range.js';import '../js/weekwise-reminder-policy.js';
import {exposeController} from './application-source.mjs';
function fixture({fail=false,storageFail=false}={}){
 const at=Date.now(),date=new Date(at+10*60000),day=date.getUTCDay(),week=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-day)).toISOString().slice(0,10);
 const task={id:'reminder',title:'Upcoming activity',day,start:date.getUTCHours()*60+date.getUTCMinutes(),duration:30},disk=new Map(),alerts=[],toasts=[],actions=[];
 const context={Date,Set,Map,JSON,Number,String,Array,Promise,console,WeekwiseReminderPolicy,Notification:class{static permission='granted';constructor(title,options){if(fail)throw Error('unsupported constructor');alerts.push({title,options});}},navigator:{},localStorage:{getItem:k=>disk.get(k)||null,setItem(k,v){if(storageFail)throw Error('quota');disk.set(k,v);}},document:{hidden:false},zoneNeedsReview:()=>false,currentDataOwner:'local',cloudUser:null,store:{settings:{timeZone:'UTC',reminderLeadMinutes:15}},workspaceRecords:()=>[{week,task}],showToast:(message,label,callback)=>{toasts.push(message);if(label&&callback)actions.push({label,callback});},saveCurrent:()=>{throw Error('reminder delivery must not save planner');},saveStore:()=>{throw Error('reminder delivery must not save planner');},renderAll:()=>{},taskReminderTimes:t=>t.reminderTimes||[],currentWeek:week,$:()=>null};
 context.window=context;exposeController(context,'notifications',['checkTaskReminders']);return {context,task,disk,alerts,toasts,actions};
}
test('automatic foreground delivery is deduplicated without changing planner records',async()=>{
 const f=fixture(),before=JSON.stringify(f.task);await f.context.checkTaskReminders();await f.context.checkTaskReminders();
 assert.equal(f.alerts.length,1);assert.match(f.alerts[0].options.body,/starts/);assert.equal(JSON.stringify(f.task),before);
});
test('notification failures use an in-app fallback without pretending system delivery succeeded',async()=>{
 const f=fixture({fail:true});await f.context.checkTaskReminders();await f.context.checkTaskReminders();
 assert.equal(f.alerts.length,0);assert.equal(f.toasts.length,1);assert.match(f.toasts[0],/Upcoming activity/);
});
test('denied permission and unavailable storage keep useful fallback and per-tab deduplication',async()=>{
 const f=fixture({storageFail:true});f.context.Notification.permission='denied';await f.context.checkTaskReminders();await f.context.checkTaskReminders();assert.equal(f.toasts.length,1);assert.equal(f.alerts.length,0);
});
test('signed-out accounts and locked planners cannot surface private reminders',async()=>{
 const f=fixture();f.context.currentDataOwner='previous-owner';await f.context.checkTaskReminders();assert.equal(f.alerts.length,0);
});
test('queued browser locks recheck the owner before delivering a private reminder',async()=>{
 const f=fixture();let resume;f.context.navigator.locks={request:(_name,run)=>new Promise(resolve=>{resume=()=>resolve(run());})};
 const pending=f.context.checkTaskReminders();f.context.currentDataOwner='someone-else';f.context.cloudUser={id:'someone-else'};await resume();await pending;assert.equal(f.alerts.length,0);
});
test('a hidden tab defers in-app fallback until the planner becomes visible',async()=>{
 const f=fixture();f.context.Notification.permission='denied';f.context.document.hidden=true;await f.context.checkTaskReminders();assert.equal(f.toasts.length,0);f.context.document.hidden=false;await f.context.checkTaskReminders();assert.equal(f.toasts.length,1);
});
for(const change of ['off','rescheduled','completed'])test('a pending service-worker alert is revalidated when '+change,async()=>{
 const f=fixture({fail:true});let release;const sent=[];
 f.context.navigator.serviceWorker={getRegistration:()=>new Promise(resolve=>{release=()=>resolve({showNotification:async(...args)=>sent.push(args)});})};
 const pending=f.context.checkTaskReminders();assert.equal(typeof release,'function');
 if(change==='off')f.context.store.settings.reminderLeadMinutes=0;
 if(change==='rescheduled')f.task.start+=60;
 if(change==='completed')f.task.done=true;
 release();await pending;assert.equal(sent.length,0);assert.equal(f.toasts.length,0);
});

test('same-activity grouping uses a stable owner-scoped tag and can be turned off',async()=>{
 const first=fixture();await first.context.checkTaskReminders();
 assert.equal(first.alerts[0].options.tag,'weekwise-task-local-reminder');
 const second=fixture();second.context.store.settings.reminderGroupByTask=false;await second.context.checkTaskReminders();
 assert.match(second.alerts[0].options.tag,/^weekwise-task-local-reminder-2030|^weekwise-task-local-reminder-/);
 assert.notEqual(second.alerts[0].options.tag,first.alerts[0].options.tag);
});
test('foreground snooze is explicit, owner-scoped, bounded and never edits planner tasks',async()=>{
 const f=fixture();f.task.reminderAt=new Date(Date.now()-60000).toISOString();
 const before=JSON.stringify(f.task);
 await f.context.checkTaskReminders();assert.equal(f.actions[0].label,'Snooze 10 min');
 f.actions[0].callback();
 const key='weekwise-alert-snoozes-v1:local',items=JSON.parse(f.disk.get(key));
 assert.equal(items.length,1);assert.ok(items[0].until>Date.now());
 items[0].until=Date.now()-1000;f.disk.set(key,JSON.stringify(items));
 await f.context.checkTaskReminders();assert.equal(f.alerts.length,2);
 assert.deepEqual(JSON.parse(f.disk.get(key)),[]);assert.equal(JSON.stringify(f.task),before);
});
