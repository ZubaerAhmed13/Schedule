import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium,firefox,webkit} from 'playwright';import axe from 'axe-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),site=path.resolve(root,process.env.WEEKWISE_TEST_SITE_ROOT||'.'),engine=process.env.WEEKWISE_BROWSER||'chromium';
let server,browser,origin;
const sdk=String.raw`(()=>{
 let user=window.__entryInitialUser?{id:'auth-fixture-owner',email:'fixture@example.invalid'}:null,listeners=[];const calls=[];const session=()=>user?{access_token:'auth-fixture-token',user}:null;
 const emit=event=>listeners.forEach(fn=>fn(event,session()));
 const client={auth:{onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:session()}};},async getUser(){return {data:{user}};},
 async signInWithPassword(args){calls.push({kind:'signin',...args});if(args.password!=='fixture-password')return {error:new Error('Invalid login credentials')};user={id:'auth-fixture-owner',email:args.email};emit('SIGNED_IN');return {data:{user,session:session()}};},
 async signUp(args){calls.push({kind:'signup',...args});await new Promise(resolve=>window.WeekwiseAuthFixture.finishSignup=resolve);return {data:{user:{id:'auth-fixture-owner',email:args.email},session:null}};},
 async resetPasswordForEmail(email){calls.push({kind:'reset',email});return {};},async updateUser(args){calls.push({kind:'update',...args});return {data:{user}};},async signOut(){user=null;emit('SIGNED_OUT');return {};}
 },from(){return {select(){return {eq(){return {async maybeSingle(){return {data:null,error:null};}};}};}};},functions:{async invoke(){return {error:new Error('Fixture service disabled')};}}};
 window.WeekwiseAuthFixture={calls,recover(){user={id:'auth-fixture-owner',email:'fixture@example.invalid'};emit('PASSWORD_RECOVERY');}};window.supabase={createClient(){return client;}};
})();`;
before(async()=>{
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),file=path.resolve(site,'.'+decodeURIComponent(u.pathname));
  if(!file.startsWith(site+path.sep)&&file!==site){res.writeHead(403);res.end();return;}
  const target=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end();return;}const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};res.writeHead(200,{'Content-Type':types[path.extname(target)]||'text/plain','Cache-Control':'no-store'});res.end(data);});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port+'/';browser=await {chromium,firefox,webkit}[engine].launch({headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function open(width=390,{viewportMock=false,entry='signin',installed=false,initialUser=false}={}){
 const context=await browser.newContext({viewport:{width,height:width<=430?844:900},timezoneId:'UTC',serviceWorkers:'block'});
 await context.addInitScript(({installed,initialUser})=>{window.__entryInitialUser=initialUser;if(installed)Object.defineProperty(navigator,'standalone',{value:true});},{installed,initialUser});
 if(viewportMock)await context.addInitScript(()=>{const view=new EventTarget();view.height=844;view.offsetTop=0;view.scale=1;Object.defineProperty(window,'visualViewport',{value:view});window.__authViewportFixture=view;});
 await context.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:sdk}));
 await context.route('**/rest/v1/rpc/weekwise_save',r=>{const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});const args=r.request().postDataJSON();return r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify([{saved:true,revision:args.p_expected_revision+1,updated_at:'2030-01-08T12:00:00Z'}])});});
 await context.route('**/functions/v1/**',r=>r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+(entry==='signin'?'?page=signin':''),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.entryRoute!=='pending');await page.evaluate(()=>document.fonts.ready.then(()=>true));return {context,page,errors};
}
async function credentials(page,password='fixture-password'){await page.locator('#cloudEmail').fill('fixture@example.invalid');await page.locator('#cloudPassword').fill(password);}
async function snap(page,name){await page.screenshot({path:path.join(root,'test-results',engine+'-auth-'+name+'.png'),animations:'disabled'});}

