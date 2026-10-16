import test,{before,after,beforeEach} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium,firefox,webkit} from 'playwright';import axe from 'axe-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),site=path.resolve(root,process.env.WEEKWISE_TEST_SITE_ROOT||'.'),engine=process.env.WEEKWISE_BROWSER||'chromium';
let browser,server,origin;const rows=new Map(),blocked=new Set();
const owner='device-test-owner',other='other-device-owner',epoch=Date.parse('2030-01-08T12:00:00Z');
const sdk=String.raw`(()=>{let user={id:'device-test-owner',email:'device-test-owner@example.invalid'},listeners=[];const session=()=>user?{access_token:'device-token:'+user.id,user}:null;const client={auth:{onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:session()}};},async getUser(){return {data:{user}};},async signOut(){user=null;listeners.forEach(fn=>fn('SIGNED_OUT',null));return {};},async signInWithPassword(){return {data:{session:session(),user}};}},functions:{async invoke(){return {data:null,error:new Error('Controlled test service; no live provider')};}},from(){return {select(){return {eq(key,id){return {async maybeSingle(){const r=await fetch('/__device_cloud?user='+encodeURIComponent(id));return {data:await r.json(),error:null};}};}};}};}};window.WeekwiseTestAuth={setUser(id){user=id?{id,email:id+'@example.invalid'}:null;listeners.forEach(fn=>fn(user?'SIGNED_IN':'SIGNED_OUT',session()));}};window.supabase={createClient(){return client;}};})();`;
function fixture(){return {settings:{timeZone:'UTC'},weeks:{'2030-01-06':{notes:'Private retained notes',tasks:[{id:'original-a',title:'Private task Alpha',day:2,start:null,duration:30,estimatedDurationMinutes:30,done:false,unscheduled:true,listId:'inbox',type:'life',custom:true,note:'Private note must never enter a device report',unknownField:{keep:true}},{id:'original-b',title:'Private task Beta',day:2,start:840,duration:30,done:false,unscheduled:false,listId:'inbox',type:'life',custom:true}]}},recurringTemplates:[],customLists:[]};}
function seed(id){rows.set(id,{user_id:id,revision:1,updated_at:'2030-01-08T11:00:00Z',data:{version:1,store:fixture(),reminders:[],focusSessions:[],habits:[],countdowns:[],savedTaskFilters:[],taskTemplates:[]}});}
function serve(req,res){
 const u=new URL(req.url,'http://localhost');if(u.pathname==='/__device_cloud'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(rows.get(u.searchParams.get('user'))||null));return;}
 const file=path.resolve(site,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(site+path.sep)&&file!==site){res.writeHead(403);res.end();return;}
 const target=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}const ext=path.extname(target),types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[ext]||'text/plain','Cache-Control':'no-store'});res.end(data);});
}
before(async()=>{if(!{chromium,firefox,webkit}[engine])throw new Error('Unsupported browser engine');fs.mkdirSync(path.join(root,'test-results'),{recursive:true});server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port+'/';browser=await {chromium,firefox,webkit}[engine].launch({headless:true});});
beforeEach(()=>{rows.clear();blocked.clear();seed(owner);});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function open({width=390,height=844,worker=false,viewportMock=false,reducedMotion='no-preference',blockFont=false,deviceOnly=false}={}){
 const context=await browser.newContext({viewport:{width,height},timezoneId:'UTC',reducedMotion,...(engine==='firefox'?{}:{isMobile:width<=430,hasTouch:width<=430}),serviceWorkers:worker?'allow':'block'});
 await context.addInitScript(({epoch,mock})=>{const OriginalDate=Date;window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}};if(mock){const view=new EventTarget();view.height=844;view.offsetTop=0;view.scale=1;Object.defineProperty(window,'visualViewport',{value:view});window.__viewportFixture=view;}},{epoch,mock:viewportMock});
 if(deviceOnly)await context.addInitScript(store=>{try{localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));}catch(_){}},fixture());
  await context.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:deviceOnly?sdk.replace("let user={id:'device-test-owner',email:'device-test-owner@example.invalid'}",'let user=null'):sdk}));
 await context.route('**/rest/v1/rpc/weekwise_save',r=>{const req=r.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});const id=req.headers().authorization?.split('device-token:')[1];assert.ok(id);if(blocked.has(id))return r.abort();const args=req.postDataJSON(),row=rows.get(id),revision=row?.revision||0;if(args.p_expected_revision!==revision)return r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify([{saved:false,...row,revision}])});const next={user_id:id,revision:revision+1,updated_at:new Date().toISOString(),data:args.p_data};rows.set(id,next);return r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify([{saved:true,...next}])});});
 await context.route('**/functions/v1/**',r=>r.abort());
 if(blockFont)await context.route('**/*.woff2',route=>route.abort());
 const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});if(deviceOnly)await page.locator('#signinLocalContinue').click();await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);if(!deviceOnly)await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');return {context,page};
}
async function show(page,selector){const el=page.locator(selector);if(selector.startsWith('#workspaceSidebar')&&!await el.isVisible()&&await page.locator('#mobileNavigationToggle').isVisible()&&!await page.locator('body').evaluate(el=>el.classList.contains('navigation-expanded')))await page.locator('#mobileNavigationToggle').click();const ids=await el.evaluate(el=>{const out=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)out.unshift(p.id);return out;});for(const id of ids)await page.locator('#'+id+' > summary').click();return el;}
async function navigate(page,view){await (await show(page,'#workspaceSidebar [data-workspace-view="'+view+'"]')).click();}
async function quality(page){await navigate(page,'settings');await page.locator('[data-quality-open]').click();await page.locator('#qualityPanel').waitFor({state:'visible'});}
async function canonical(page){return page.evaluate(()=>Object.fromEntries(['weekwise-planner-v2','weekwise-reminders-v1','weekwise-focus-sessions-v1','weekwise-habits-v1','weekwise-countdowns-v1','weekwise-saved-filters-v1','weekwise-task-templates-v1'].map(k=>[k,localStorage.getItem(k)])));}
async function downloadedJSON(download){const file=await download.path();return JSON.parse(fs.readFileSync(file,'utf8'));}
async function snap(page,name){await page.screenshot({path:path.join(root,'test-results',engine+'-device-'+name+'.png'),animations:'disabled'});}

