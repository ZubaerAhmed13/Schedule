import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import axe from "axe-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const siteRoot=path.resolve(root,process.env.WEEKWISE_TEST_SITE_ROOT||".");
let server;
let browser;
let origin;

const supabaseStub = String.raw`
(() => {
 let user={id:'weekwise-browser-test-user',email:'browser-test@example.invalid'},listeners=[];
 const session=()=>user?{access_token:'browser-test-access-token:'+user.id,user}:null;
 const client={auth:{onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:session()}};},async getUser(){return {data:{user}};},async signOut(){user=null;listeners.forEach(fn=>fn('SIGNED_OUT',null));return {};},async signInWithPassword(){return {data:{session:session(),user}};},async signUp(){return {data:{session:session(),user}};},async resetPasswordForEmail(){return {};}}
 ,from(){return {select(){return {eq(key,id){return {async maybeSingle(){const response=await fetch('/__weekwise_test_cloud?user='+encodeURIComponent(id));return {data:await response.json(),error:null};}};}};}};}};
 window.WeekwiseTestAuth={setUser(id){user=id?{id,email:id+'@example.invalid'}:null;listeners.forEach(fn=>fn(user?'SIGNED_IN':'SIGNED_OUT',session()));}};
 window.supabase={createClient(){return client;}};
})();
`;
const mockRows=new Map();

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url || "/", origin || "http://127.0.0.1").pathname);
  let target = path.resolve(siteRoot, "." + pathname);
  if (target !== siteRoot && !target.startsWith(siteRoot + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  } catch (_) {
    // A missing path is reported below.
  }
  fs.readFile(target, (error, body) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const mime = ext === ".html" ? "text/html; charset=utf-8"
      : ext === ".js" ? "text/javascript; charset=utf-8"
      : ext === ".css" ? "text/css; charset=utf-8"
      : ext === ".json" || ext === ".webmanifest" ? "application/json; charset=utf-8"
      : ext === ".svg" ? "image/svg+xml"
      : "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
    res.end(body);
  });
}

before(async () => {
  server = http.createServer(serveStatic);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}/`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function openPlanner(viewport, options={}) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: options.serviceWorkers||"block",
    isMobile: viewport.width <= 430,
    hasTouch: viewport.width <= 430
  });
  await context.route("**/supabase.min.js", route => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: supabaseStub
  }));
  const rows=options.rows||new Map(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
  await context.route('**/__weekwise_test_cloud?*',route=>{const user=new URL(route.request().url()).searchParams.get('user');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows.get(user)||null)});});
  await context.route('**/rest/v1/rpc/weekwise_save',route=>{const request=route.request();if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});const user=request.headers().authorization?.split('browser-test-access-token:')[1];assert.ok(user,'cloud writes use the captured mock token');const args=request.postDataJSON(),row=rows.get(user),revision=row?.revision||0;if(args.p_expected_revision!==revision)return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify([{saved:false,...row,revision}])});const next={user_id:user,data:args.p_data,revision:revision+1,updated_at:new Date().toISOString()};rows.set(user,next);return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify([{saved:true,...next}])});});
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const gate = document.querySelector("#signinLanding");
    return !!gate && gate.hidden === true;
  }, null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector("#daysGrid") !== null, null, { timeout: 5000 });
  // Sign-in intentionally lands on Today; navigate to Calendar before asserting calendar controls.
  await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();
  await page.locator("#calendarToolbar").waitFor({ state: "visible", timeout: 5000 });
  return { context, page };
}

async function createScheduledTask(page, title) {
  await page.locator("#addTaskBtn").click();
  await page.locator("#taskModal").waitFor({ state: "visible" });
  await page.locator("#modalTitleInput").fill(title);
  await page.locator("#modalDay").selectOption(String(new Date().getDay()));
  await page.locator("#modalTime").fill("17:30");
  await page.locator("#modalEndTime").fill("18:00");
  if(page.viewportSize().width<=430){const fits=await page.locator('#taskModal .modal').evaluate(dialog=>{const bounds=dialog.getBoundingClientRect();return [...dialog.querySelectorAll('input,select,textarea')].filter(el=>el.getClientRects().length).every(el=>{const r=el.getBoundingClientRect();return r.left>=bounds.left-1&&r.right<=bounds.right+1;});});assert.equal(fits,true,'mobile editor controls fit inside the dialog');}
  if(title==="Cross-view regression activity"||title==="Mobile regression activity")await page.screenshot({animations:'disabled',path:path.join(root,"test-results","editor-"+page.viewportSize().width+".png")});
  await page.locator("#saveTaskBtn").click();
  await page.locator("#taskModal").waitFor({ state: "hidden" });
  await page.waitForFunction(
    taskTitle => document.querySelector("#daysGrid")?.innerText.includes(taskTitle),
    title,
    { timeout: 10000 }
  );
}

async function countStoredTasksNamed(page,title){return page.evaluate(target=>Object.values(JSON.parse(localStorage.getItem('weekwise-planner-v2')||'{}').weeks||{}).flatMap(w=>w.tasks||[]).filter(t=>t.title===target).length,title);}

test("one scheduled activity stays connected across Day, Week, Month, Agenda and Year views", async () => {
  const { context, page } = await openPlanner({ width: 1440, height: 1000 });
  try {
    assert.equal(await page.locator("#daysGrid .cal-event").count(), 0, "planner starts without preloaded calendar activities");
    const title = "Cross-view regression activity";
    await createScheduledTask(page, title);
    assert.equal(await countStoredTasksNamed(page, title), 1, "one canonical task record is stored");

    for (const view of ["day", "week", "month", "agenda", "year"]) {
      await page.locator(`#${view}ViewBtn`).click();
      await page.waitForFunction(
        id => document.querySelector("#" + id)?.getAttribute("aria-pressed") === "true",
        view + "ViewBtn"
      );
      assert.equal(await countStoredTasksNamed(page, title), 1, `switching to ${view} does not duplicate or discard the task`);
      if (view !== "year") {
        await page.waitForFunction(
          taskTitle => document.querySelector("#daysGrid")?.innerText.includes(taskTitle),
          title,
          { timeout: 10000 }
        );
      }
    }

    await page.locator("#weekViewBtn").click();
    await page.waitForFunction(taskTitle => document.querySelector("#daysGrid")?.innerText.includes(taskTitle), title);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#signinLanding")?.hidden === true, null, { timeout: 15000 });
    assert.equal(await countStoredTasksNamed(page, title), 1, "activity survives reload without duplicate records");
  } finally {
    await context.close();
  }
});


