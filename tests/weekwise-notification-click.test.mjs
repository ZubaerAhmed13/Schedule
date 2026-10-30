import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('notification clicks focus an existing planner without navigating away from unsaved work',async()=>{
 const handlers={},navigations=[],opened=[];let focused=0,complete;
 const client={url:'https://example.invalid/Schedule/?view=settings',focus:async()=>{focused++;return client;},navigate:async url=>navigations.push(url)};
 const self={registration:{scope:'https://example.invalid/Schedule/'},location:{origin:'https://example.invalid'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{matchAll:async()=>[client],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,URL,Set,Promise,console});
 handlers.notificationclick({notification:{data:{url:'https://example.invalid/Schedule/'},close(){}},waitUntil:promise=>{complete=promise;}});await complete;
 assert.equal(focused,1);assert.deepEqual(navigations,[]);assert.deepEqual(opened,[]);
});