test('compact phone calendar controls keep five modes and 44-pixel actions before the schedule',async()=>{
 for(const width of [320,390,650]){
  rows.get(owner).data.store=mobileWeekFixture();const {context,page}=await open({width,height:844});
  try{
   await navigate(page,'calendar');await page.locator('#weekViewBtn').click();await page.evaluate(()=>scrollTo(0,0));const before=await canonical(page);
   const toolbar=await page.locator('#calendarToolbar').boundingBox();assert.ok(toolbar.height<=205,JSON.stringify({width,toolbar}));
   const heading=await page.locator('.mobile-week-day h3').first().boundingBox();assert.ok(heading.y<470,JSON.stringify({width,heading}));
   for(const view of ['day','week','month','agenda','year']){
    await page.locator('#'+view+'ViewBtn').click();assert.equal(await page.locator('#'+view+'ViewBtn').getAttribute('aria-pressed'),'true');
    for(const selector of ['#dayViewBtn','#weekViewBtn','#monthViewBtn','#agendaViewBtn','#yearViewBtn','#prevWeek','#thisWeek','#nextWeek','#remindersQuickBtn','#addTaskBtn']){const box=await page.locator(selector).boundingBox();assert.ok(box.width>=43.9&&box.height>=43.9,JSON.stringify({selector,box,width}));assert.ok(box.x>=0&&box.x+box.width<=width+1,JSON.stringify({selector,box,width}));}
    assert.equal(await page.getByRole('button',{name:'New event',exact:true}).isVisible(),true);assert.equal(await page.getByRole('button',{name:'Reminder',exact:true}).isVisible(),true);
    const navigation=await page.locator('.week-control').boundingBox(),label=await page.locator('#weekLabel').boundingBox();assert.ok(navigation.x+navigation.width<=label.x+1,JSON.stringify({width,view,navigation,label}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   }
   await page.locator('#weekViewBtn').click();assert.deepEqual(await canonical(page),before);
   if(width===390){await page.evaluate(()=>scrollTo(0,0));await snap(page,'release2-calendar-compact');}
  }finally{await context.close();}
 }
});

test('Today puts next commitment and highlights first and reviews the original past task',async()=>{
 for(const width of [320,390]){
  const store=fixture();store.weeks['2030-01-06'].tasks[0].todayPriority=true;store.weeks['2030-01-06'].tasks[0].dueDate='2030-01-07';
  store.weeks['2029-12-30']={notes:'Keep earlier week notes',tasks:[{id:'past-review',title:'Earlier commitment <img src=x>',day:6,start:600,duration:30,done:false,status:'todo',custom:true,listId:'study',type:'study',note:'Keep the original note',unknownField:{retained:true}}]};rows.get(owner).data.store=store;
  const {context,page}=await open({width,height:844});
  try{
   await navigate(page,'today');await page.evaluate(()=>scrollTo(0,0));const before=await canonical(page);
   assert.equal(await page.locator('.today-next h3').innerText(),'Private task Beta');
   const next=await page.locator('.today-next').boundingBox(),highlights=await page.locator('.today-priorities').boundingBox(),summary=await page.locator('.today-progress-card').boundingBox();
   assert.ok(next.y<450&&highlights.y<700,JSON.stringify({width,next,highlights}));assert.ok(highlights.y<summary.y);
   assert.match(await page.locator('.today-priorities').innerText(),/Not scheduled.*Inbox/);assert.equal(await page.locator('.today-progress-ring').getAttribute('aria-valuemax'),'1');
   assert.equal(await page.locator('#todayReviewDetails').evaluate(el=>el.open),false);await page.locator('#todayReviewSummary').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#todayReviewDetails li').count(),2);assert.equal(await page.locator('#todayReviewDetails img').count(),0);assert.deepEqual(await canonical(page),before);
   await page.addScriptTag({content:axe.source});const audits=[];for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);await page.waitForTimeout(300);
    const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));audits.push({theme,violations:result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
   }
   fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-today-release2-'+width+'-device.json'),JSON.stringify(audits,null,2));assert.deepEqual(audits.flatMap(a=>a.violations),[]);
   await page.evaluate(()=>document.body.setAttribute('data-theme','light'));await page.locator('#todayReviewSummary').click();await page.evaluate(()=>scrollTo(0,0));if(width===390)await snap(page,'release2-today-first-screen');
   await page.locator('#todayReviewSummary').click();await page.locator('[data-today-review-ref="2029-12-30::past-review"]').click();assert.equal(await page.locator('#modalNote').inputValue(),'Keep the original note');
   await page.locator('#taskPriorityOptions > summary').click();await page.locator('#modalStatus').selectOption('done');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
   const after=JSON.parse((await canonical(page))['weekwise-planner-v2']),task=after.weeks['2029-12-30'].tasks.find(t=>t.id==='past-review');assert.equal(task.done,true);assert.deepEqual(task.unknownField,{retained:true});assert.equal(task.note,'Keep the original note');assert.equal(after.weeks['2029-12-30'].notes,'Keep earlier week notes');assert.equal(await page.locator('[data-today-review-ref="2029-12-30::past-review"]').count(),0);assert.equal(await page.locator('#todayReviewSummary').evaluate(el=>el===document.activeElement),true,'a completed review returns keyboard focus to the remaining review');assert.equal(await page.locator('#todayReviewDetails [data-experience-recover]').count(),0);assert.equal(await page.locator('#todayReviewDetails [data-experience-plan]').isVisible(),true,'due-only work uses planning rather than a recovery preview with no past block');
   assert.deepEqual(after.weeks['2030-01-06'],JSON.parse(before['weekwise-planner-v2']).weeks['2030-01-06']);
  }finally{await context.close();}
 }
});

test('unfinished review paginates, retains keyboard position on clock refresh and opens a read-only current-week recovery preview',async()=>{
 const store=fixture();store.settings.planning={days:[1,2,3,4,5],start:540,end:1020,buffer:0,breakMinutes:0,maxDailyMinutes:480};
 for(let i=0;i<7;i++)store.weeks['2030-01-06'].tasks.push({id:'decision-'+i,title:'Decision '+i,day:2,start:540+i*15,duration:15,estimatedDurationMinutes:15,done:false,unscheduled:false,custom:true,listId:'inbox',type:'life',dueDate:'2030-01-08'});
 rows.get(owner).data.store=store;seed(other);const {context,page}=await open();
 try{
  await navigate(page,'plan');await (await show(page,'#planWeek')).fill('2030-02-04');await page.locator('#planWeek').press('Tab');await navigate(page,'today');const before=await canonical(page);
  await page.locator('#todayReviewSummary').click();assert.equal(await page.locator('#todayReviewDetails li').count(),5);await page.locator('#todayReviewMore').click();assert.equal(await page.locator('#todayReviewDetails li').count(),7);
  await page.locator('[data-today-review-ref="2030-01-06::decision-2"]').focus();
  await page.evaluate(()=>{const OriginalDate=Date,now=Date.now()+60000;window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};window.dispatchEvent(new Event('focus'));});
  assert.equal(await page.locator('#todayReviewDetails').evaluate(el=>el.open),true);assert.equal(await page.locator('[data-today-review-ref="2030-01-06::decision-2"]').evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('#todayReviewDetails li').count(),7);assert.deepEqual(await canonical(page),before);
  await page.evaluate(id=>WeekwiseTestAuth.setUser(id),other);await page.waitForFunction(id=>document.querySelector('#cloudUserEmail').textContent===id+'@example.invalid',other);assert.equal(await page.locator('#todayReviewDetails').count(),0);assert.doesNotMatch(await page.locator('#todayOverview').innerText(),/Decision 2/);
  await page.evaluate(id=>WeekwiseTestAuth.setUser(id),owner);await page.waitForFunction(()=>document.querySelector('#todayReviewDetails'));assert.equal(await page.locator('#todayReviewDetails').evaluate(el=>el.open),false);await page.locator('#todayReviewSummary').click();assert.equal(await page.locator('#todayReviewDetails li').count(),5);
  const returned=await canonical(page);await page.locator('[data-experience-recover]').click();assert.equal(await page.locator('#planWeek').inputValue(),'2030-01-07');assert.equal(await page.locator('#planPreviewTitle').innerText(),'Review recovery adjustments');assert.ok(await page.locator('[name="planProposal"]').count());assert.equal(await page.locator('#planOverviewRange').innerText(),'7 Jan – 13 Jan');assert.equal(await page.locator('#planReadiness article').filter({hasText:'Already scheduled'}).locator('strong').innerText(),'8');assert.equal(await page.locator('#planPreviewTitle').evaluate(el=>el===document.activeElement),true);const previewHeading=await page.locator('#planPreviewTitle').boundingBox();assert.ok(previewHeading.y>80&&previewHeading.y+previewHeading.height<760,JSON.stringify(previewHeading));assert.deepEqual(await canonical(page),returned);await snap(page,'release2-recovery-preview');
 }finally{await context.close();}
});