test("activity editor saves edits, reopens fresh values, isolates records, and protects unsaved changes", async () => {
  const { context, page } = await openPlanner({ width: 1440, height: 1000 });
  try {
    const originalTitle = "Editor lifecycle activity A";
    const secondTitle = "Editor lifecycle activity B";
    const editedTitle = "Editor lifecycle activity A updated";
    const savedNote = "Edited note survives reload";

    await createScheduledTask(page, originalTitle);
    await createScheduledTask(page, secondTitle);

    await page.locator("#daysGrid .cal-event .event-title[data-edit]").filter({ hasText: originalTitle }).first().click();
    await page.locator("#taskModal").waitFor({ state: "visible" });
    const originalId = await page.locator("#editTaskId").inputValue();
    assert.ok(originalId, "editing must target the existing record ID");
    assert.equal(await page.locator("#modalTitleInput").inputValue(), originalTitle);

    const nextDay = (new Date().getDay() + 1) % 7;
    await page.locator("#modalTitleInput").fill(editedTitle);
    await page.locator("#modalNote").fill(savedNote);
    assert.equal(await page.locator("#modalTitleInput").inputValue(),editedTitle,"focusing notes must not insert text into the title");
    assert.equal(await page.locator("#modalNote").inputValue(),savedNote);
    await page.locator("#modalDay").selectOption(String(nextDay));
    await page.locator("#modalTime").fill("19:00");
    await page.locator("#modalEndTime").fill("19:45");
    // Commit the end-time field explicitly; the form syncs its duration on blur.
    const endTimeState = async () => page.evaluate(() => ({
      start: document.querySelector("#modalTime")?.value,
      end: document.querySelector("#modalEndTime")?.value,
      duration: document.querySelector("#modalDuration")?.value,
      active: document.activeElement?.id,
      startValidity: document.querySelector("#modalTime")?.validationMessage,
      endValidity: document.querySelector("#modalEndTime")?.validationMessage
    }));
    const afterFill = await endTimeState();
    await page.locator("#modalEndTime").press("Tab");
    const afterBlur = await endTimeState();
    assert.equal(afterBlur.end, "19:45", "end-time input retains the value entered by the user");
    assert.equal(afterBlur.duration, "45",
      "changing the end time updates the saved duration before submission");
    await page.locator("#saveTaskBtn").click();
    await page.locator("#taskModal").waitFor({ state: "hidden" });

    assert.equal(await countStoredTasksNamed(page, originalTitle), 0, "editing must not leave an old-title duplicate");
    const editorSavedState = await page.evaluate(() => ({
      tasks: Object.values(JSON.parse(localStorage.getItem('weekwise-planner-v2') || '{}').weeks || {}).flatMap(w => w.tasks || []).map(t => ({id:t.id,title:t.title,day:t.day,start:t.start})),
      toast: document.querySelector('#toast')?.textContent,
      titleField: document.querySelector('#modalTitleInput')?.value
    }));
    assert.equal(await countStoredTasksNamed(page, editedTitle), 1, "editing must update one canonical record: " + JSON.stringify(editorSavedState));

    // The editor moved the task to another day. Switch to Week explicitly so the
    // assertion is independent of whether the app initially opened in Day view.
    await page.locator("#weekViewBtn").click();
    await page.waitForFunction(
      () => document.querySelector("#weekViewBtn")?.getAttribute("aria-pressed") === "true"
    );
    await page.waitForFunction(
      title => document.querySelector("#daysGrid")?.innerText.includes(title),
      editedTitle,
      { timeout: 10000 }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#signinLanding")?.hidden === true, null, { timeout: 15000 });
    // Reload may restore the task workspace rather than the calendar panel. Reopen
    // Calendar explicitly before interacting with calendar-only edit controls.
    await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();
    await page.locator("#calendarToolbar").waitFor({ state: "visible", timeout: 5000 });
    await page.locator("#weekViewBtn").click();
    await page.waitForFunction(
      () => document.querySelector("#weekViewBtn")?.getAttribute("aria-pressed") === "true"
    );
    await page.waitForFunction(
      title => document.querySelector("#daysGrid")?.innerText.includes(title),
      editedTitle,
      { timeout: 10000 }
    );

    await page.locator("#daysGrid .cal-event .event-title[data-edit]").filter({ hasText: editedTitle }).first().click();
    await page.locator("#taskModal").waitFor({ state: "visible" });
    assert.equal(await page.locator("#editTaskId").inputValue(), originalId, "edit keeps the original activity ID");
    assert.equal(await page.locator("#modalTitleInput").inputValue(), editedTitle, "latest saved title is reopened");
    assert.equal(await page.locator("#modalNote").inputValue(), savedNote, "latest saved note is reopened");
    assert.equal(await page.locator("#modalDay").inputValue(), String(nextDay), "edited day is persisted");
    assert.equal(await page.locator("#modalTime").inputValue(), "19:00", "edited start time is persisted");
    assert.equal(await page.locator("#modalEndTime").inputValue(), "19:45", "edited end time is persisted");

    await page.locator("#modalNote").fill("Cancel should ask before discarding");
    const cancelPrompt = page.waitForEvent("dialog");
    const cancelClick = page.locator("#closeModal").click();
    const cancelDialog = await cancelPrompt;
    assert.match(cancelDialog.message(), /discard your unsaved changes/i);
    await cancelDialog.dismiss();
    await cancelClick;
    assert.equal(await page.locator("#taskModal").isVisible(), true, "declining Cancel keeps the editor open");
    assert.equal(await page.locator("#modalNote").inputValue(), "Cancel should ask before discarding");

    await page.locator("#modalNote").fill("This change must be discarded");
    const dismissedPrompt = page.waitForEvent("dialog");
    const firstEscape = page.keyboard.press("Escape");
    const dismissDialog = await dismissedPrompt;
    assert.match(dismissDialog.message(), /discard your unsaved changes/i);
    await dismissDialog.dismiss();
    await firstEscape;
    assert.equal(await page.locator("#taskModal").isVisible(), true, "declining discard keeps the editor open");

    const acceptedPrompt = page.waitForEvent("dialog");
    const secondEscape = page.keyboard.press("Escape");
    const acceptDialog = await acceptedPrompt;
    assert.match(acceptDialog.message(), /discard your unsaved changes/i);
    await acceptDialog.accept();
    await secondEscape;
    await page.locator("#taskModal").waitFor({ state: "hidden" });

    await page.locator("#daysGrid .cal-event .event-title[data-edit]").filter({ hasText: editedTitle }).first().click();
    assert.equal(await page.locator("#modalNote").inputValue(), savedNote, "discarding edits leaves persisted values unchanged");
    await page.locator("#closeModal").click();
    await page.locator("#taskModal").waitFor({ state: "hidden" });

    await page.locator("#daysGrid .cal-event .event-title[data-edit]").filter({ hasText: secondTitle }).first().click();
    await page.locator("#taskModal").waitFor({ state: "visible", timeout: 5000 });
    assert.notEqual(await page.locator("#editTaskId").inputValue(), "", "switching records opens the editor in edit mode");
    assert.equal(await page.locator("#modalTitleInput").inputValue(), secondTitle, "switching records loads the second title");
    assert.notEqual(await page.locator("#editTaskId").inputValue(), originalId, "the second record has a distinct ID");
    assert.notEqual(await page.locator("#modalNote").inputValue(), "This change must be discarded",
      "the second editor must not inherit the first editor's unsaved value");
    await page.locator("#closeModal").click();
    await page.locator("#taskModal").waitFor({ state: "hidden" });

    await page.locator("#addTaskBtn").click();
    assert.equal(await page.locator("#editTaskId").inputValue(), "", "new activity mode clears any selected record ID");
    assert.equal(await page.locator("#modalTitleInput").inputValue(), "", "new activity mode starts with a clean title field");
    assert.equal(await page.locator("#modalTitle").innerText(), "Add a task", "the modal clearly returns to creation mode");
    await page.locator("#closeModal").click();
    await page.locator("#taskModal").waitFor({ state: "hidden" });
  } finally {
    await context.close();
  }
});

test("mobile planner remains usable without page-level horizontal overflow", async () => {
  const { context, page } = await openPlanner({ width: 390, height: 844 });
  try {
    const hasNoHorizontalOverflow = () => page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1
    );
    assert.equal(await hasNoHorizontalOverflow(), true, "empty planner fits the mobile viewport");

    await createScheduledTask(page, "Mobile regression activity");
    for (const view of ["day", "week", "month", "agenda"]) {
      await page.locator(`#${view}ViewBtn`).click();
      await page.waitForFunction(id => document.querySelector("#" + id)?.getAttribute("aria-pressed") === "true", view + "ViewBtn");
      assert.equal(await hasNoHorizontalOverflow(), true, `${view} view has no page-level horizontal overflow at 390px`);
      await page.waitForFunction(taskTitle => document.querySelector("#daysGrid")?.innerText.includes(taskTitle), "Mobile regression activity", { timeout: 10000 });
    }
  } finally {
    await context.close();
  }
});

