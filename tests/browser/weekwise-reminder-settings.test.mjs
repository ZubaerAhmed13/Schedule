import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium} from 'playwright';import axe from 'axe-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),site=path.resolve(root,process.env.WEEKWISE_TEST_SITE_ROOT||'dist');let browser,server,origin;
const fixture=()=>({settings:{timeZone:'UTC'},weeks:{'2030-01-06':{notes:'Keep notes',tasks:[{id:'first',title:'First activity',day:2,start:600,duration:30,done:false,taskColor:'auto',custom:true},{id:'second',title:'Second activity',day:2,start:630,duration:30,done:false,taskColor:'auto',custom:true},{id:'manual',title:'Chosen colour',day:2,start:660,duration:30,done:false,taskColor:'purple',custom:true}]}},recurringTemplates:[],customLists:[]});
before(async()=>{fs.mkdirSync(path.join(root,'test-results'),{recursive:true});server=http.createServer((req,res)=>{const file=path.resolve(site,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)),target=file===site?path.join(site,'index.html'):file;if(!target.startsWith(site+path.sep)){res.writeHead(403).end();return;}fs.readFile(target,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[path.extname(target)]||'application/octet-stream'}).end(bytes);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function open(width=1280,{permission='default'}={}){
 const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'UTC',serviceWorkers:'block'});await context.addInitScript(({store,permission})=>{
  const Original=Date;window.Date=class extends Original{constructor(...args){super(...(args.length?args:['2030-01-08T09:50:00Z']));}static now(){return Original.parse('2030-01-08T09:50:00Z');}};
  if(!localStorage.getItem('weekwise-planner-v2')){localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));localStorage.setItem('weekwise-local-mode-v1','true');}
  window.__permissionRequests=0;window.Notification=class{static permission=permission;static async requestPermission(){window.__permissionRequests++;return permission;}constructor(){throw Error('Controlled platform denial');}};
 },{store:fixture(),permission});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/?view=today',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);return {page,context,errors};
}
async function navigate(page,view){const button=page.locator('#workspaceSidebar [data-workspace-view="'+view+'"]');if(!await button.isVisible())await page.locator('#mobileNavigationToggle').click();await button.click();}
async function settings(page){await navigate(page,'settings');await page.locator('[data-settings-category="reminders"]').click();}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-planner-v2')));
test('timing choices apply to existing activities, persist across reload, and retain custom data',async()=>{
 const {page,context,errors}=await open();try{await settings(page);assert.deepEqual(await page.locator('#notificationLeadMinutes option').allTextContents(),['Off','5 minutes before','15 minutes before','1 hour before']);const before=(await saved(page)).weeks;
 for(const n of ['5','15','60']){await page.locator('#notificationLeadMinutes').selectOption(n);await page.locator('#saveNotificationTiming').click();assert.match(await page.locator('#notificationTimingStatus').innerText(),/Saved/);assert.equal((await saved(page)).settings.reminderLeadMinutes,Number(n));}
 assert.deepEqual((await saved(page)).weeks,before);assert.equal(await page.evaluate(()=>window.__permissionRequests),0);await page.reload();await settings(page);assert.equal(await page.locator('#notificationLeadMinutes').inputValue(),'60');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('failed timing saves report the failure and retain the previous setting',async()=>{
 const {page,context,errors}=await open();try{await settings(page);const before=await saved(page);await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='weekwise-planner-v2')throw new DOMException('Fixture quota','QuotaExceededError');return write.call(this,key,value);};});await page.locator('#notificationLeadMinutes').selectOption('15');await page.locator('#saveNotificationTiming').click();assert.doesNotMatch(await page.locator('#notificationTimingStatus').innerText(),/^Saved/);assert.match(await page.locator('#notificationTimingStatus').innerText(),/quota|saving failed|storage/i);assert.equal(await page.locator('#notificationLeadMinutes').inputValue(),'0');assert.deepEqual(await saved(page),before);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('denied permission leaves useful automatic in-app alerts and no repeated alert on reload',async()=>{
 const {page,context,errors}=await open(390,{permission:'denied'});try{await settings(page);assert.equal(await page.locator('#enableTaskNotificationsBtn').isEnabled(),false);assert.match(await page.locator('#taskNotificationStatus').innerText(),/blocked/);await page.locator('#notificationLeadMinutes').selectOption('15');await page.locator('#saveNotificationTiming').click();await page.waitForFunction(()=>Object.keys(JSON.parse(localStorage.getItem('weekwise-alert-receipts-v1:local')||'{}')).length===1);assert.match(await page.locator('#toast').innerText(),/First activity/);const receipts=await page.evaluate(()=>localStorage.getItem('weekwise-alert-receipts-v1:local'));await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-alert-receipts-v1:local')),receipts);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('notification settings fit narrow and wide screens in both themes and pass serious accessibility checks',async()=>{
 for(const width of [390,1280]){const {page,context,errors}=await open(width);try{await settings(page);await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const report=await page.evaluate(()=>axe.run(document.getElementById('settings-reminders')));assert.deepEqual(report.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);await page.screenshot({path:path.join(root,'test-results',`notifications-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}assert.deepEqual(errors,[]);}finally{await context.close();}}
});
test('consecutive calendar blocks are distinct and manual colours and saved activities remain unchanged',async()=>{
 for(const width of [390,1280]){const {page,context,errors}=await open(width);try{const before=(await saved(page)).weeks;await navigate(page,'calendar');await page.locator('#dayViewBtn').click();const colours=await page.locator('.cal-event[data-task-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.taskId,n.dataset.taskColor])));assert.ok(colours.first);assert.notEqual(colours.first,colours.second);assert.equal(colours.manual,'purple');await page.locator('#weekViewBtn').click();const weekColours=await page.locator('.range-event[data-range-id],.mobile-week-event[data-range-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.rangeId,n.dataset.taskColor])));assert.ok(weekColours.first,'week view retains automatic accents');assert.notEqual(weekColours.first,weekColours.second);assert.equal(weekColours.manual,'purple');assert.deepEqual((await saved(page)).weeks,before);await page.screenshot({path:path.join(root,'test-results',`consecutive-${width}.png`),animations:'disabled'});assert.deepEqual(errors,[]);}finally{await context.close();}}
});

test('sticky week navigation leaves safe touch spacing around partially scrolled add buttons',async()=>{
 const {page,context}=await open(390);try{
 await navigate(page,'calendar');await page.locator('#weekViewBtn').click();await page.addScriptTag({content:axe.source});
 for(const offset of [28,35,43]){
  await page.evaluate(offset=>{const grid=document.getElementById('daysGrid'),button=document.querySelectorAll('.mobile-week-add')[1],index=document.querySelector('.mobile-week-index');grid.scrollTop+=button.getBoundingClientRect().top-index.getBoundingClientRect().bottom+offset;},offset);
  const violations=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:['target-size']});return result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[],`touch spacing at scroll offset ${offset}`);
 }
 }finally{await context.close();}
});

test('quiet hours and category defaults are optional, guarded, and restored after reload',async()=>{
 const {page,context,errors}=await open();try{
  await settings(page);
  assert.equal(await page.locator('#notificationCategoryOptions').evaluate(el=>el.open),false);
  const before=(await saved(page)).weeks;
  await page.locator('#notificationQuietEnabled').check();
  await page.locator('#notificationQuietStart').fill('21:00');
  await page.locator('#notificationQuietEnd').fill('07:00');
  await page.locator('#notificationGroupByTask').uncheck();
  await page.locator('#notificationCategoryOptions summary').click();
  await page.locator('[data-notification-category="study"]').selectOption('60');
  await page.locator('#saveNotificationTiming').click();
  const settings=(await saved(page)).settings;
  assert.deepEqual(settings.reminderQuietHours,{enabled:true,start:'21:00',end:'07:00'});
  assert.equal(settings.reminderGroupByTask,false);
  assert.equal(settings.reminderCategoryLeadMinutes.study,60);
  assert.deepEqual((await saved(page)).weeks,before);
  await page.reload();await settings(page);
  assert.equal(await page.locator('#notificationQuietEnabled').isChecked(),true);
  assert.equal(await page.locator('#notificationQuietStart').inputValue(),'21:00');
  assert.equal(await page.locator('[data-notification-category="study"]').inputValue(),'60');
  assert.equal(await page.locator('#notificationGroupByTask').isChecked(),false);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('quiet hours suppress due foreground alerts while keeping other tasks and save state intact',async()=>{
 const {page,context,errors}=await open(1280,{permission:'denied'});try{
  await settings(page);await page.locator('#notificationQuietEnabled').check();
  await page.locator('#notificationQuietStart').fill('09:00');
  await page.locator('#notificationQuietEnd').fill('11:00');
  await page.locator('#notificationLeadMinutes').selectOption('15');
  await page.locator('#saveNotificationTiming').click();
  await page.evaluate(()=>window.checkTaskReminders?.());
  assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('weekwise-alert-receipts-v1:local')||'{}')).length),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
