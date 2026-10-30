import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../weekwise-push.js',import.meta.url),'utf8');
const flush=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
test('late background status from the old account cannot overwrite the new account controls',async()=>{
 const elements=new Map(['toggleBackgroundPushBtn','backgroundPushStatus'].map(id=>[id,{textContent:'',dataset:{},addEventListener(){}}]));
 let authListener,owner='first',oldResponse;const timers=[];
 const sdk={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),onAuthStateChange:fn=>{authListener=fn;}},functions:{invoke:async()=>owner==='first'?await new Promise(resolve=>oldResponse=()=>resolve({data:{enabled:true,timezone:'UTC'}})):({data:{enabled:false}})}};
 const context={document:{readyState:'complete',getElementById:id=>elements.get(id)},navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>({endpoint:'fixture'})}}),ready:new Promise(()=>{})}},Notification:{permission:'granted'},PushManager:function(){},setTimeout:(fn,delay)=>{if(!delay)timers.push(fn);return 1;},clearTimeout(){},addEventListener(){},weekwiseCloudClient:sdk,Intl,Error,Promise,console};context.window=context;
 vm.runInNewContext(source,context);await flush();assert.equal(typeof oldResponse,'function');
 owner='second';authListener();while(timers.length)timers.shift()();await flush();oldResponse();await flush();
 assert.match(elements.get('backgroundPushStatus').textContent,/not linked/);
 assert.equal(elements.get('toggleBackgroundPushBtn').textContent,'Enable background reminders');
});

test('a hung background service returns actionable controls after a bounded timeout',async()=>{
 const elements=new Map(['toggleBackgroundPushBtn','backgroundPushStatus'].map(id=>[id,{textContent:'',dataset:{},addEventListener(){}}]));const timers=[];
 const context={document:{readyState:'complete',getElementById:id=>elements.get(id)},navigator:{},weekwiseCloudClient:{auth:{getSession:()=>new Promise(()=>{}),onAuthStateChange(){}}},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){},addEventListener(){},Error,Promise,console};context.window=context;
 vm.runInNewContext(source,context);await flush();const timeout=timers.find(t=>t.delay===15000);assert.ok(timeout,'the service check must have a timeout');timeout.fn();await flush();assert.equal(elements.get('toggleBackgroundPushBtn').disabled,false);assert.match(elements.get('backgroundPushStatus').textContent,/timed out/i);
});

test('enabling reminders during an old status refresh cannot strand the button at Working',async()=>{
 const elements=new Map(['toggleBackgroundPushBtn','backgroundPushStatus'].map(id=>[id,{textContent:'',dataset:{},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}}]));let releaseOld,statusCalls=0,enabled=false;
 const subscription={endpoint:'fixture',toJSON:()=>({endpoint:'fixture'})};
 const sdk={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}}),onAuthStateChange(){}},functions:{invoke:async(_name,{body})=>{if(body.action==='status'&&++statusCalls===1)return await new Promise(resolve=>{releaseOld=()=>resolve({data:{enabled:false}});});if(body.action==='subscribe')enabled=true;return {data:{enabled}};}}};
 const context={document:{readyState:'complete',getElementById:id=>elements.get(id)},navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>subscription}}),ready:new Promise(()=>{})}},Notification:{permission:'granted'},PushManager:function(){},setTimeout:()=>1,clearTimeout(){},addEventListener(){},weekwiseCloudClient:sdk,Intl,Error,Promise,console};context.window=context;
 vm.runInNewContext(source,context);await flush();assert.equal(typeof releaseOld,'function');await elements.get('toggleBackgroundPushBtn').listeners.click();releaseOld();await flush();
 assert.equal(elements.get('toggleBackgroundPushBtn').disabled,false);assert.equal(elements.get('toggleBackgroundPushBtn').textContent,'Disable background reminders');
});

test('a previous account toggle error cannot replace current status after its final probe resolves',async()=>{
 const elements=new Map(['toggleBackgroundPushBtn','backgroundPushStatus'].map(id=>[id,{textContent:'',dataset:{},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}}]));let authListener,owner='first',statusCalls=0,releaseProbe;const timers=[];
 const subscription={endpoint:'fixture',toJSON:()=>({endpoint:'fixture'})};
 const sdk={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),onAuthStateChange:fn=>{authListener=fn;}},functions:{invoke:async()=>{statusCalls++;if(statusCalls===2)return {error:{message:'Old private account error'}};if(statusCalls===3)return await new Promise(resolve=>{releaseProbe=()=>resolve({data:{enabled:false}});});return {data:{enabled:false}};}}};
 const context={document:{readyState:'complete',getElementById:id=>elements.get(id)},navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>subscription}}),ready:new Promise(()=>{})}},Notification:{permission:'granted'},PushManager:function(){},setTimeout:(fn,delay)=>{if(!delay)timers.push(fn);return 1;},clearTimeout(){},addEventListener(){},weekwiseCloudClient:sdk,Intl,Error,Promise,console};context.window=context;
 vm.runInNewContext(source,context);await flush();const pending=elements.get('toggleBackgroundPushBtn').listeners.click();for(let i=0;i<3;i++)await flush();assert.equal(typeof releaseProbe,'function');owner='second';authListener();while(timers.length)timers.shift()();await flush();releaseProbe();await pending;await flush();assert.doesNotMatch(elements.get('backgroundPushStatus').textContent,/Old private account error/);assert.match(elements.get('backgroundPushStatus').textContent,/not linked/);
});