test("calendar connections panel reports backend-not-configured instead of implying OAuth is active", async () => {
  const { context, page } = await openPlanner({ width: 1280, height: 900 });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  try {
    await page.locator("#moreActions > summary").click();
    await page.locator("#calendarConnectionsMenuBtn").click();

    const status = page.locator("#calendarConnectionsStatus");
    await status.waitFor({ state: "visible", timeout: 5000 });
    await page.waitForFunction(() => {
      const text = document.querySelector("#calendarConnectionsStatus")?.textContent || "";
      return /calendar service is not deployed|calendar backend is reachable|credentials are not configured|not configured/i.test(text);
    }, null, { timeout: 5000 });

    assert.equal(await page.locator("#connectGoogleCalendarBtn").isDisabled(), true,
      "Google connect remains disabled when no OAuth backend/configuration is present");
    assert.equal(await page.locator("#connectMicrosoftCalendarBtn").isDisabled(), true,
      "Microsoft connect remains disabled when no OAuth backend/configuration is present");
    assert.deepEqual(pageErrors, [], "calendar panel does not introduce browser runtime errors");
  } finally {
    await context.close();
  }
});

async function readPlannerStore(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('weekwise-planner-v2')));
}
async function createFlexibleTask(page,title,estimate='60',mode='flexible') {
  await page.locator('#addTaskBtn').click();
  await page.locator('#modalTitleInput').fill(title);
  await page.locator('#modalNoSchedule').check();
  await page.locator('#modalFocusEstimate').fill(estimate);
  await page.locator('#modalSchedulingMode').selectOption(mode);
  await page.locator('#saveTaskBtn').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
}
async function openFuturePlan(page) {
  await page.locator('#workspaceSidebar [data-workspace-view="plan"]').click();
  const futureWeek=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()+7-date.getDay());return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');});
  await page.locator('#planWeek').fill(futureWeek);
  await page.locator('#planPreferences button[type="submit"]').click();
  await page.locator('#planResults').waitFor({state:'visible'});
}

test('Smart Week Builder previews without writes, accepts selected tasks, persists and safely undoes',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await createFlexibleTask(page,'Plan task A');await createFlexibleTask(page,'Plan task B');await createFlexibleTask(page,'Protected fixed task','60','fixed');
  await page.locator('#workspaceSidebar [data-workspace-view="plan"]').click();
  const before=await readPlannerStore(page);await openFuturePlan(page);
  assert.deepEqual(await readPlannerStore(page),before,'generating a preview never writes tasks');
  assert.equal(await page.locator('[name="planProposal"]').count(),2,'fixed tasks are excluded');
  await page.locator('[name="planProposal"]').nth(1).uncheck();
  await page.locator('#planApply').click();
  await page.waitForFunction(()=>document.querySelector('#planStatus')?.textContent.includes('1 tasks scheduled'));
  const after=await readPlannerStore(page),all=Object.values(after.weeks).flatMap(w=>w.tasks);
  assert.equal(all.filter(t=>t.title==='Plan task A').length,1);assert.equal(all.filter(t=>t.title==='Plan task B').length,1);
  const scheduled=all.filter(t=>t.title.startsWith('Plan task')&&t.start!==null);assert.equal(scheduled.length,1);
  assert.equal(all.find(t=>t.title==='Protected fixed task').start,null);
  await page.locator('#planUndo').click();assert.deepEqual(await readPlannerStore(page),before,'undo restores the same identifiers and fields');
  await openFuturePlan(page);await page.locator('#planApply').click();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  assert.equal(Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).filter(t=>t.title.startsWith('Plan task')&&t.start!==null).length,2,'accepted placements survive reload');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('Plan is usable on desktop, tablet and mobile and warns about unknown estimates',async()=>{
 for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844}]){
  const {context,page}=await openPlanner(viewport);
  try{
   await createFlexibleTask(page,'Unknown duration','');await openFuturePlan(page);
   assert.equal(await page.locator('[name="planProposal"]').count(),0);
   assert.equal(await page.locator('#planSummary').evaluate(el=>getComputedStyle(el).display),'grid','Plan stylesheet loads and applies');
   assert.match(await page.locator('#planUnscheduled').innerText(),/Duration unknown/);
   assert.equal(await page.locator('#planApply').isDisabled(),true);
   assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1),true,'Plan fits viewport '+viewport.width);
   await page.evaluate(()=>{const NativeDate=window.Date,future=NativeDate.now()+120000;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[future]));}static now(){return future;}};try{window.dispatchEvent(new Event('focus'));}finally{window.Date=NativeDate;}});
   assert.equal(await page.locator('#mobileDayPicker').isVisible(),false,'calendar day controls stay within Calendar after a clock refresh');
   assert.equal(await page.locator('#unscheduledBox').isVisible(),false,'Plan uses its own unscheduled-task feedback');
   await page.locator('#toast.show').waitFor({state:'hidden'});
   await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#workspaceMain').focus({preventScroll:true});});await page.screenshot({animations:'disabled',path:path.join(root,'test-results',`plan-${viewport.width}.png`),fullPage:true});
  }finally{await context.close();}
 }
});