test('the design keeps narrow layouts and existing records usable when the local typeface cannot load',async()=>{
 const fallback=await open({width:320,blockFont:true});let before;
 try{
  const {page}=fallback;await page.evaluate(()=>document.fonts.ready);before=await canonical(page);
  assert.equal(await page.evaluate(async()=>{try{const faces=await document.fonts.load('400 16px "Plus Jakarta Sans"');return faces.length>0&&faces.every(face=>face.status==='loaded');}catch(_){return false;}}),false);
  await navigate(page,'inbox');assert.equal(await page.locator('.workspace-task-row').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks,JSON.parse(before['weekwise-planner-v2']).weeks['2030-01-06'].tasks);
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('Readable fallback draft');assert.equal(await page.locator('#saveTaskBtn').isVisible(),true);await snap(page,'design-font-fallback');
 }finally{await fallback.context.close();}
 const loaded=await open({width:320});try{
  const result=await loaded.page.evaluate(async()=>{try{const faces=await document.fonts.load('400 16px "Plus Jakarta Sans"');return {loaded:faces.length>0&&faces.every(face=>face.status==='loaded'),faces:Array.from(document.fonts).map(face=>({family:face.family,status:face.status}))};}catch(error){return {loaded:false,error:error.message};}});
  assert.equal(result.loaded,true,JSON.stringify(result));
  assert.deepEqual(JSON.parse((await canonical(loaded.page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks,JSON.parse(before['weekwise-planner-v2']).weeks['2030-01-06'].tasks);
 }finally{await loaded.context.close();}
});

test('motion settles after rapid navigation, preserves records and stops when the device preference changes',async()=>{
 const {context,page}=await open({width:1440,height:1000});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  const before=await canonical(page);await navigate(page,'plan');
  await page.waitForFunction(()=>document.querySelector('#planWorkspace').getAnimations({subtree:true}).some(a=>a.playState==='running'));
  const timings=await page.locator('#planWorkspace').evaluate(el=>el.getAnimations({subtree:true}).map(a=>a.effect.getTiming()));
  assert.ok(timings.length<=5);assert.ok(timings.every(t=>t.iterations===1&&Number(t.duration)+Number(t.delay)<=400));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.getAnimations().length===0);
  await page.evaluate(()=>['inbox','plan','insights','settings','calendar','inbox'].forEach(view=>document.querySelector('#workspaceSidebar [data-workspace-view="'+view+'"]').click()));
  await page.waitForFunction(()=>document.body.dataset.activeView==='inbox');
  assert.equal(await page.locator('#taskWorkspace').isVisible(),true);assert.equal(await page.locator('#planWorkspace').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
  const after=await canonical(page);const original=JSON.parse(before['weekwise-planner-v2']).weeks['2030-01-06'].tasks;
  assert.deepEqual(JSON.parse(after['weekwise-planner-v2']).weeks['2030-01-06'].tasks,original);
  for(const key of Object.keys(before).filter(k=>k!=='weekwise-planner-v2'))assert.equal(after[key],before[key]);
  await page.emulateMedia({reducedMotion:'no-preference'});await navigate(page,'settings');
  await page.waitForFunction(()=>document.querySelector('#settingsWorkspace').getAnimations({subtree:true}).some(a=>a.playState==='running'));
  await page.waitForFunction(()=>document.getAnimations().length===0);
  assert.equal(await page.locator('.settings-cards').evaluate(el=>getComputedStyle(el).transform),'none');
  await page.locator('[data-settings-panel="appearancePanel"]').click();await page.locator('#closeUtility').press('Escape');
  assert.equal(await page.locator('#utilityModal').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-settings-panel')),true);
  assert.deepEqual(errors,[]);await snap(page,'motion-desktop-settings');
 }finally{await context.close();}
});
test('reduced motion keeps phone menus, editors and native copy dialogs immediate and usable',async()=>{
 rows.get(owner).data.store=mobileWeekFixture();const {context,page}=await open({width:390,reducedMotion:'reduce'});
 try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();await page.locator('[data-week-jump="2030-01-08"]').click();
  await page.locator('.mobile-week-copy[data-range-id="original-b"]').click();
  assert.equal(await page.locator('#copyScheduleDialog').isVisible(),true);
  assert.equal(await page.locator('#copyScheduleDialog').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#copyScheduleCancel').press('Escape');assert.equal(await page.locator('#copyScheduleDialog').isVisible(),false);
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('Keyboard-ready capture');
  assert.equal(await page.locator('.modal').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.locator('#moreActions > summary').click();assert.equal(await page.locator('.more-panel').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#moreActions > summary').click();assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await snap(page,'motion-mobile-week');
 }finally{await context.close();}
});
test('calendar completion saves immediately and its brief feedback never replays on navigation',async()=>{
 rows.get(owner).data.store=mobileWeekFixture();const {context,page}=await open();
 try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();await page.locator('[data-week-jump="2030-01-08"]').click();
  const control='input[data-range-done][data-range-id="original-b"]';await page.locator(control).check();
  assert.equal(JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks.find(t=>t.id==='original-b').done,true);
  await page.waitForFunction(selector=>document.querySelector(selector)?.getAnimations().some(a=>a.playState==='running'),control);
  await page.waitForFunction(()=>document.getAnimations().length===0);
  await navigate(page,'inbox');await navigate(page,'calendar');await page.locator('#weekViewBtn').click();
  assert.equal(await page.locator(control).isChecked(),true);assert.equal(await page.locator(control).evaluate(el=>el.getAnimations().length),0);
 }finally{await context.close();}
});

function mobileWeekFixture(){
 const store=fixture(),a=store.weeks['2030-01-06'].tasks[0],b=store.weeks['2030-01-06'].tasks[1];
 Object.assign(a,{title:'Work day',day:1,start:360,duration:600,unscheduled:false,listId:'work',type:'job',note:'Editable one-day work block. Keep the full details available without crowding the week.'});
 Object.assign(b,{title:'Study session with a longer title that should wrap comfortably',type:'study',listId:'study'});
 store.weeks['2030-01-06'].tasks.push({id:'week-call',title:'Quick catch-up',day:2,start:855,duration:20,done:false,custom:true,type:'life'});
 return store;
}
test('personal activity history replaces presets and calendar copies stay independent across dates',async()=>{
 rows.get(owner).data.store=mobileWeekFixture();const {context,page}=await open();try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();assert.equal(await page.locator('[data-week-jump]').first().innerText().then(text=>text.split('\n')[0]),'Mon');assert.equal(await page.locator('.trip-mark').count(),0);assert.equal(await page.locator('#menuSettingsBtn').count(),0);assert.equal(await page.locator('#settingsPanel').count(),0);
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('Study session');assert.equal(await page.locator('[data-activity-history]').count(),1);await page.locator('[data-activity-history]').click();assert.match(await page.locator('#modalTitleInput').inputValue(),/longer title/);assert.equal(await page.locator('[data-activity-suggestion]').count(),0);page.once('dialog',dialog=>dialog.accept());await page.locator('#closeModal').click();
  await page.locator('[data-week-jump="2030-01-08"]').click();await page.locator('.mobile-week-copy[data-range-id="original-b"]').click();await page.locator('#copyScheduleDate').fill('2030-01-14');await page.locator('#copyScheduleTime').fill('10:00');const before=JSON.parse((await canonical(page))['weekwise-planner-v2']);await page.locator('#copyScheduleForm button[type="submit"]').click();await page.locator('#copyScheduleDialog').waitFor({state:'hidden'});
  const after=JSON.parse((await canonical(page))['weekwise-planner-v2']);assert.deepEqual(after.weeks['2030-01-06'].tasks,before.weeks['2030-01-06'].tasks);const copy=after.weeks['2030-01-13'].tasks.find(t=>t.copiedFrom?.id==='original-b');assert.ok(copy);assert.notEqual(copy.id,'original-b');assert.equal(copy.done,false);assert.equal(copy.day,1);assert.equal(copy.start,600);
  await page.locator('.mobile-week-title[data-range-id="original-b"]').click();await page.locator('#copyScheduleBtn').click();await page.locator('#copyScheduleDialog').waitFor({state:'visible'});assert.equal(await page.locator('#taskModal').isVisible(),false);await page.locator('#copyScheduleCancel').click();assert.deepEqual(JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks,after.weeks);
  await page.locator('.mobile-week-copy[data-range-id="original-b"]').click();await page.locator('#copyScheduleDate').fill('2030-01-14');await page.locator('#copyScheduleTime').fill('10:00');await page.locator('#copyScheduleForm button[type="submit"]').click();assert.match(await page.locator('#copyScheduleStatus').innerText(),/overlap/);assert.deepEqual(JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks,after.weeks);await page.locator('#copyScheduleCancel').click();
 }finally{await context.close();}
});
test('five theme choices save and reload, modern forms reflow and pass theme accessibility checks',async()=>{
 const {context,page}=await open();const audits=[];try{
  await navigate(page,'settings');await page.locator('[data-settings-panel="appearancePanel"]').click();assert.equal(await page.locator('[data-theme-choice]').count(),5);await page.addScriptTag({content:axe.source});
  for(const theme of ['light','ocean','lavender','sunset','dark']){await page.locator('[data-theme-choice="'+theme+'"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('[data-theme-choice="'+theme+'"]').getAttribute('aria-pressed'),'true');assert.equal(JSON.parse((await canonical(page))['weekwise-planner-v2']).settings.theme,theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));audits.push({theme,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)});await snap(page,'appearance-'+theme);}
  await page.locator('#closeUtility').click();await page.reload();await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden);assert.equal(await page.locator('body').getAttribute('data-palette'),'dark');await (await show(page,'#workspaceSidebar [data-workspace-action="habits"]')).click();await page.locator('#habitEditorDetails > summary').click();await page.locator('#habitName').fill('A small modern habit');await page.locator('#habitForm').screenshot({path:path.join(root,'test-results',engine+'-device-habit-modern.png')});await page.locator('#saveHabitBtn').click();assert.match(await page.locator('#habitTrackerList').innerText(),/small modern habit/);await page.locator('#closeUtility').click();await (await show(page,'#workspaceSidebar [data-workspace-action="focus"]')).click();assert.equal(await page.locator('#focusClock').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await snap(page,'focus-modern');
 }finally{fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-personal-themes.json'),JSON.stringify(audits,null,2));await context.close();}assert.deepEqual(audits.flatMap(v=>v.violations.filter(r=>['serious','critical'].includes(r.impact))),[]);
});
test('filter builder previews, edits and sorts saved criteria; weekly summary and Plan use the Monday range',async()=>{
 const {context,page}=await open();try{
  await navigate(page,'filters');await page.locator('#filterName').fill('My personal smart list');await page.locator('#filterQuery').fill('Alpha');await page.locator('#filterSchedule').selectOption('unscheduled');assert.match(await page.locator('#filterLiveCount').innerText(),/^1 matching/);await page.locator('#saveFilterBtn').click();assert.equal(await page.locator('#savedFilterResults .workspace-task-row').count(),1);const id=await page.locator('[data-filter-open]').first().getAttribute('data-filter-open');await page.locator('[data-filter-edit="'+id+'"]').click();await page.locator('#filterName').fill('Edited smart list');await page.locator('#filterQuery').fill('Beta');await page.locator('#filterSchedule').selectOption('scheduled');await page.locator('#filterSort').selectOption('title');await page.locator('#saveFilterBtn').click();const filters=JSON.parse((await canonical(page))['weekwise-saved-filters-v1']);assert.equal(filters.length,1);assert.equal(filters[0].id,id);assert.equal(filters[0].query,'Beta');assert.match(await page.locator('#savedFilterResults').innerText(),/Private task Beta/);await snap(page,'filters-modern');
  await page.locator('#moreActions > summary').click();await page.locator('#dashboardMenuBtn').click();assert.equal(await page.locator('#dashboardWeekPicker').inputValue(),'2030-01-07');assert.equal(await page.locator('#summaryHighlights article').count(),4);assert.equal(await page.locator('#dailyBreakdown .daily-row').count(),7);const downloadEvent=page.waitForEvent('download');await page.locator('#summaryExport').click();const download=await downloadEvent;assert.match(fs.readFileSync(await download.path(),'utf8'),/Recorded focus/);await snap(page,'summary-modern');await page.locator('#summaryPrevious').click();assert.equal(await page.locator('#dashboardWeekPicker').inputValue(),'2029-12-31');await page.locator('#closeUtility').click();
  await navigate(page,'plan');assert.equal(await page.locator('.plan-beta').innerText(),'Smart Week Builder');assert.equal(await page.locator('#planReadiness article').count(),4);assert.match(await page.locator('#planReadiness').innerText(),/Ready to place/);assert.match(await page.locator('#planReadiness').innerText(),/Highlighted, unplanned/);const week=await page.locator('#planWeek').inputValue();await page.locator('#planNextWeek').click();assert.notEqual(await page.locator('#planWeek').inputValue(),week);await page.locator('#planCurrentWeek').click();await page.locator('#planPreferences button[type="submit"]').click();assert.ok(await page.locator('[name="planProposal"]').count());await page.locator('#planSelectNone').click();assert.equal(await page.locator('#planApply').isDisabled(),true);await page.locator('#planSelectAll').click();assert.equal(await page.locator('#planApply').isDisabled(),false);await snap(page,'plan-modern');
 }finally{await context.close();}
});
test('phone Week view exposes all seven dates, wraps event titles and passes light/dark audits without horizontal scrolling',async()=>{
 const audits=[];
 for(const width of [320,390,650]){
  rows.get(owner).data.store=mobileWeekFixture();const {context,page}=await open({width,height:844});
  try{
   await navigate(page,'calendar');await page.locator('#weekViewBtn').click();await page.locator('.mobile-week-index').waitFor();const before=await canonical(page);
   assert.equal(await page.locator('[data-week-jump]').count(),7);assert.equal(await page.locator('.mobile-week-day').count(),7);
   for(const button of await page.locator('[data-week-jump]').all()){const rect=await button.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);assert.ok(rect.width>=24&&rect.height>=44);}
   if(width===390){await page.evaluate(()=>window.scrollTo(0,0));await snap(page,'mobile-week-overview');}
   await page.locator('[data-week-jump="2030-01-07"]').click();assert.equal(await page.locator('#mobile-week-heading-2030-01-07').evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('#weekViewBtn').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#daysGrid').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(await canonical(page),before);
   if(width===390){await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);
    await page.waitForTimeout(300);
    const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
    audits.push({theme,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)});await snap(page,'mobile-week-'+theme);
   }}
  }finally{await context.close();}
 }
 fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-mobile-week.json'),JSON.stringify(audits,null,2));assert.deepEqual(audits.flatMap(v=>v.violations.filter(r=>['serious','critical'].includes(r.impact))),[]);
});
test('mobile weekly edits, completion, note disclosures and day-specific creation retain canonical identities and metadata',async()=>{
 const store=mobileWeekFixture();store.weeks['2030-01-06'].tasks[0].note+=' <img src=x onerror=alert(1)>';rows.get(owner).data.store=store;
 const {context,page}=await open();try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();await page.locator('[data-week-jump="2030-01-07"]').click();
  const card=page.locator('#mobile-week-2030-01-07 .mobile-week-event[data-range-id="original-a"]');await card.locator('summary').click();assert.equal(await card.locator('img').count(),0);assert.match(await card.locator('.mobile-week-note p').innerText(),/<img src=x/);
  await card.locator('[data-range-done]').check();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks['2030-01-06'].tasks.find(t=>t.id==='original-a').done);
  assert.equal(await card.locator('[data-range-done]').evaluate(el=>el===document.activeElement),true);assert.equal(await card.locator('details').getAttribute('open'),'');
  await page.locator('[data-week-jump="2030-01-08"]').click();await page.locator('.mobile-week-title[data-range-id="original-b"]').click();await page.locator('#modalTitleInput').fill('Updated study session');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.locator('[data-week-jump="2030-01-12"]').click();await page.locator('#mobile-week-2030-01-12 .mobile-week-add').click();await page.locator('#taskModal').waitFor({state:'visible'});assert.equal(await page.locator('#modalDay').inputValue(),'6');assert.equal(await page.locator('#modalTime').inputValue(),'09:00');await page.locator('#modalTitleInput').fill('Saturday activity');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  const tasks=JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks;
  assert.deepEqual(tasks.find(t=>t.id==='original-a').unknownField,{keep:true});assert.equal(tasks.filter(t=>t.id==='original-a').length,1);assert.equal(tasks.find(t=>t.id==='original-b').title,'Updated study session');assert.equal(tasks.find(t=>t.title==='Saturday activity').day,6);
 }finally{await context.close();}
});
test('mobile Week preserves Monday ranges, timezone projections, overnight and all-day continuations across source weeks',async()=>{
 const store=mobileWeekFixture();store.settings.weekStartsOn=1;store.settings.calendarTimeZone='Europe/Berlin';
 store.weeks['2030-01-06'].tasks=[{id:'overnight-week',title:'Overnight commitment',day:0,start:1380,duration:180,done:false,type:'job',custom:true,unknownField:{keep:'overnight'}},{id:'all-day-week',title:'Multi-day trip',day:0,start:null,allDay:true,allDayDate:'2030-01-06',duration:4320,done:false,custom:true}];
 store.weeks['2030-01-13']={tasks:[{id:'last-sunday',title:'Sunday from the next stored week',day:0,start:540,duration:30,done:false,custom:true,note:'Source identity retained'}]};rows.get(owner).data.store=store;
 const {context,page}=await open();try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();const before=await canonical(page);
  assert.equal(await page.locator('[data-week-jump]').first().getAttribute('data-week-jump'),'2030-01-07');assert.equal(await page.locator('[data-week-jump]').last().getAttribute('data-week-jump'),'2030-01-13');
  assert.match(await page.locator('#mobile-week-2030-01-07 [data-range-id="overnight-week"] .mobile-week-time').innerText(),/00:00–03:00/);assert.match(await page.locator('#mobile-week-2030-01-07 [data-range-id="all-day-week"] .mobile-week-time').innerText(),/All day.*continues/);
  const sunday=page.locator('#mobile-week-2030-01-13 .mobile-week-title[data-range-id="last-sunday"]');assert.equal(await sunday.getAttribute('data-range-week'),'2030-01-13');
  await page.locator('[data-week-jump="2030-01-13"]').click();await sunday.click();await page.locator('#taskModal').waitFor({state:'visible'});assert.equal(await page.locator('#modalDay').inputValue(),'0');assert.equal(await page.locator('#modalTime').inputValue(),'09:00');await page.locator('#closeModal').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  assert.deepEqual(await canonical(page),before);
 }finally{await context.close();}
});
test('desktop Week markup and scroll position survive phone resizing and other calendar views keep their existing renderers',async()=>{
 rows.get(owner).data.store=mobileWeekFixture();const {context,page}=await open({width:1440,height:1000});try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();const before=await canonical(page),html=await page.locator('.range-timeline').evaluate(el=>el.outerHTML),scroll=await page.locator('#daysGrid').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}));assert.equal(await page.locator('.range-column').count(),7);
  await page.setViewportSize({width:390,height:844});await page.locator('.mobile-week-index').waitFor();await page.locator('[data-week-jump="2030-01-12"]').click();const phoneScroll=await page.locator('#daysGrid').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}));
  await page.setViewportSize({width:1440,height:1000});await page.locator('.range-timeline').waitFor();assert.equal(await page.locator('.range-timeline').evaluate(el=>el.outerHTML),html);assert.deepEqual(await page.locator('#daysGrid').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft})),scroll);assert.equal(await page.locator('.mobile-week-index').count(),0);
  await page.setViewportSize({width:390,height:844});await page.locator('.mobile-week-index').waitFor();assert.deepEqual(await page.locator('#daysGrid').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft})),phoneScroll);for(const view of ['day','month','agenda','year']){await page.locator('#'+view+'ViewBtn').click();assert.equal(await page.locator('.mobile-week-index').count(),0);assert.equal(await page.locator('#daysGrid').evaluate(el=>el.classList.contains('mobile-week-mode')),false);}
  assert.deepEqual(await canonical(page),before);
 }finally{await context.close();}
});
test('busy mobile days render bounded batches and reveal every activity without modifying the planner',async()=>{
 const store=mobileWeekFixture();store.weeks['2030-01-06'].tasks=Array.from({length:105},(_,i)=>({id:'busy-week-'+i,title:'Activity '+i,day:2,start:i*10,duration:15,done:false,custom:true,type:'other'}));rows.get(owner).data.store=store;
 const {context,page}=await open();try{
  await navigate(page,'calendar');await page.locator('#weekViewBtn').click();const before=await canonical(page);assert.equal(await page.locator('#mobile-week-2030-01-08 .mobile-week-event').count(),100);await page.locator('#mobile-week-2030-01-08 [data-mobile-week-more]').click();assert.equal(await page.locator('#mobile-week-2030-01-08 .mobile-week-event').count(),105);assert.deepEqual(await canonical(page),before);
 }finally{await context.close();}
});