test('public homepage introduces Weekwise before login and offers a real path to existing sign-in',async()=>{
 for(const width of [390,1440]){
  const {context,page,errors}=await open(width,{entry:'home'});
  try{
   assert.equal(await page.locator('#signinLanding').isVisible(),true);
   assert.equal(await page.locator('#wwHomeMain h1').count(),1);
   assert.match(await page.locator('#wwLandingTitle').innerText(),/Make room for what matters/);
   assert.equal(await page.locator('#signinLanding .brand-symbol').count(),1,'the existing account brand and form are preserved');
   assert.equal(await page.locator('#cloudAuthForm').count(),1);
   assert.equal(await page.locator('#cloudSignUpBtn').count(),1);
   assert.equal(await page.locator('.ww-public-feature').count(),8);
   assert.equal(await page.locator('.ww-public-faq-items details').count(),5);
   assert.equal(await page.locator('.ww-public-sample-label').innerText().then(text=>text.includes('ILLUSTRATIVE')),true);
   assert.equal(await page.locator('.wrap').evaluate(el=>el.inert),true,'app remains gated and unavailable to signed-out visitors');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'marketing does not overflow phone viewport');
   const previous=await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2'));
   await page.locator('.ww-public-nav-cta').click();await page.locator('#cloudEmail').waitFor({state:'visible'});
   assert.equal(new URL(page.url()).searchParams.get('page'),'signin');
   assert.equal(await page.locator('#weekwiseHome').isVisible(),false);
   assert.equal(await page.locator('#cloudEmail').isVisible(),true);
   assert.equal(await page.locator('#signinLanding').isVisible(),true,'opening the sign-in section does not enter planner');
   assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2')),previous,'viewing marketing and account panel never alters planner data');
   await page.locator('#signinLocalContinue').click();await page.locator('#signinLanding').waitFor({state:'hidden'});
   assert.equal(await page.locator('.wrap').evaluate(el=>el.inert),false,'device-only option opens original app');
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
});
test('homepage feature and FAQ navigation preserves focus and respects reduced motion',async()=>{
 const {context,page,errors}=await open(390,{entry:'home'});
 try{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#signinLanding .ww-public-hero-actions a[href="#wwHow"]').click();
  await page.waitForFunction(()=>document.querySelector('#signinLanding').scrollTop>200);
  assert.equal(await page.locator('#wwHowHeading').isVisible(),true);
  assert.equal(await page.locator('#signinLanding').evaluate(el=>getComputedStyle(el).scrollBehavior),'auto');
  await page.locator('#wwFaq summary').first().click();
  assert.equal(await page.locator('#wwFaq details').first().getAttribute('open'),'');
  assert.match(await page.locator('#wwFaq details').first().innerText(),/device/);
  assert.equal(await page.locator('#signinLanding').evaluate(el=>getComputedStyle(el).overflowY),'auto');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('session-loading screen keeps credentials disabled until the submit handler is attached',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});let resume,requestedResolve;const requested=new Promise(resolve=>requestedResolve=resolve);
 await context.route('**/supabase.min.js',route=>new Promise(resolve=>{resume=async()=>{await route.fulfill({status:200,contentType:'text/javascript',body:sdk});resolve();};requestedResolve();}));
 const page=await context.newPage();try{
  await page.goto(origin+'?page=signin',{waitUntil:'commit'});await requested;await page.locator('#entryLoading').waitFor({state:'visible'});assert.equal(await page.locator('#cloudEmail').isEnabled(),false);assert.equal(await page.locator('#cloudSignInBtn').isEnabled(),false);assert.equal(await page.locator('#cloudAuthForm').getAttribute('aria-busy'),'true');assert.equal(new URL(page.url()).searchParams.get('page'),'signin');assert.ok(resume);const complete=resume;resume=null;await complete();await page.waitForLoadState('domcontentloaded');assert.equal(await page.locator('#cloudEmail').isEnabled(),true);assert.equal(await page.locator('#cloudAuthForm').getAttribute('aria-busy'),'false');
 }finally{if(resume)await resume().catch(()=>{});await context.close();}
});
test('the real sign-in form is visible immediately with stable password-manager fields and one form copy',async()=>{
 const {context,page,errors}=await open(1440);try{
  assert.equal(await page.locator('#signinLanding').isVisible(),true);assert.equal(await page.locator('#utilityModal').isVisible(),false);assert.equal(await page.locator('#cloudAuthForm').count(),1);assert.equal(await page.locator('#cloudEmail').getAttribute('autocomplete'),'username');assert.equal(await page.locator('#cloudPassword').getAttribute('autocomplete'),'current-password');assert.equal(await page.locator('#signinLanding .brand-symbol').count(),1);
  const before=await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2'));await credentials(page);await page.locator('#cloudTogglePassword').click();assert.equal(await page.locator('#cloudPassword').getAttribute('type'),'text');await page.locator('#cloudTogglePassword').click();assert.equal(await page.locator('#cloudPassword').getAttribute('type'),'password');assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2')),before);await snap(page,'desktop-signin');await page.locator('#signinLocalContinue').click();await page.locator('#signinLanding').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks).flatMap(w=>w.tasks).length),0);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('keyboard tabs reveal invite sign-up and clear hidden confirmation validation when returning to sign-in',async()=>{
 const {context,page}=await open();try{
  await page.locator('#cloudSignInMode').press('ArrowRight');assert.equal(await page.locator('#cloudSignUpBtn').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#cloudReferralCode').isVisible(),true);assert.equal(await page.locator('#cloudReferralCode').getAttribute('required'),'');await credentials(page);await page.locator('#cloudConfirmPassword').fill('different-password');assert.equal(await page.locator('#cloudConfirmPassword').evaluate(el=>el.checkValidity()),false);await page.locator('#cloudSignUpBtn').press('Home');assert.equal(await page.locator('#cloudConfirmPasswordWrap').isVisible(),false);assert.equal(await page.locator('#cloudAuthForm').evaluate(el=>el.checkValidity()),true);assert.equal(await page.locator('#cloudAuthBody').getAttribute('aria-labelledby'),'cloudSignInMode');
 }finally{await context.close();}
});
test('failed sign-in retains the form and successful sign-in reaches the planner without retaining its password',async()=>{
 const {context,page,errors}=await open();try{
  await credentials(page,'wrong-password');await page.locator('#cloudSignInBtn').click();await page.waitForFunction(()=>document.querySelector('#cloudStatus').textContent.includes('incorrect'));assert.equal(await page.locator('#cloudStatus').getAttribute('data-tone'),'error');assert.equal(await page.locator('#signinLanding').isVisible(),true);await credentials(page);await page.locator('#cloudSignInBtn').click();await page.locator('#signinLanding').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');assert.equal(await page.locator('#cloudPassword').inputValue(),'');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')).userId),'auth-fixture-owner');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('invite sign-up communicates loading and preserves the email-confirmation result',async()=>{
 const {context,page}=await open();try{
  await page.locator('#cloudSignUpBtn').click();await credentials(page);await page.locator('#cloudConfirmPassword').fill('fixture-password');await page.locator('#cloudReferralCode').fill('fixture-invite');await snap(page,'phone-signup');await page.locator('#cloudSignInBtn').click();await page.waitForFunction(()=>typeof window.WeekwiseAuthFixture.finishSignup==='function');assert.equal(await page.locator('#cloudAuthForm').getAttribute('aria-busy'),'true');assert.equal(await page.locator('#cloudSignInBtn').isEnabled(),false);assert.equal(await page.locator('#signinLocalContinue').isEnabled(),false);await page.evaluate(()=>WeekwiseAuthFixture.finishSignup());await page.waitForFunction(()=>document.querySelector('#cloudStatus').textContent.includes('confirmation email'));assert.equal(await page.locator('#cloudStatus').getAttribute('data-tone'),'success');assert.equal(await page.locator('#cloudStatus').isVisible(),true);assert.equal(await page.locator('#signinLanding').isVisible(),true);assert.equal(await page.locator('#cloudSignInMode').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#cloudPassword').inputValue(),'');assert.equal(await page.evaluate(()=>WeekwiseAuthFixture.calls.find(c=>c.kind==='signup').options.data.weekwise_referral_code),'FIXTURE-INVITE');assert.equal(await page.locator('#cloudAuthForm').getAttribute('aria-busy'),'false');
 }finally{await context.close();}
});
test('password-reset feedback remains visible and recovery requires only the new password fields',async()=>{
 const {context,page,errors}=await open();try{
  await page.locator('#cloudEmail').fill('fixture@example.invalid');await page.locator('#cloudForgotPassword').click();await page.waitForFunction(()=>document.querySelector('#cloudStatus').textContent.includes('Password-reset email sent'));await page.locator('#cloudSignUpBtn').click();await page.locator('#cloudSignInMode').click();assert.equal(await page.locator('#cloudStatus').textContent(),'');await page.locator('#cloudEmail').fill('');await page.evaluate(()=>WeekwiseAuthFixture.recover());await page.locator('#utilityModal').waitFor({state:'visible'});assert.equal(await page.locator('#cloudEmailWrap').isVisible(),false);assert.equal(await page.locator('#cloudEmail').evaluate(el=>el.required),false);assert.equal(await page.locator('#cloudConfirmPassword').isVisible(),true);assert.equal(await page.locator('#cloudPassword').getAttribute('autocomplete'),'new-password');await page.locator('#cloudPassword').fill('fresh-fixture-password');await page.locator('#cloudConfirmPassword').fill('fresh-fixture-password');await snap(page,'phone-recovery');await page.locator('#cloudSignInBtn').click();await page.waitForFunction(()=>document.querySelector('#cloudStatus').textContent.includes('Password updated successfully'));assert.equal(await page.evaluate(()=>WeekwiseAuthFixture.calls.filter(c=>c.kind==='update').length),1);assert.equal(await page.locator('#cloudPassword').inputValue(),'');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('the visible keyboard viewport keeps the last credential field and submit action reachable',async()=>{
 const {context,page}=await open(390,{viewportMock:true});try{
  await credentials(page);await page.evaluate(()=>{window.__authViewportFixture.height=460;window.__authViewportFixture.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.body.classList.contains('keyboard-open'));assert.equal(await page.locator('#weekwiseHome').isVisible(),false,'marketing content yields to the account form while the software keyboard is open');await page.waitForTimeout(100);await page.waitForFunction(()=>['cloudPassword','cloudSignInBtn'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=0&&r.bottom<=460;}));const geometry=await page.evaluate(()=>Object.fromEntries(['cloudPassword','cloudSignInBtn'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{top:r.top,bottom:r.bottom}];})));await snap(page,'keyboard-signin');for(const [id,r]of Object.entries(geometry)){assert.ok(r.top>=0&&r.bottom<=460,id+' remains inside the visible keyboard viewport: '+JSON.stringify(r));}await page.locator('#cloudSignUpBtn').click();await credentials(page);await page.locator('#cloudConfirmPassword').fill('fixture-password');await page.locator('#cloudReferralCode').fill('fixture-invite');await page.waitForTimeout(100);await page.waitForFunction(()=>{const r=document.getElementById('cloudSignInBtn').getBoundingClientRect();return r.top>=0&&r.bottom<=460;});const r=await page.locator('#cloudSignInBtn').boundingBox();await snap(page,'keyboard-signup');assert.ok(r.y>=0&&r.y+r.height<=460,'Create account remains reachable after invite input: '+JSON.stringify(r));
 }finally{await context.close();}
});
test('entry layouts fit narrow phones and pass automated accessibility checks in light and dark themes',async()=>{
 const results=[];for(const width of [320,390,1440]){const {context,page}=await open(width);try{
  await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){await page.evaluate(theme=>document.body.setAttribute('data-theme',theme),theme);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));results.push({width,theme,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target),details:v.nodes.map(n=>n.failureSummary)})),incomplete:result.incomplete.map(v=>v.id)});await snap(page,width+'-'+theme);}
 }finally{await context.close();}}
 fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-auth.json'),JSON.stringify(results,null,2));assert.deepEqual(results.flatMap(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact))),[]);
});