test('legacy non-custom records and recurring occurrence exceptions survive application reload',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  const expected=await page.evaluate(()=>{
   const store=JSON.parse(localStorage.getItem('weekwise-planner-v2')),week=Object.keys(store.weeks)[0];
   const date=new Date(week+'T12:00:00');date.setDate(date.getDate()+1);
   const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
   const task={id:'legacy-record',title:'German practice',day:1,start:600,duration:60,custom:false,fixed:true,done:true,note:'Preserve history',reminderTimes:[key+'T09:00']};
   const occurrence={id:'rec-exception',title:'Occurrence exception',day:1,start:800,duration:45,custom:true,seriesId:'series',occurrenceDate:key,note:'My edited occurrence',subtasks:[{id:'part',title:'Keep completed',done:true}]};
   store.weeks[week].tasks=[task,occurrence];store.weeks[week].metadata='Keep';
   store.recurringTemplates=[{id:'series',title:'Template title',frequency:'weekly',days:[1],startDate:key,duration:30,start:900}];
   localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));return {week,task,occurrence};
  });
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  const stored=await readPlannerStore(page);assert.deepEqual(stored.weeks[expected.week].tasks.find(t=>t.id==='legacy-record'),expected.task);
  assert.deepEqual(stored.weeks[expected.week].tasks.find(t=>t.id==='rec-exception'),expected.occurrence);assert.equal(stored.weeks[expected.week].metadata,'Keep');
 }finally{await context.close();}
});

test('corrupt planner storage stays untouched and exposes a recovery notice',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await page.evaluate(()=>localStorage.setItem('weekwise-planner-v2','{damaged original'));
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#storageRecoveryNotice').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-planner-v2')),'{damaged original');
  assert.match(await page.locator('#storageRecoveryNotice').innerText(),/paused to protect/);
 }finally{await context.close();}
});

test('invalid backup is rejected before replacing local records',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await createScheduledTask(page,'Preserve before invalid restore');const before=await readPlannerStore(page);
  await page.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({settings:[],weeks:{}}))});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('must be objects'));
  assert.deepEqual(await readPlannerStore(page),before);
 }finally{await context.close();}
});

test('focus pause, reload and partial finish retain active seconds once',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});try{
 await createFlexibleTask(page,'Focus record');await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();await page.locator('#focusTaskSelect').selectOption({label:await page.locator('#focusTaskSelect option').nth(1).textContent()});await page.locator('#focusStartBtn').click();
 await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('weekwise-focus-active-v1:'));const state=JSON.parse(localStorage.getItem(key));state.runningSince-=65000;localStorage.setItem(key,JSON.stringify(state));});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();assert.equal(await page.locator('#focusStartBtn').innerText(),'Pause');await page.locator('#focusStartBtn').click();
 const paused=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('weekwise-focus-active-v1:'))));return state.activeMs;});assert.ok(paused>=65000);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();assert.equal(await page.locator('#focusStartBtn').innerText(),'Resume');await page.locator('#focusFinishBtn').click();const sessions=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-focus-sessions-v1')));assert.equal(sessions.length,1);assert.equal(sessions[0].taskTitle,'Focus record');assert.ok(sessions[0].seconds>=65&&sessions[0].seconds<80);assert.equal(sessions[0].completed,false);await page.locator('#focusFinishBtn').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-focus-sessions-v1')).length),1);
 }finally{await context.close();}
});

test('account switches isolate tasks and returning to an account restores its records',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});try{await createFlexibleTask(page,'Account A private task');await page.evaluate(()=>WeekwiseTestAuth.setUser('account-b'));await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true&&JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')||'{}').userId==='account-b');assert.equal(await countStoredTasksNamed(page,'Account A private task'),0);await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();await createFlexibleTask(page,'Account B private task');await page.evaluate(()=>WeekwiseTestAuth.setUser('weekwise-browser-test-user'));await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true&&JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')||'{}').userId==='weekwise-browser-test-user');assert.equal(await countStoredTasksNamed(page,'Account A private task'),1);assert.equal(await countStoredTasksNamed(page,'Account B private task'),0);assert.ok(await page.evaluate(()=>localStorage.getItem('weekwise-account-cache-v1:account-b')));
 }finally{await context.close();}
});

test('unknown flexible work can be split into linked estimated parts and planned',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});try{await createFlexibleTask(page,'Large responsibility','');await openFuturePlan(page);await page.locator('[data-plan-split-id]').click();await page.locator('#planSplitDialog').waitFor({state:'visible'});const parts=page.locator('#planSplitParts .plan-window-row');await parts.nth(0).locator('input[type=text]').fill('First part');await parts.nth(0).locator('input[type=number]').fill('30');await parts.nth(1).locator('input[type=text]').fill('Second part');await parts.nth(1).locator('input[type=number]').fill('45');await page.locator('#planSplitForm button[type=submit]').click();await page.locator('#planSplitDialog').waitFor({state:'hidden'});assert.equal(await page.locator('[name=planProposal]').count(),2);const tasks=Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks),parent=tasks.find(t=>t.title==='Large responsibility');assert.equal(parent.planningChildren.length,2);assert.equal(tasks.filter(t=>t.parentTaskId===parent.id).length,2);await page.locator('#planApply').click();assert.match(await page.locator('#planStatus').innerText(),/2 tasks scheduled/);
 }finally{await context.close();}
});