test('device panel is read-only, reports unknown delivery honestly and keeps confirmations account-scoped',async()=>{
 const {context,page}=await open();try{const before=await canonical(page),revision=rows.get(owner).revision;await quality(page);assert.deepEqual(await canonical(page),before);assert.equal(rows.get(owner).revision,revision);assert.match(await page.locator('#qualityPanel').innerText(),/does not prove delivery/);await (await show(page,'[data-quality-check="phone-keyboard"]')).check();await snap(page,'confirmations');await page.evaluate(id=>WeekwiseTestAuth.setUser(id),other);await page.waitForFunction(id=>document.querySelector('#cloudUserEmail').textContent===id+'@example.invalid',other);assert.equal(await page.locator('[data-quality-check="phone-keyboard"]').isChecked(),false);assert.equal(await page.locator('#qualityBackupResult').innerText(),'');assert.ok(await page.evaluate(()=>localStorage.getItem('weekwise-device-checks-v1:device-test-owner')));}finally{await context.close();}
});
test('backup rehearsal preserves canonical bytes, validates complete exported records and rejects corrupt copies safely',async()=>{
 const {context,page}=await open({width:1440,height:1000,deviceOnly:true});try{const before=await canonical(page);await navigate(page,'settings');const wait=page.waitForEvent('download');await page.locator('#exportBtn').click();const original=await downloadedJSON(await wait);assert.equal(original.weeks['2030-01-06'].tasks[0].id,'original-a');await page.locator('[data-quality-open]').click();await (await show(page,'#qualityBackupFile')).setInputFiles({name:'private-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await page.waitForFunction(()=>document.querySelector('#qualityBackupResult').textContent.includes('Rehearsal passed'));assert.deepEqual(await canonical(page),before);const reportWait=page.waitForEvent('download');await page.locator('#qualityBackupReport').click();const report=await downloadedJSON(await reportWait);assert.equal(report.tasks,2);assert.equal(report.roundtripEqual,true);assert.ok(!JSON.stringify(report).includes('Private task'));assert.match(report.sha256,/^[a-f0-9]{64}$/);await snap(page,'backup-rehearsal');await page.locator('#qualityBackupFile').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('private invalid bytes')});await page.waitForFunction(()=>document.querySelector('#qualityBackupResult').textContent.includes('could not be rehearsed'));assert.deepEqual(await canonical(page),before);assert.equal(await page.locator('#qualityBackupReport').isVisible(),false);}finally{await context.close();}
});
test('performance recording is opt-in, captures numeric navigation after reload and exports no task text or tokens',async()=>{
 const {context,page}=await open();try{assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-performance-v1:device-test-owner')),null);await quality(page);await (await show(page,'#qualityRecordPerformance')).check();await page.locator('#closeUtility').click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);await navigate(page,'inbox');await navigate(page,'today');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-performance-v1:device-test-owner')||'{}').samples?.some(s=>s.navigation.length));await quality(page);await (await show(page,'#qualityRecordPerformance')).uncheck();const saved=await page.evaluate(()=>localStorage.getItem('weekwise-performance-v1:device-test-owner'));await page.locator('#closeUtility').click();await navigate(page,'inbox');await navigate(page,'today');await quality(page);assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-performance-v1:device-test-owner')),saved);assert.equal(await page.locator('#qualityExport').isVisible(),true,'Settings supports private JSON reports for a signed-in owner');const stored=await page.evaluate(()=>localStorage.getItem('weekwise-performance-v1:device-test-owner'));assert.ok(JSON.parse(stored).samples.length>0);const text=stored;for(const secret of ['Private task','Private note','device-token:','example.invalid','original-a','navigationURL'])assert.ok(!text.includes(secret),secret);await (await show(page,'#qualityPerformanceSummary'));await snap(page,'performance');}finally{await context.close();}
});
test('mobile visual viewport shrink keeps the focused editor field visible and restores navigation after dismissal',async()=>{
 const {context,page}=await open({viewportMock:true});try{await page.locator('#globalCaptureBtn').click();await page.locator('#taskModal').waitFor({state:'visible'});await page.locator('#modalTitleInput').fill('Viewport preserved capture');await page.locator('#modalNote').focus();await page.evaluate(()=>{__viewportFixture.height=460;__viewportFixture.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.body.classList.contains('keyboard-open'));assert.equal(await page.locator('#workspaceSidebar').isVisible(),false);const rect=await page.locator('#modalNote').boundingBox();assert.ok(rect.y>=10&&rect.y+rect.height<=460,'focused note stays in the simulated visible viewport');const save=await page.locator('#saveTaskBtn').boundingBox();assert.ok(save.y>=10&&save.y+save.height<=460,'Save stays above the simulated keyboard as well');await page.locator('#modalNote').fill('Retain typed work');await snap(page,'keyboard-geometry');page.once('dialog',d=>d.accept());await page.locator('#closeModal').click();await page.locator('#taskModal').waitFor({state:'hidden'});await page.evaluate(()=>{__viewportFixture.height=844;__viewportFixture.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>!document.body.classList.contains('keyboard-open'));assert.equal(await page.locator('#workspaceSidebar').isVisible(),true);}finally{await context.close();}
});
test('narrow and enlarged-text dialogs keep keyboard controls reachable and restore the launcher',async()=>{
 const {context,page}=await open({width:320,height:780});try{await quality(page);assert.equal(await page.locator('#qualityBackupFile').isVisible(),false);await page.addStyleTag({content:'#utilityModal h2,#utilityModal h3,#utilityModal p,#utilityModal label,#utilityModal button,#utilityModal summary{font-size:200%!important;line-height:1.6!important}'});assert.equal(await page.locator('#utilityModal').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);await page.locator('#closeUtility').focus();assert.equal(await page.locator('#closeUtility').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');await page.locator('#utilityModal').waitFor({state:'hidden'});assert.equal(await page.locator('[data-quality-open]').evaluate(el=>el===document.activeElement),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);}finally{await context.close();}
});
test('quick edit and protected Undo work across browser engines without dropping unknown metadata',async()=>{
 const {context,page}=await open();try{await navigate(page,'inbox');const before=await canonical(page);await page.locator('[data-task-quick="original-a"]').click();await page.locator('#taskQuickPriority').selectOption('high');await page.locator('#taskQuickDue').fill('2030-01-10');await page.locator('#taskQuickSave').click();await page.locator('#taskQuickEdit').waitFor({state:'hidden'});const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks['2030-01-06'].tasks.find(t=>t.id==='original-a'));assert.equal(saved.priority,'high');assert.deepEqual(saved.unknownField,{keep:true});await page.locator('#taskActionUndo').click();assert.deepEqual(await canonical(page),before);}finally{await context.close();}
});
test('two isolated browser contexts preserve an offline edit and require review after a newer revision',async()=>{
 const a=await open({width:1440,height:1000}),b=await open({width:1440,height:1000});try{await navigate(a.page,'inbox');await navigate(b.page,'inbox');blocked.add(owner);await a.page.locator('[data-task-quick="original-a"]').click();await a.page.locator('#taskQuickPriority').selectOption('high');await a.page.locator('#taskQuickSave').click();await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Sync failed');blocked.delete(owner);await b.page.locator('[data-task-quick="original-a"]').click();await b.page.locator('#taskQuickPriority').selectOption('medium');await b.page.locator('#taskQuickSave').click();await b.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');await navigate(a.page,'settings');await a.page.locator('[data-settings-action="cloudMenuBtn"]').click();await a.page.locator('#cloudSyncNow').click();await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Needs review');const local=await canonical(a.page);assert.equal(JSON.parse(local['weekwise-planner-v2']).weeks['2030-01-06'].tasks[0].priority,'high');assert.equal(rows.get(owner).data.store.weeks['2030-01-06'].tasks[0].priority,'medium');}finally{await a.context.close();await b.context.close();}
});
test('a changed schedule downloads on device focus without reloading or pressing Sync now',async()=>{
 const a=await open({width:1440,height:1000}),b=await open();try{
  await navigate(a.page,'inbox');await navigate(b.page,'inbox');await a.page.locator('[data-task-quick="original-b"]').click();await a.page.locator('#taskQuickDate').fill('2030-01-09');await a.page.locator('#taskQuickTime').fill('16:15');await a.page.locator('#taskQuickDuration').fill('45');await a.page.locator('#taskQuickSave').click();await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');
  await b.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.page.waitForFunction(()=>{const t=JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks['2030-01-06'].tasks.find(t=>t.id==='original-b');return t.day===3&&t.start===975&&t.duration===45;});assert.deepEqual(JSON.parse((await canonical(b.page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks.find(t=>t.id==='original-a').unknownField,{keep:true});
 }finally{await a.context.close();await b.context.close();}
});
test('a failed upload retries on reconnect even without a newer cloud revision',async()=>{
 const {context,page}=await open({width:1440,height:1000});try{
  await navigate(page,'inbox');blocked.add(owner);await page.locator('[data-task-quick="original-a"]').click();await page.locator('#taskQuickPriority').selectOption('high');await page.locator('#taskQuickSave').click();await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Sync failed');const revision=rows.get(owner).revision;blocked.delete(owner);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');assert.equal(rows.get(owner).revision,revision+1);assert.equal(rows.get(owner).data.store.weeks['2030-01-06'].tasks.find(t=>t.id==='original-a').priority,'high');
 }finally{await context.close();}
});
test('independent offline and online device edits reconcile automatically and reach both devices',async()=>{
 const a=await open({width:1440,height:1000}),b=await open({width:1440,height:1000});try{
  await navigate(a.page,'inbox');await navigate(b.page,'inbox');blocked.add(owner);await a.page.locator('[data-task-quick="original-a"]').click();await a.page.locator('#taskQuickPriority').selectOption('high');await a.page.locator('#taskQuickSave').click();await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Sync failed');blocked.delete(owner);await b.page.locator('[data-task-quick="original-b"]').click();await b.page.locator('#taskQuickPriority').selectOption('medium');await b.page.locator('#taskQuickSave').click();await b.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');await a.page.evaluate(()=>window.dispatchEvent(new Event('online')));await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');await b.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks['2030-01-06'].tasks.find(t=>t.id==='original-a').priority==='high');for(const page of [a.page,b.page]){const tasks=JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks;assert.equal(tasks.find(t=>t.id==='original-a').priority,'high');assert.equal(tasks.find(t=>t.id==='original-b').priority,'medium');assert.equal(tasks.length,2);}
 }finally{await a.context.close();await b.context.close();}
});
test('an already-open device receives changes through the automatic timer',async()=>{
 const a=await open({width:1440,height:1000}),b=await open({width:1440,height:1000});try{
  await navigate(a.page,'inbox');await navigate(b.page,'inbox');await a.page.locator('[data-task-quick="original-a"]').click();await a.page.locator('#taskQuickPriority').selectOption('high');await a.page.locator('#taskQuickSave').click();await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');await b.page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks['2030-01-06'].tasks.find(t=>t.id==='original-a').priority==='high',{},{timeout:25000});
 }finally{await a.context.close();await b.context.close();}
});
test('device tools pass automated accessibility checks in phone light and dark layouts',async()=>{
 const {context,page}=await open();const results=[];try{await quality(page);assert.equal(await page.locator('#qualityBackupFile').isVisible(),false);await (await show(page,'#qualityRecordPerformance'));await (await show(page,'[data-quality-check="screen-reader"]'));await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);await page.waitForTimeout(300);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));results.push({theme,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)});await snap(page,'quality-'+theme);assert.equal(await page.locator('#qualityPanel').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);}fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-device.json'),JSON.stringify(results,null,2));assert.deepEqual(results.flatMap(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact))),[]);}finally{await context.close();}
});

test('private diagnostics follow a real failed upload and explicit retry without exposing records or another owner',async()=>{
 const {context,page}=await open({width:1440,height:1000});try{
  await quality(page);const before=await canonical(page);assert.equal(await page.locator('#qualitySyncState').innerText(),'Synced');assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-diagnostics-v1:device-test-owner')),null);
  await (await show(page,'#qualityRecordDiagnostics')).check();assert.deepEqual(await canonical(page),before);await page.locator('#closeUtility').click();
  await navigate(page,'inbox');blocked.add(owner);await page.locator('[data-task-quick="original-a"]').click();await page.locator('#taskQuickPriority').selectOption('high');await page.locator('#taskQuickSave').click();await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Sync failed');
  await quality(page);assert.equal(await page.locator('#qualitySyncState').innerText(),'Connection needs attention');assert.equal(JSON.parse((await canonical(page))['weekwise-planner-v2']).weeks['2030-01-06'].tasks[0].priority,'high');
  blocked.delete(owner);await page.locator('#qualitySyncNow').click();await page.waitForFunction(()=>document.querySelector('#qualitySyncState').textContent==='Synced');
  assert.equal(await page.locator('#qualityExport').isVisible(),true);const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-diagnostics-v1:device-test-owner')));assert.ok(report.events.some(e=>e.operation==='sync-save'&&e.outcome==='failed'));assert.ok(report.events.some(e=>e.operation==='sync-save'&&e.outcome==='success'));assert.doesNotMatch(JSON.stringify(report),/Private task|Private note|original-a|device-token:|example.invalid|device-test-owner/);
  await page.evaluate(id=>WeekwiseTestAuth.setUser(id),other);await page.waitForFunction(id=>document.querySelector('#cloudUserEmail').textContent===id+'@example.invalid',other);assert.equal(await page.locator('#qualityRecordDiagnostics').isChecked(),false);assert.equal(await page.locator('#qualityDiagnosticsEvents li').count(),0);
 }finally{await context.close();}
});

test('help is read-only and usable at phone width with keyboard, light and dark layouts',async()=>{
 const {context,page}=await open({width:320,height:780});const results=[];try{
  await navigate(page,'settings');const launcher=page.locator('#settingsWorkspace [data-help-open]');await launcher.focus();await page.keyboard.press('Enter');await page.locator('#helpPanel').waitFor({state:'visible'});const before=await canonical(page);assert.match(await page.locator('#helpPanel').innerText(),/A lighter week starts small/);
  const first=page.locator('#helpPanel details').first();await first.locator('summary').click();await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));results.push({theme,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)});await snap(page,'help-'+theme);assert.equal(await page.locator('#helpPanel').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);}
  assert.deepEqual(await canonical(page),before);await page.keyboard.press('Escape');await page.locator('#utilityModal').waitFor({state:'hidden'});assert.equal(await launcher.evaluate(el=>el===document.activeElement),true);await launcher.click();await page.locator('[data-help-action="capture"]').click();await page.waitForFunction(()=>document.querySelector('#workspaceCaptureInput')===document.activeElement);assert.equal(await page.locator('#workspaceCaptureInput').evaluate(el=>el===document.activeElement),true);assert.deepEqual(await canonical(page),before);
  fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-help.json'),JSON.stringify(results,null,2));assert.deepEqual(results.flatMap(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact))),[]);
 }finally{await context.close();}
});

test('calendar setup and failed authorization keep unavailable controls disabled in phone light and dark layouts',async()=>{
 const {context,page}=await open({width:320,height:780});const audits=[];try{
  const before=await canonical(page);await page.evaluate(()=>{window.calendarCalls=[];window.weekwiseCloudClient.functions.invoke=async(name,args)=>{window.calendarCalls.push({action:args.body.action,authorization:args.headers?.Authorization});return {data:args.body.action==='status'?{configured:{google:true,microsoft:false,encryption:true},providers:{google:null,microsoft:null}}:{error:'Authorization could not start in the controlled test'}};};});
  await navigate(page,'settings');await page.locator('[data-settings-action="calendarConnectionsMenuBtn"]').click();await page.waitForFunction(()=>document.querySelector('#connectGoogleCalendarBtn').disabled===false);assert.equal(await page.locator('#connectMicrosoftCalendarBtn').isDisabled(),true);
  await page.locator('#connectGoogleCalendarBtn').click();await page.waitForFunction(()=>document.querySelector('#calendarConnectionsStatus').textContent.includes('controlled test'));assert.equal(await page.locator('#connectMicrosoftCalendarBtn').isDisabled(),true);assert.equal(await page.locator('#syncMicrosoftCalendarBtn').isHidden(),true);assert.deepEqual(await canonical(page),before);assert.ok((await page.evaluate(()=>window.calendarCalls)).every(c=>c.authorization==='Bearer device-token:device-test-owner'));
  await page.locator('.calendar-owner-setup > summary').click();await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));audits.push({theme,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)});assert.equal(await page.locator('#calendarConnectionsPanel').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);await snap(page,'calendar-'+theme);}
  fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-calendar.json'),JSON.stringify(audits,null,2));assert.deepEqual(audits.flatMap(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact))),[]);
 }finally{await context.close();}
});