test('home and sign-in are separate routes with browser Back, direct reload and no form on the homepage',async()=>{
 const {context,page,errors}=await open(390,{entry:'home'});try{
  const before=await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2'));
  assert.equal(await page.locator('#weekwiseHome').isVisible(),true);assert.equal(await page.locator('#cloudEmail').isVisible(),false);
  await page.locator('.ww-public-nav-cta').click();await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(new URL(page.url()).searchParams.get('page'),'signin');assert.equal(await page.locator('#wwHomeMain').isVisible(),false);assert.equal(await page.locator('#cloudEmail').isVisible(),true);assert.equal(await page.locator('#cloudEmail').isEnabled(),true);
  await page.goBack();await page.locator('#wwHomeMain').waitFor({state:'visible'});assert.equal(await page.locator('#cloudEmail').isVisible(),false);
  await page.goForward();await page.locator('#cloudEmail').waitFor({state:'visible'});await page.reload();await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(await page.locator('#wwHomeMain').isVisible(),false);
  await page.locator('[data-entry-home]').click();await page.locator('#wwHomeMain').waitFor({state:'visible'});assert.equal(await page.locator('#wwHomeMain').isVisible(),true);assert.equal(new URL(page.url()).searchParams.has('page'),false);assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2')),before);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('installed phone app skips marketing on first launch and explicit sign-out, while sessions land on Today',async()=>{
 for(const initialUser of [false,true]){
  const {context,page,errors}=await open(390,{entry:'home',installed:true,initialUser});try{
   assert.equal(await page.locator('#weekwiseHome').isVisible(),false);
   if(initialUser){await page.locator('#signinLanding').waitFor({state:'hidden'});assert.equal(await page.locator('body').getAttribute('data-active-view'),'today');await page.locator('#moreActions > summary').click();await page.locator('#cloudMenuBtn').click();page.on('dialog',d=>d.accept());await page.locator('#cloudSignOut').click();await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(await page.locator('#weekwiseHome').isVisible(),false);assert.equal(await page.locator('#signinLocalContinue').isVisible(),false);assert.equal(await page.locator('.wrap').evaluate(el=>el.inert),true);}
   else assert.equal(await page.locator('#cloudEmail').isVisible(),true);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
});

test('signed-in desktop visits bypass public and account pages and fresh login opens Today',async()=>{
 for(const entry of ['home','signin']){
  const {context,page,errors}=await open(1440,{entry,initialUser:true});try{await page.locator('#signinLanding').waitFor({state:'hidden'});assert.equal(await page.locator('body').getAttribute('data-active-view'),'today');assert.equal(new URL(page.url()).searchParams.has('page'),false);assert.equal(await page.title(),'Weekwise — Your planner');assert.deepEqual(errors,[]);}finally{await context.close();}
 }
 const {context,page}=await open(1440,{entry:'home'});try{await page.locator('.ww-public-nav-cta').click();await page.locator('#cloudEmail').waitFor({state:'visible'});await credentials(page);await page.locator('#cloudSignInBtn').click();await page.locator('#signinLanding').waitFor({state:'hidden'});assert.equal(await page.locator('body').getAttribute('data-active-view'),'today');assert.equal(new URL(page.url()).searchParams.has('page'),false);}finally{await context.close();}
});

test('all six Settings categories retain controls, unsaved fields and accessible phone layouts',async()=>{
 for(const width of [320,390,1440]){
  const {context,page,errors}=await open(width,{initialUser:true});try{
   await page.locator('#signinLanding').waitFor({state:'hidden'});if(width<=760)await page.locator('#mobileNavigationToggle').click();await page.locator('#workspaceSidebar [data-workspace-view=settings]').click();const before=await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2'));
   await page.locator('#personalFullName').fill('Unfinished settings name');
   for(const key of ['profile','appearance','planning','reminders','data','help']){await page.locator('[data-settings-category='+key+']').click();assert.equal(await page.locator('.settings-category-panel:visible').count(),1);assert.equal(await page.locator('#settings-'+key).isVisible(),true);assert.equal(await page.locator('[data-settings-category='+key+']').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
   await page.locator('[data-settings-category=profile]').click();assert.equal(await page.locator('#personalFullName').inputValue(),'Unfinished settings name');assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2')),before);
   await page.locator('[data-settings-category=planning]').click();assert.equal(await page.locator('#settings-planning [data-zone-conversion]').count(),1);await page.locator('[data-settings-category=data]').click();for(const id of ['exportBtn','importBtn','exportCalendarBtn','importCalendarBtn','downloadReviewDrafts'])assert.equal(await page.locator('#'+id).isVisible(),true);
   if(width===390){await page.addScriptTag({content:axe.source});for(const key of ['profile','appearance','planning','reminders','data','help']){await page.locator('[data-settings-category='+key+']').click();for(const theme of ['light','dark']){await page.evaluate(t=>document.body.dataset.theme=t,theme);await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.target?.closest('#weekwiseHome,#settingsWorkspace')).every(a=>a.playState==='finished'||a.playState==='idle'));const audit=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],key+' '+theme);}}await page.evaluate(()=>document.body.dataset.theme='light');await page.locator('[data-settings-category=profile]').click();await snap(page,'organised-settings');}
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
});

test('homepage content and installed launch URL reflow and retain their distinct entry behaviour',async()=>{
 for(const width of [320,390,1440]){
  const {context,page}=await open(width,{entry:'home'});try{
   await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.target?.closest('#weekwiseHome,#settingsWorkspace')).every(a=>a.playState==='finished'||a.playState==='idle'));await page.addScriptTag({content:axe.source});for(const theme of ['light','dark']){await page.evaluate(t=>document.body.dataset.theme=t,theme);await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.target?.closest('#weekwiseHome,#settingsWorkspace')).every(a=>a.playState==='finished'||a.playState==='idle'));const audit=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));fs.writeFileSync(path.join(root,'test-results','axe-'+engine+'-homepage-'+width+'-'+theme+'.json'),JSON.stringify(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))));assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],width+' '+theme+' homepage');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);if(width===390)await snap(page,'homepage-'+theme);}
   await page.goto(origin+'?view=today&launch=app',{waitUntil:'domcontentloaded'});await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(await page.locator('#wwHomeMain').isVisible(),false);await page.reload();await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(await page.locator('#wwHomeMain').isVisible(),false);
  }finally{await context.close();}
 }
});