test('keyboard dialog traps focus and restores the opener; Insights reviews persist',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});try{await page.locator('#globalCaptureBtn').click();await page.locator('#deleteTaskTemplateBtn').focus();for(let i=0;i<35;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#taskModal').contains(document.activeElement)),true);}await page.keyboard.press('Escape');await page.locator('#taskModal').waitFor({state:'hidden'});await page.locator('#workspaceSidebar [data-workspace-view="insights"]').click();await page.locator('#reviewworked').fill('Kept enough buffer');await page.locator('#weeklyReviewForm button[type=submit]').click();assert.match(await page.locator('#reviewStatus').innerText(),/saved/);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#workspaceSidebar [data-workspace-view="insights"]').click();assert.equal(await page.locator('#reviewworked').inputValue(),'Kept enough buffer');await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#workspaceMain').focus({preventScroll:true});});await page.screenshot({animations:'disabled',path:path.join(root,'test-results','insights-desktop.png'),fullPage:true});
 }finally{await context.close();}
});

test('device-only planner works offline after its service worker has cached the app',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await context.route('https://**/*',route=>route.abort());const page=await context.newPage();try{await page.goto(origin,{waitUntil:'load'});await page.locator('#signinLocalContinue').click();await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#workspaceCaptureInput').fill('Offline responsibility');await page.locator('#workspaceCaptureForm button[type=submit]').click();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);assert.equal(await countStoredTasksNamed(page,'Offline responsibility'),1);await page.locator('#workspaceCaptureInput').fill('Created without network');await page.locator('#workspaceCaptureForm button[type=submit]').click();assert.equal(await countStoredTasksNamed(page,'Created without network'),1);assert.equal(await page.locator('#cloudMenuBadge').textContent(),'Local');await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#workspaceMain').focus({preventScroll:true});});await page.screenshot({animations:'disabled',path:path.join(root,'test-results','today-offline-mobile.png'),fullPage:true});
 }finally{await context.close();}
});

test('failed local task save keeps the previous records and never reports success',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{await createScheduledTask(page,'Saved before quota failure');const before=await readPlannerStore(page);await page.locator('#addTaskBtn').click();await page.locator('#modalTitleInput').fill('Must not appear saved');await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='weekwise-planner-v2')throw new DOMException('Test quota','QuotaExceededError');return original.call(this,key,value);};});await page.locator('#saveTaskBtn').click();assert.equal(await page.locator('#taskModal').isVisible(),true);assert.match(await page.locator('#toast').textContent(),/Could not save/);assert.deepEqual(await readPlannerStore(page),before);}finally{await context.close();}});