test('an old calendar status response cannot reveal a previous account connection after switching owners',async()=>{
 const {context,page}=await open();try{
  await page.evaluate(()=>{window.weekwiseCloudClient.functions.invoke=async(name,args)=>({data:{configured:{google:true,microsoft:true,encryption:true},providers:{google:null,microsoft:null}}});});await navigate(page,'settings');await page.locator('[data-settings-action="calendarConnectionsMenuBtn"]').click();await page.waitForFunction(()=>!document.querySelector('#connectGoogleCalendarBtn').disabled);
  await page.evaluate(()=>{window.weekwiseCloudClient.functions.invoke=async(name,args)=>{if(args.headers.Authorization==='Bearer device-token:device-test-owner')return new Promise(resolve=>window.releaseOldCalendar=resolve);return {data:{configured:{google:false,microsoft:false,encryption:true},providers:{google:null,microsoft:null}}};};void WeekwiseCalendarUI.refreshStatus();});await page.waitForFunction(()=>typeof window.releaseOldCalendar==='function');await page.evaluate(id=>WeekwiseTestAuth.setUser(id),other);await page.waitForFunction(id=>document.querySelector('#cloudUserEmail').textContent===id+'@example.invalid',other);await page.evaluate(()=>window.releaseOldCalendar({data:{configured:{google:true,microsoft:true,encryption:true},providers:{google:{provider_account_email:'previous-owner@example.invalid'}}}}));await page.waitForFunction(()=>document.querySelector('#calendarConnectionsStatus').textContent.includes('waiting for provider setup'));assert.doesNotMatch(await page.locator('#googleCalendarConnectionDetail').innerText(),/previous-owner/);assert.equal(await page.locator('#connectGoogleCalendarBtn').isDisabled(),true);
 }finally{await context.close();}
});