test('a damaged habit collection blocks writes without replacing its original bytes',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{for(const raw of ['{original damaged habits',JSON.stringify([{id:'invalid-habit',title:'Keep original fields',checkIns:{original:'not an array'}}])]){await page.evaluate(value=>localStorage.setItem('weekwise-habits-v1',value),raw);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#storageRecoveryNotice').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-habits-v1')),raw);assert.match(await page.locator('#storageRecoveryNotice').innerText(),/paused to protect/);}}finally{await context.close();}});

test('interpreted capture asks for review and can keep the original text',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{await page.locator('#workspaceSidebar [data-workspace-view="inbox"]').click();await page.locator('#workspaceCaptureInput').fill('Submit report tomorrow at 15:00');const before=await readPlannerStore(page);await page.locator('#workspaceCaptureForm button[type=submit]').click();await page.locator('#captureConfirmDialog').waitFor({state:'visible'});assert.deepEqual(await readPlannerStore(page),before);await page.locator('#captureKeepRaw').click();assert.equal(await countStoredTasksNamed(page,'Submit report tomorrow at 15:00'),1);}finally{await context.close();}});

test('two devices detect a revision conflict without overwriting either planner',async()=>{
 const rows=new Map(),a=await openPlanner({width:1440,height:1000},{rows}),b=await openPlanner({width:1440,height:1000},{rows});try{await createFlexibleTask(a.page,'Device A change');await a.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced').catch(async error=>{throw new Error(error.message+' '+JSON.stringify(await a.page.evaluate(()=>({status:document.querySelector('#cloudStatus').textContent,meta:JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1'))}))));});await createFlexibleTask(b.page,'Device B change');await b.page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Needs review');assert.equal(await countStoredTasksNamed(b.page,'Device B change'),1);const remote=rows.get('weekwise-browser-test-user');assert.equal(Object.values(remote.data.store.weeks).flatMap(w=>w.tasks).filter(t=>t.title==='Device A change').length,1);assert.equal(Object.values(remote.data.store.weeks).flatMap(w=>w.tasks).filter(t=>t.title==='Device B change').length,0);}finally{await a.context.close();await b.context.close();}
});

test('Recover moves an unfinished recurring occurrence without regenerating the old copy',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{await page.evaluate(()=>{const store=JSON.parse(localStorage.getItem('weekwise-planner-v2')),week=Object.keys(store.weeks)[0];store.weeks[week].tasks.push({id:'recover-recurring',title:'Recover occurrence',day:0,start:600,duration:30,estimatedDurationMinutes:30,unscheduled:false,done:false,seriesId:'recovery-series',occurrenceDate:week,recurrence:'weekly',note:'Keep original details'},{id:'recover-fixed',title:'Keep fixed commitment',day:0,start:600,duration:30,unscheduled:false,fixed:true,done:false});store.recurringTemplates=[{id:'recovery-series',title:'Recurring template',frequency:'weekly',startDate:week,duration:30,start:600}];localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();await openFuturePlan(page);await page.locator('#planRecover').click();assert.equal(await page.locator('[name=planProposal]').count(),1);assert.match(await page.locator('#planRecoveryNote').innerText(),/unfinished past/);await page.locator('#planApply').click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);const all=Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks);assert.equal(all.filter(t=>t.id==='recover-recurring').length,1);const moved=all.find(t=>t.id==='recover-recurring');assert.equal(moved.note,'Keep original details');assert.equal(moved.reschedulingHistory.length,1);assert.equal(all.find(t=>t.id==='recover-fixed').day,0);assert.equal(all.filter(t=>t.seriesId==='recovery-series'&&t.occurrenceDate===moved.occurrenceDate).length,1);}finally{await context.close();}});

test('a valid confirmed restore replaces included collections and preserves omitted ones',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{await createFlexibleTask(page,'Existing task');const before=await readPlannerStore(page),week=Object.keys(before.weeks)[0],restored={...before,app:'Weekwise',version:6,weeks:{[week]:{metadata:'Retain backup metadata',tasks:[{id:'restored-task',title:'Restored safely',day:1,start:null,duration:30,unscheduled:true,done:true}]}},habits:[{id:'restored-habit',title:'Restored habit',checkIns:['2026-10-12'],targetPerWeek:3}]};page.once('dialog',d=>d.accept());await page.locator('#importFile').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(restored))});await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks).some(w=>w.tasks.some(t=>t.id==='restored-task')));assert.equal(await countStoredTasksNamed(page,'Restored safely'),1);assert.equal(await countStoredTasksNamed(page,'Existing task'),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-habits-v1'))[0].title),'Restored habit');assert.ok(await page.evaluate(()=>localStorage.getItem('weekwise-pre-restore-v1')));}finally{await context.close();}});

test('light and dark daily, planning and insights views fit phones and retain readable focus',async()=>{for(const width of [390,820,1440]){const {context,page}=await openPlanner({width,height:width===390?844:1000});try{await createFlexibleTask(page,'A meaningful priority');if(width===390)await page.locator('#mobileNavigationToggle').click();await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-settings-panel="settingsPanel"]').click();await page.locator('#themeMode').selectOption('dark');await page.locator('#closeUtility').click();for(const view of ['today','plan','insights']){await page.locator('#workspaceSidebar [data-workspace-view="'+view+'"]').click();assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1),true);await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#workspaceMain').focus({preventScroll:true});});await page.screenshot({animations:'disabled',path:path.join(root,'test-results',view+'-dark-'+width+'.png'),fullPage:true});}assert.equal(await page.locator('body').getAttribute('data-theme'),'dark');}finally{await context.close();}}});

test('a second tab cannot overwrite a newer local task before cloud synchronization',async()=>{const {context,page}=await openPlanner({width:1440,height:1000}),second=await context.newPage();try{await second.goto(origin,{waitUntil:'domcontentloaded'});await second.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await second.locator('#globalCaptureBtn').click();await second.locator('#modalTitleInput').fill('Stale tab task');await createFlexibleTask(page,'Newer local task');const before=await readPlannerStore(page);await second.locator('#saveTaskBtn').click();assert.match(await second.locator('#toast').textContent(),/Another tab/);assert.deepEqual(await readPlannerStore(second),before);assert.equal(await countStoredTasksNamed(second,'Newer local task'),1);assert.equal(await countStoredTasksNamed(second,'Stale tab task'),0);}finally{await context.close();}});

test('autosaved editor drafts survive reload and are restored without changing canonical records',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{const before=await readPlannerStore(page);await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('A responsibility I was editing');await page.locator('#modalNote').fill('Keep my unfinished notes');await page.waitForFunction(()=>!!localStorage.getItem('weekwise-editor-draft-v1:weekwise-browser-test-user'));assert.deepEqual(await readPlannerStore(page),before);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#restoreEditorDraft').click();await page.locator('#taskModal').waitFor({state:'visible'});assert.equal(await page.locator('#modalTitleInput').inputValue(),'A responsibility I was editing');assert.equal(await page.locator('#modalNote').inputValue(),'Keep my unfinished notes');assert.deepEqual(await readPlannerStore(page),before);await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});assert.equal(await countStoredTasksNamed(page,'A responsibility I was editing'),1);assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-editor-draft-v1:weekwise-browser-test-user')),null);}finally{await context.close();}});

test('a draft of a changed activity restores as a copy and preserves the newer original',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{await createScheduledTask(page,'Original activity');await page.locator('#daysGrid .event-title[data-edit]').filter({hasText:'Original activity'}).first().click();await page.locator('#modalNote').fill('My pending draft note');await page.waitForFunction(()=>!!localStorage.getItem('weekwise-editor-draft-v1:weekwise-browser-test-user'));await page.evaluate(()=>{const store=JSON.parse(localStorage.getItem('weekwise-planner-v2'));const task=Object.values(store.weeks).flatMap(w=>w.tasks).find(t=>t.title==='Original activity');task.note='A newer edit';localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);await page.locator('#restoreEditorDraft').click();assert.equal(await page.locator('#editTaskId').inputValue(),'');assert.equal(await page.locator('#modalNoSchedule').isChecked(),true);assert.equal(await page.locator('#modalNote').inputValue(),'My pending draft note');const current=Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).find(t=>t.title==='Original activity');assert.equal(current.note,'A newer edit');}finally{await context.close();}});

test('10,000-record lists keep bounded DOM, search all records and preserve full canonical data',async()=>{const {context,page}=await openPlanner({width:1440,height:1000});try{const metrics=[];for(const count of [1000,5000,10000]){await page.evaluate(count=>{const store=JSON.parse(localStorage.getItem('weekwise-planner-v2')),week=Object.keys(store.weeks)[0];store.weeks[week].tasks=Array.from({length:count},(_,i)=>({id:'large-'+i,title:'Synthetic responsibility '+String(i).padStart(5,'0'),day:i%7,start:null,duration:30,unscheduled:true,done:false,listId:'inbox',folderName:'Large dataset',type:'other'}));localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));},count);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);const measurement=await page.evaluate(()=>new Promise(resolve=>{const start=performance.now();document.querySelector('#workspaceSidebar [data-workspace-view="inbox"]').click();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({navigationToPaintMs:Math.round(performance.now()-start),rows:document.querySelectorAll('#workspaceTaskList .workspace-task-row').length})));}));assert.equal(measurement.rows,100);metrics.push({records:count,...measurement});assert.equal(Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).length,count);}console.log('Synthetic browser list measurements: '+JSON.stringify(metrics));await page.locator('#workspaceTaskList [data-list-more]').click();assert.equal(await page.locator('#workspaceTaskList .workspace-task-row').count(),200);await page.locator('#workspaceSearch').fill('Synthetic responsibility 09999');assert.equal(await page.locator('#workspaceTaskList .workspace-task-row').count(),1);assert.match(await page.locator('#workspaceTaskList').innerText(),/09999/);assert.equal(Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).length,10000);await page.screenshot({animations:'disabled',path:path.join(root,'test-results','large-list-search.png')});}finally{await context.close();}});


test('privacy settings download owner-scoped editor history without deleting drafts',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await page.locator('#globalCaptureBtn').click();
  await page.locator('#modalTitleInput').fill('Private unfinished export test');
  await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('weekwise-editor-draft-v1:')));
  const owner=await page.evaluate(()=>{
   const current=Object.keys(localStorage).find(k=>k.startsWith('weekwise-editor-draft-v1:'));
   const owner=current.slice('weekwise-editor-draft-v1:'.length);
   localStorage.setItem('weekwise-editor-draft-archive-v1:'+owner+':old','{unreadable but preserved');
   localStorage.setItem('weekwise-editor-draft-v1:another-owner','private other owner');
   return owner;
  });
  await page.reload();
  await page.locator('[data-workspace-view="settings"]').first().click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportEditorHistoryBtn').click()]);
  const history=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(history.owner,owner);
  assert.equal(history.kind,'editor-draft-history');
  assert.ok(history.entries.some(e=>e.raw==='{unreadable but preserved'));
  assert.ok(history.entries.some(e=>e.raw.includes('Private unfinished export test')));
  assert.ok(!history.entries.some(e=>e.raw==='private other owner'));
  const unchanged=await page.evaluate(owner=>localStorage.getItem('weekwise-editor-draft-archive-v1:'+owner+':old'),owner);
  assert.equal(unchanged,'{unreadable but preserved');
 }finally{await context.close();}
});


test('Monday-first Month and Year preference survives reload without migrating Sunday task weeks',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  const initial=await readPlannerStore(page);
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();
  await page.locator('[data-settings-panel="settingsPanel"]').first().click();
  await page.locator('#calendarGridStartDay').selectOption('1');
  await page.locator('#applySettings').click();
  await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();
  await page.locator('#monthViewBtn').click();
  assert.deepEqual(await page.locator('.month-weekday').allTextContents(),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
  const first=await page.locator('.month-day-cell').first().getAttribute('data-month-day');
  const expected=await page.evaluate(()=>{const today=new Date(),start=new Date(today.getFullYear(),today.getMonth(),1,12);start.setDate(start.getDate()-(start.getDay()+6)%7);return [start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-')});
  assert.equal(first,expected);
  await page.locator('#yearViewBtn').click();
  assert.deepEqual(await page.locator('.year-month').first().locator('.year-weekday').allInnerTexts(),['M','T','W','T','F','S','S']);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();
  await page.locator('#monthViewBtn').click();
  assert.equal(await page.locator('.month-weekday').first().textContent(),'Mon');
  const after=await readPlannerStore(page);
  assert.deepEqual(after.weeks,initial.weeks);
  assert.equal(after.settings.calendarGridStartDay,1);
 }finally{await context.close();}
});


test('TZID iCalendar import previews and commits atomically without changing existing records',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 const ics=['BEGIN:VCALENDAR','VERSION:2.0',
  'BEGIN:VEVENT','UID:berlin-2026-07@example.invalid','DTSTART;TZID=Europe/Berlin:20260701T100000','DTEND;TZID=Europe/Berlin:20260701T110000','SUMMARY:Berlin lecture','END:VEVENT',
  'BEGIN:VEVENT','UID:ambiguous@example.invalid','DTSTART;TZID=Europe/Berlin:20261025T023000','DTEND;TZID=Europe/Berlin:20261025T033000','SUMMARY:Unsafe DST time','END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
 const file={name:'safe-tzid.ics',mimeType:'text/calendar',buffer:Buffer.from(ics)};
 try{
  const before=await readPlannerStore(page);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('#calendarImportFile').setInputFiles(file);
  await page.waitForTimeout(250);
  assert.deepEqual(await readPlannerStore(page),before);
  page.once('dialog',dialog=>{assert.match(dialog.message(),/1 unsupported events/);dialog.accept();});
  await page.locator('#calendarImportFile').setInputFiles(file);
  await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('weekwise-planner-v2')).weeks).some(w=>w.tasks.some(t=>t.externalUid==='berlin-2026-07@example.invalid')));
  const after=await readPlannerStore(page);
  const imported=Object.values(after.weeks).flatMap(w=>w.tasks).filter(t=>t.calendarImportSource==='ics');
  assert.equal(imported.length,1);
  assert.equal(imported[0].externalUid,'berlin-2026-07@example.invalid');
  assert.equal(imported[0].title,'Berlin lecture');
  assert.equal(imported[0].duration,60);
  const localHour=await page.evaluate(()=>new Date('2026-07-01T08:00:00.000Z').getHours());
  assert.equal(imported[0].start,localHour*60);
  assert.ok(!imported.some(t=>t.title==='Unsafe DST time'));
  assert.ok(Object.entries(before.weeks).every(([week,w])=>JSON.stringify((after.weeks[week]?.tasks||[]).filter(t=>!t.calendarImportSource))===JSON.stringify(w.tasks)));
  await page.locator('#calendarImportFile').setInputFiles(file);
  await page.waitForTimeout(250);
  const twice=await readPlannerStore(page);
  assert.deepEqual(twice,after);
 }finally{await context.close();}
});


test('recurring editor opt-in previews saved future metadata without moving times or history',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await page.locator('#addTaskBtn').click();
  await page.locator('#modalTitleInput').fill('Original repeat label');
  await page.locator('#modalTime').fill('17:30');
  await page.locator('#modalEndTime').fill('18:00');
  await page.locator('#modalRecurrence').selectOption('daily');
  await page.locator('#saveTaskBtn').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
  const before=await readPlannerStore(page);
  const all=Object.values(before.weeks).flatMap(w=>w.tasks);
  const source=all.find(t=>t.seriesId&&t.title==='Original repeat label');
  assert.ok(source);
  const upcoming=all.filter(t=>t.seriesId===source.seriesId&&t.occurrenceDate>source.occurrenceDate);
  assert.ok(upcoming.length>0,'at least one future saved occurrence was created');
  const beforeFuture=new Map(upcoming.map(t=>[t.id,{start:t.start,day:t.day,reminderTimes:t.reminderTimes,occurrenceDate:t.occurrenceDate}]));
  await page.locator('#daysGrid .event-title[data-edit]').filter({hasText:'Original repeat label'}).first().click();
  await page.locator('#modalRecurrenceScope').selectOption('future');
  assert.equal(await page.locator('#recurringBulkField').isVisible(),true);
  await page.locator('#modalRecurringBulkMetadata').check();
  await page.locator('#modalTitleInput').fill('Updated repeat label');
  await page.locator('#modalNote').fill('Safe descriptive update');
  let reviewed=false;
  page.once('dialog',dialog=>{assert.match(dialog.message(),/unchanged future recurring/);reviewed=true;dialog.accept();});
  await page.locator('#saveTaskBtn').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
  assert.equal(reviewed,true);
  const after=await readPlannerStore(page);
  const changed=Object.values(after.weeks).flatMap(w=>w.tasks).filter(t=>beforeFuture.has(t.id));
  assert.equal(changed.length,upcoming.length);
  for(const t of changed){
   assert.equal(t.title,'Updated repeat label');
   assert.equal(t.note,'Safe descriptive update');
   const prev=beforeFuture.get(t.id);
   assert.equal(t.start,prev.start);assert.equal(t.day,prev.day);
   assert.deepEqual(t.reminderTimes,prev.reminderTimes);
   assert.equal(t.occurrenceDate,prev.occurrenceDate);
  }
 }finally{await context.close();}
});


test('optional first-run guide can be skipped, restored from Settings, and navigated without adding records',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  const guide=page.locator('#todayOnboarding');
  await guide.waitFor({state:'visible'});
  assert.match(await guide.locator('#todayOnboardingTitle').innerText(),/Make Weekwise yours/);
  assert.equal(await guide.locator('[data-experience-capture]').count(),1);
  const before=await readPlannerStore(page);
  await guide.locator('[data-experience-guide-dismiss]').click();
  await guide.waitFor({state:'hidden'});
  assert.deepEqual(await readPlannerStore(page),before,'dismissing a guide never touches planner records');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  assert.equal(await page.locator('#todayOnboarding').count(),0,'dismissal persists on this device');
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();
  await page.locator('[data-experience-guide-show]').click();
  await page.locator('#todayOnboarding').waitFor({state:'visible'});
  await page.locator('#todayOnboarding [data-experience-plan]').click();
  assert.equal(await page.locator('#planWorkspace').isVisible(),true);
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await page.locator('#todayOnboarding [data-experience-calendar]').click();
  assert.equal(await page.locator('#calendarToolbar').isVisible(),true);
 }finally{await context.close();}
});

test('task and settings dialogs trap keyboard focus and restore their actual launcher',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  const launcher=page.locator('#globalCaptureBtn');
  await launcher.focus();
  await page.keyboard.press('Enter');
  await page.locator('#taskModal').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement?.closest('#taskModal')!==null);
  assert.equal(await page.locator('#taskModal [role="dialog"]').count(),0,'dialog must not contain a second nested dialog role');
  assert.equal(await page.locator('#taskModal').getAttribute('aria-modal'),'true');
  assert.equal(await page.locator('.wrap').evaluate(el=>el.inert),true);
  await page.locator('#saveTaskBtn').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'modalTitleInput','Tab wraps to first enabled editor input');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'saveTaskBtn','Shift+Tab wraps to final editor action');
  await page.locator('#closeModal').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.id==='globalCaptureBtn');
  assert.equal(await page.locator('.wrap').evaluate(el=>el.inert),false);
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();
  const settingsButton=page.locator('[data-settings-panel="settingsPanel"]').first();
  await settingsButton.focus();
  await page.keyboard.press('Enter');
  await page.locator('#utilityModal').waitFor({state:'visible'});
  assert.equal(await page.locator('#utilityModal [role="dialog"]').count(),1);
  await page.waitForFunction(()=>document.activeElement?.closest('#utilityModal')!==null);
  await page.locator('#closeUtility').click();
  await page.locator('#utilityModal').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-settings-panel')==='settingsPanel');
 }finally{await context.close();}
});


test('Insights shows seven daily workload values and distinguishes planned from recorded time',async()=>{
 const {context,page}=await openPlanner({width:1440,height:900});
 try{
  await createScheduledTask(page,'Scheduled workload test');
  await page.locator('#workspaceSidebar [data-workspace-view="insights"]').click();
  await page.locator('#insightsWorkload').waitFor({state:'visible'});
  assert.equal(await page.locator('#insightsWorkload .insights-load-row').count(),7);
  assert.match(await page.locator('#insightsSummary').innerText(),/Scheduled time/);
  assert.match(await page.locator('#insightsWorkload').innerText(),/30 min/);
  assert.match(await page.locator('#insightsScheduleStability').innerText(),/No recorded focus sessions linked/);
  assert.match(await page.locator('#insightsScheduleStability').innerText(),/not a complete record of actual work/);
  await page.setViewportSize({width:390,height:844});
  const measured=await page.locator('#insightsWorkload').evaluate(el=>({inner:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(measured.scroll<=measured.inner+2,'workload bars fit narrow screen without horizontal clipping');
 }finally{await context.close();}
});


test('PWA reload guard respects unfinished task, quick capture and weekly review input',async()=>{
 const {context,page}=await openPlanner({width:1440,height:900});
 try{
  const guard=()=>page.evaluate(()=>window.WeekwiseUpdateSafety.reason(document,window.WeekwiseExperience.hasPendingReview()));
  assert.equal(await guard(),'');
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await page.locator('#workspaceCaptureInput').fill('Draft that is not yet added');
  assert.match(await guard(),/quick-capture/);
  await page.locator('#workspaceCaptureInput').fill('');
  assert.equal(await guard(),'');
  await page.locator('#globalCaptureBtn').click();
  await page.locator('#taskModal').waitFor({state:'visible'});
  assert.match(await guard(),/open editor/);
  await page.locator('#closeModal').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
  assert.equal(await guard(),'');
  await page.locator('#workspaceSidebar [data-workspace-view="insights"]').click();
  await page.locator('#reviewworked').fill('A reflection that has not been saved');
  assert.match(await guard(),/weekly review/);
  await page.locator('#weeklyReviewForm button[type="submit"]').click();
  assert.equal(await guard(),'');
 }finally{await context.close();}
});


test('automated WCAG A/AA and contrast checks across Today, Settings, Plan and editor',async()=>{
 const {context,page}=await openPlanner({width:1440,height:900});
 const snapshots=[];
 try{
  await page.addScriptTag({content:axe.source});
  const audit=async label=>{
   const result=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   const problems=result.violations.map(v=>({id:v.id,impact:v.impact,description:v.help,targets:v.nodes.slice(0,8).map(n=>n.target.join(' ')),totalNodes:v.nodes.length}));
   snapshots.push({view:label,violations:problems,incomplete:result.incomplete.map(v=>({id:v.id,targets:v.nodes.length}))});
  };
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await audit('today');
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();
  await audit('settings');
  await page.locator('#workspaceSidebar [data-workspace-view="plan"]').click();
  await audit('plan');
  await page.locator('#globalCaptureBtn').click();
  await page.locator('#taskModal').waitFor({state:'visible'});
  await audit('task editor');
  await page.locator('#closeModal').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.evaluate(()=>document.body.setAttribute('data-theme','dark'));
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await audit('today dark');
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();
  await audit('settings dark');
  await page.evaluate(()=>document.body.setAttribute('data-theme','light'));
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await page.setViewportSize({width:320,height:780});
  await audit('today 320px');
  const widths=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(widths.document<=widths.viewport+2&&widths.body<=widths.viewport+2,'Today must reflow at 320 CSS px without horizontal page scrolling: '+JSON.stringify(widths));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'test-results','axe-wcag-audit.json'),JSON.stringify(snapshots,null,2));
  const significant=snapshots.flatMap(view=>view.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>view.view+': '+v.id+' ('+v.impact+') ×'+v.totalNodes+': '+v.targets.join(', ')));
  assert.deepEqual(significant,[],'Serious/critical WCAG A/AA violations:\n'+significant.join('\n'));
 }finally{await context.close();}
});
