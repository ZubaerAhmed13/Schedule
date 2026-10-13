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
    timezoneId:options.timezoneId||"UTC",
    serviceWorkers: options.serviceWorkers||"block",
    isMobile: viewport.width <= 430,
    hasTouch: viewport.width <= 430
  });
  if(options.now)await context.addInitScript(({epoch})=>{const OriginalDate=Date;class PlannerDate extends OriginalDate{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}}window.Date=PlannerDate;},{epoch:options.now});
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
async function createFlexibleTask(page,title,estimate='60',mode='flexible',listId=null) {
  if(await page.locator('#addTaskBtn').isVisible())await page.locator('#addTaskBtn').click();else await page.locator('#globalCaptureBtn').click();
  await page.locator('#modalTitleInput').fill(title);
  await page.locator('#modalNoSchedule').check();
  await page.locator('#modalFocusEstimate').fill(estimate);
  await page.locator('#modalSchedulingMode').selectOption(mode);
  if(listId)await page.locator('#modalListId').selectOption(listId);
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
  await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();
  await audit('focus dialog');
  await page.locator('#closeUtility').click();
  await page.locator('#globalCaptureBtn').click();
  await page.locator('#taskModal').waitFor({state:'visible'});
  await audit('task editor');
  await page.locator('#closeModal').click();
  await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.evaluate(()=>document.body.setAttribute('data-theme','dark'));
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await page.waitForTimeout(300); // avoid auditing temporary CSS color transitions after theme switches
  await audit('today dark');
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();
  await audit('settings dark');
  await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();
  await audit('focus dialog dark');
  await page.locator('#closeUtility').click();
  await page.evaluate(()=>document.body.setAttribute('data-theme','light'));
  await page.locator('#workspaceSidebar [data-workspace-view="today"]').click();
  await page.setViewportSize({width:320,height:780});
  await page.waitForTimeout(300); // ensure responsive transition styles have settled
  await audit('today 320px');
  const widths=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(widths.document<=widths.viewport+2&&widths.body<=widths.viewport+2,'Today must reflow at 320 CSS px without horizontal page scrolling: '+JSON.stringify(widths));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'test-results','axe-wcag-audit.json'),JSON.stringify(snapshots,null,2));
  const significant=snapshots.flatMap(view=>view.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>view.view+': '+v.id+' ('+v.impact+') ×'+v.totalNodes+': '+v.targets.join(', ')));
  assert.deepEqual(significant,[],'Serious/critical WCAG A/AA violations:\n'+significant.join('\n'));
 }finally{await context.close();}
});


test('flexible weekly habit goal keeps actual check-ins and restores its editor preference',async()=>{
 const {context,page}=await openPlanner({width:1440,height:900});
 try{
  await page.locator('#workspaceSidebar [data-workspace-action="habits"]').click();
  await page.locator('#utilityModal').waitFor({state:'visible'});
  await page.locator('#habitFrequencyMode').selectOption('weekly-flexible');
  assert.equal(await page.locator('#habitScheduleFieldset').isVisible(),false);
  await page.locator('#habitName').fill('Practise when time allows');
  await page.locator('#habitTargetPerWeek').selectOption('2');
  await page.locator('#saveHabitBtn').click();
  const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-habits-v1')));
  assert.equal(first.length,1);
  assert.equal(first[0].frequencyMode,'weekly-flexible');
  assert.equal(first[0].targetPerWeek,2);
  assert.match(await page.locator('#habitTrackerList').innerText(),/Any 2 days this week/);
  await page.locator('[data-habit-check]:not([disabled])').last().click();
  const afterCheck=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-habits-v1')));
  assert.equal(afterCheck[0].checkIns.length,1);
  await page.locator('[data-habit-edit]').first().click();
  assert.equal(await page.locator('#habitFrequencyMode').inputValue(),'weekly-flexible');
  assert.equal(await page.locator('#habitScheduleFieldset').isVisible(),false);
  await page.locator('#habitGoal').fill('One small practice session');
  await page.locator('#saveHabitBtn').click();
  const afterEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-habits-v1')));
  assert.equal(afterEdit[0].checkIns.length,1,'editing frequency does not discard past check-ins');
  assert.equal(afterEdit[0].goal,'One small practice session');
 }finally{await context.close();}
});

test('large Focus picker searches every task, bounds options and preserves a completed session link',async()=>{
 const {context,page}=await openPlanner({width:390,height:844});
 try{
  await page.evaluate(()=>{const store=JSON.parse(localStorage.getItem('weekwise-planner-v2')),week=Object.keys(store.weeks)[0];store.weeks[week].tasks=Array.from({length:10000},(_,i)=>({id:'focus-large-'+i,title:'Focus responsibility '+String(i).padStart(5,'0'),note:i===9999?'Practise German vocabulary':'',tags:i===9999?['language-goal']:[],day:i%7,start:null,duration:30,unscheduled:true,done:false,listId:'inbox',type:'other'}));localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  if(!await page.locator('#workspaceSidebar [data-workspace-action="focus"]').isVisible())await page.locator('#mobileNavigationToggle').click();
  await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();
  assert.equal(await page.locator('#focusTaskSelect option').count(),101);
  assert.match(await page.locator('#focusTaskCount').innerText(),/of 10000/);
  await page.locator('#focusTaskNext').click();assert.match(await page.locator('#focusTaskCount').innerText(),/101–200/);
  await page.locator('#focusTaskPrevious').click();assert.match(await page.locator('#focusTaskCount').innerText(),/1–100/);
  await page.locator('#focusTaskSearch').fill('GERMAN vocabulary');
  await page.waitForFunction(()=>document.querySelector('#focusTaskSelect')?.options.length===2);
  const ref=await page.locator('#focusTaskSelect option').nth(1).getAttribute('value');
  await page.locator('#focusTaskSelect').selectOption(ref);
  await page.locator('#focusTaskSearch').fill('no matching responsibility');
  await page.waitForFunction(()=>document.querySelector('#focusTaskCount')?.textContent.includes('No matching'));
  assert.equal(await page.locator('#focusTaskSelect').inputValue(),ref,'filter changes retain the chosen task');
  assert.match(await page.locator('#focusTaskSelect option:checked').innerText(),/09999/);
  await page.locator('#focusPreset').selectOption('50');
  await page.locator('#focusStartBtn').click();assert.equal(await page.locator('#focusTaskSearch').isDisabled(),true);assert.equal(await page.locator('#focusPreset').isDisabled(),true);
  assert.equal(await page.locator('#focusTaskNext').isDisabled(),true);
  await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('weekwise-focus-active-v1:'));const state=JSON.parse(localStorage.getItem(key));state.activeMs=65000;state.runningSince=null;localStorage.setItem(key,JSON.stringify(state));const store=JSON.parse(localStorage.getItem('weekwise-planner-v2'));Object.values(store.weeks).flatMap(w=>w.tasks).find(t=>t.id==='focus-large-9999').done=true;localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  if(!await page.locator('#workspaceSidebar [data-workspace-action="focus"]').isVisible())await page.locator('#mobileNavigationToggle').click();
  await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();
  assert.equal(await page.locator('#focusTaskSelect').inputValue(),ref);
  assert.match(await page.locator('#focusTaskSelect option:checked').innerText(),/completed/);
  assert.equal(await page.locator('#focusTaskSelect option').count(),102,'one pinned task plus one bounded page and no-link choice');
  assert.equal(await page.locator('#focusTaskSearch').isDisabled(),true,'a paused session keeps its identity');
  assert.equal(await page.locator('#focusPreset').inputValue(),'50','persisted session length remains visible after reload');
  const bounds=await page.locator('#focusPanel').evaluate(panel=>{const rect=panel.getBoundingClientRect();return [...panel.querySelectorAll('input,select,button')].every(el=>{const r=el.getBoundingClientRect();return r.left>=rect.left-1&&r.right<=rect.right+1;});});assert.equal(bounds,true,'picker controls fit narrow screen');
  await page.screenshot({animations:'disabled',path:path.join(root,'test-results','focus-large-mobile.png')});
  await page.locator('#focusFinishBtn').click();
  const sessions=await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-focus-sessions-v1')));
  assert.equal(sessions.length,1);assert.equal(sessions[0].taskId,'focus-large-9999');assert.equal(sessions[0].taskTitle,'Focus responsibility 09999');assert.equal(sessions[0].seconds,65);
  assert.equal(Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).length,10000);
 }finally{await context.close();}
});

test('Focus search and selection do not carry into another account',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await createFlexibleTask(page,'Owner A focus responsibility');
  await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();
  await page.locator('#focusTaskSearch').fill('Owner A');
  await page.waitForFunction(()=>document.querySelector('#focusTaskSelect')?.options.length===2);
  await page.locator('#focusTaskSelect').selectOption(await page.locator('#focusTaskSelect option').nth(1).getAttribute('value'));
  await page.locator('#closeUtility').click();await page.evaluate(()=>WeekwiseTestAuth.setUser('focus-owner-b'));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')||'{}').userId==='focus-owner-b');
  await page.locator('#workspaceSidebar [data-workspace-action="focus"]').click();
  assert.equal(await page.locator('#focusTaskSearch').inputValue(),'');assert.equal(await page.locator('#focusTaskSelect').inputValue(),'');assert.equal(await page.locator('#focusTaskSelect option').count(),1);
  assert.ok(!(await page.locator('#focusPanel').innerText()).includes('Owner A focus responsibility'));
 }finally{await context.close();}
});

test('task Archive and Recently removed preserve IDs, restore and guard Undo after newer edits',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await createFlexibleTask(page,'Recoverable responsibility','60','flexible','inbox');
  const original=Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).find(t=>t.title==='Recoverable responsibility');
  await page.locator('#workspaceSidebar [data-workspace-view="inbox"]').click();await page.locator('[data-workspace-edit]').first().click();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#archiveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  assert.equal(await countStoredTasksNamed(page,original.title),0);
  let stored=await readPlannerStore(page);assert.equal(stored.taskHistory.length,1);assert.deepEqual(stored.taskHistory[0].items[0].task,original);
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-task-history="archive"]').click();
  await page.locator('[data-history-restore]').click();assert.equal(await countStoredTasksNamed(page,original.title),1);
  assert.equal(Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks).find(t=>t.title===original.title).id,original.id);
  await page.locator('#closeUtility').click();await page.locator('#workspaceSidebar [data-workspace-view="inbox"]').click();await page.locator('[data-workspace-edit]').first().click();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-task-history="trash"]').click();await page.locator('#taskHistoryUndo').click();assert.equal(await countStoredTasksNamed(page,original.title),1);
  await page.locator('#closeUtility').click();await page.locator('#workspaceSidebar [data-workspace-view="inbox"]').click();await page.locator('[data-workspace-edit]').first().click();page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  await createFlexibleTask(page,'Newer preserved responsibility');
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-task-history="trash"]').click();await page.locator('#taskHistoryUndo').click();assert.match(await page.locator('#taskHistoryStatus').innerText(),/Newer changes are protected/);assert.equal(await countStoredTasksNamed(page,'Newer preserved responsibility'),1);
  await page.locator('[data-history-restore]').click();assert.equal(await countStoredTasksNamed(page,original.title),1);assert.equal(await countStoredTasksNamed(page,'Newer preserved responsibility'),1);
 }finally{await context.close();}
});

test('task history survives reload and another account cannot see archived records',async()=>{
 const {context,page}=await openPlanner({width:390,height:844});
 try{
  await createFlexibleTask(page,'Private archived responsibility','60','flexible','inbox');await page.locator('#workspaceSidebar [data-workspace-view="inbox"]').click();await page.locator('[data-workspace-edit]').first().click();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#archiveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);
  await page.locator('#mobileNavigationToggle').click();await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-task-history="archive"]').click();assert.match(await page.locator('#taskHistoryEntries').innerText(),/Private archived responsibility/);
  assert.equal(await page.locator('#taskHistoryEntries [data-history-restore]').count(),1);
  await page.screenshot({animations:'disabled',path:path.join(root,'test-results','task-history-mobile.png')});
  await page.locator('#closeUtility').click();await page.evaluate(()=>WeekwiseTestAuth.setUser('history-owner-b'));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')||'{}').userId==='history-owner-b');
  await page.locator('#mobileNavigationToggle').click();await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-task-history="archive"]').click();assert.equal(await page.locator('[data-history-restore]').count(),0);assert.ok(!(await page.locator('#taskHistoryEntries').innerText()).includes('Private archived responsibility'));
 }finally{await context.close();}
});


test('capture reproducible desktop and mobile lab render metrics without claiming field Core Web Vitals',async()=>{
 const results=[];
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const {context,page}=await openPlanner(viewport);
  try{
   const metrics=await page.evaluate(async()=>{
    let lcp=null,cls=0;const observers=[];
    if(PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')){
     const observer=new PerformanceObserver(list=>{for(const item of list.getEntries())lcp=item.startTime;});
     observer.observe({type:'largest-contentful-paint',buffered:true});observers.push(observer);
    }
    if(PerformanceObserver.supportedEntryTypes.includes('layout-shift')){
     const observer=new PerformanceObserver(list=>{for(const item of list.getEntries())if(!item.hadRecentInput)cls+=item.value;});
     observer.observe({type:'layout-shift',buffered:true});observers.push(observer);
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    observers.forEach(observer=>observer.disconnect());
    const nav=performance.getEntriesByType('navigation')[0],
     fcp=performance.getEntriesByName('first-contentful-paint')[0],
     resources=performance.getEntriesByType('resource');
    return {
     navigationDomReadyMs:nav?.domContentLoadedEventEnd??null,
     firstContentfulPaintMs:fcp?.startTime??null,
     largestContentfulPaintSampleMs:lcp,
     cumulativeLayoutShiftSample:cls,
     networkResourceCount:resources.length,
     resourceBytesFromTiming:resources.reduce((sum,item)=>sum+(item.encodedBodySize||0),0),
     interactionToNextPaintSampleMs:null,
     fieldInp:null,
     deviceNotes:'Synthetic headless Chromium load only; no real-device network, real-world traffic or field INP.'
    };
   });
   for(const field of ['navigationDomReadyMs','cumulativeLayoutShiftSample','networkResourceCount','resourceBytesFromTiming']){
    assert.ok(Number.isFinite(metrics[field])&&metrics[field]>=0,field+' must be a recorded nonnegative lab value');
   }
   if(metrics.firstContentfulPaintMs!==null)assert.ok(Number.isFinite(metrics.firstContentfulPaintMs));
   if(metrics.largestContentfulPaintSampleMs!==null)assert.ok(Number.isFinite(metrics.largestContentfulPaintSampleMs));
   results.push({viewport,commit:process.env.GITHUB_SHA||'local',metrics});
  }finally{await context.close();}
 }
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
 fs.writeFileSync(path.join(root,'test-results','lab-performance.json'),JSON.stringify({kind:'synthetic-lab-performance',capturedAt:new Date().toISOString(),results},null,2));
 assert.equal(results.length,2);
});

test('recurring schedule preview changes cadence and saved slots only after approval, with guarded Undo',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await page.locator('#addTaskBtn').click();await page.locator('#modalTitleInput').fill('Reviewed recurring learning');await page.locator('#modalNoSchedule').check();await page.locator('#modalRecurrence').selectOption('weekly');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  const before=await readPlannerStore(page),records=Object.entries(before.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task}))),source=records.find(r=>r.task.title==='Reviewed recurring learning');assert.ok(records.filter(r=>r.task.seriesId===source.task.seriesId).length>=2);
  await page.locator('#daysGrid [data-edit="'+source.task.id+'"]').first().click();await page.locator('#seriesScheduleOpen').click();await page.locator('#seriesSchedulePanel').waitFor({state:'visible'});
  const nextDate=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()+2);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');});
  await page.locator('#seriesScheduleDate').fill(nextDate);await page.locator('#seriesScheduleFrequency').selectOption('daily');await page.locator('#seriesScheduleUnscheduled').uncheck();await page.locator('#seriesScheduleTime').fill('09:00');await page.locator('#seriesScheduleDuration').fill('45');await page.locator('#seriesScheduleBuild').click();
  assert.equal(await page.locator('#seriesScheduleApply').isDisabled(),false);assert.match(await page.locator('#seriesSchedulePreview').innerText(),/saved occurrences reviewed/);
  assert.deepEqual((await readPlannerStore(page)).weeks,before.weeks,'preview leaves original occurrence bytes unchanged');
  await page.locator('#seriesScheduleApply').click();assert.match(await page.locator('#seriesScheduleStatus').innerText(),/Confirm that you reviewed/);assert.deepEqual((await readPlannerStore(page)).weeks,before.weeks);
  await page.locator('#seriesScheduleReviewed').check();page.once('dialog',dialog=>dialog.accept());await page.locator('#seriesScheduleApply').click();assert.match(await page.locator('#seriesScheduleStatus').innerText(),/schedule saved/);
  const after=await readPlannerStore(page),moved=Object.values(after.weeks).flatMap(w=>w.tasks).find(t=>t.id===source.task.id);assert.equal(moved.start,540);assert.equal(moved.duration,45);assert.equal(moved.occurrenceDate,nextDate);assert.equal(after.recurringTemplates.find(r=>r.id===source.task.seriesId).frequency,'daily');assert.equal(moved.reschedulingHistory.at(-1).reason,'User-approved recurring schedule');
  await page.locator('#seriesScheduleUndo').click();assert.deepEqual((await readPlannerStore(page)).weeks,before.weeks);assert.deepEqual((await readPlannerStore(page)).recurringTemplates,before.recurringTemplates);
 }finally{await context.close();}
});

test('Monday Calendar crosses canonical week boundaries and Sunday planning saves to the correct week',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  const dates=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()+7+(1-date.getDay()+7)%7);const monday=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'),range=WeekwiseCalendarRange.range(monday,1),weekA=WeekwiseCalendarRange.range(monday,0)[0],weekB=range[6],store=JSON.parse(localStorage.getItem('weekwise-planner-v2'));store.weeks[weekA]={notes:'Preserve A',tasks:[{id:'mon-boundary',title:'Monday boundary record',day:1,start:600,duration:30},{id:'sun-flex',title:'Sunday flexible plan',day:1,start:null,unscheduled:true,estimatedDurationMinutes:30}]};store.weeks[weekB]={notes:'Preserve B',tasks:[{id:'sun-boundary',title:'Sunday boundary record',day:0,start:600,duration:30}]};localStorage.setItem('weekwise-planner-v2',JSON.stringify(store));return {monday,range,weekA,weekB};});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding')?.hidden===true);const before=await readPlannerStore(page);
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-settings-panel="settingsPanel"]').click();await page.locator('#planningWeekStart').selectOption('1');await page.locator('#weekStart').fill(dates.monday);await page.locator('#applySettings').click();
  assert.deepEqual((await readPlannerStore(page)).weeks[dates.weekA].tasks,before.weeks[dates.weekA].tasks);assert.deepEqual((await readPlannerStore(page)).weeks[dates.weekB].tasks,before.weeks[dates.weekB].tasks);
  await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();await page.locator('#weekViewBtn').click();
  const headings=await page.locator('#daysGrid .calendar-day-header [data-range-date]').evaluateAll(elements=>elements.map(el=>el.dataset.rangeDate));assert.deepEqual(headings,dates.range);await page.screenshot({animations:'disabled',path:path.join(root,'test-results','monday-calendar-desktop.png')});assert.match(await page.locator('#daysGrid').innerText(),/Monday boundary record/);assert.match(await page.locator('#daysGrid').innerText(),/Sunday boundary record/);
  await page.locator('#workspaceSidebar [data-workspace-view="plan"]').click();await page.locator('#planWeek').fill(dates.monday);for(const checkbox of await page.locator('[name="planDay"]').all())await checkbox.uncheck();await page.locator('[name="planDay"][value="0"]').check();await page.locator('#planBuffer').fill('0');await page.locator('#planBreak').fill('0');await page.locator('#planPreferences button[type="submit"]').click();assert.match(await page.locator('#planProposals').innerText(),new RegExp(dates.weekB));await page.locator('#planApply').click();
  const after=await readPlannerStore(page);assert.equal(after.weeks[dates.weekA].tasks.some(t=>t.id==='sun-flex'),false);assert.equal(after.weeks[dates.weekB].tasks.find(t=>t.id==='sun-flex').day,0);assert.equal(after.weeks[dates.weekB].notes,'Preserve B');await page.locator('#planUndo').click();assert.deepEqual((await readPlannerStore(page)).weeks[dates.weekA].tasks,before.weeks[dates.weekA].tasks);
 }finally{await context.close();}
});

test('an IANA Calendar zone projects one record through every view and edits the original clock',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await createScheduledTask(page,'Projected exact responsibility');const before=await readPlannerStore(page),source=Object.entries(before.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task}))).find(r=>r.task.title==='Projected exact responsibility');
  await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-settings-panel="settingsPanel"]').click();await page.locator('#calendarTimeZone').fill('Asia/Kolkata');await page.locator('#applySettings').click();assert.deepEqual((await readPlannerStore(page)).weeks,before.weeks);
  await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();for(const view of ['week','month','agenda','year','day']){await page.locator('#'+view+'ViewBtn').click();assert.match(await page.locator('#daysGrid').innerText(),/Projected exact responsibility/);assert.ok(await page.locator('#daysGrid [data-range-id="'+source.task.id+'"]').count()>0);}
  const expected=await page.evaluate(({week,task})=>{const row=WeekwiseCalendarRange.project({settings:{timeZone:'UTC'},weeks:{[week]:{tasks:[task]}}},'Asia/Kolkata')[0];return String(Math.floor(row.start/60)).padStart(2,'0')+':'+String(row.start%60).padStart(2,'0');},source);assert.match(await page.locator('#daysGrid').innerText(),new RegExp(expected));
  await page.locator('#daysGrid [data-range-edit][data-range-id="'+source.task.id+'"]').first().click();assert.equal(await page.locator('#modalTitleInput').inputValue(),source.task.title);assert.equal(await page.locator('#modalTime').inputValue(),'17:30');assert.match(await page.locator('#modalDescription').innerText(),/Clock fields use UTC/);await page.locator('#closeModal').click();assert.equal(await countStoredTasksNamed(page,source.task.title),1);
  await page.screenshot({animations:'disabled',path:path.join(root,'test-results','calendar-zone-desktop.png')});
 }finally{await context.close();}
});

async function openAccountErasure(page){
 if(!await page.locator('#workspaceSidebar [data-workspace-view="settings"]').isVisible())await page.locator('#mobileNavigationToggle').click();
 await page.locator('#workspaceSidebar [data-workspace-view="settings"]').click();await page.locator('[data-account-erase]').click();await page.locator('#accountEraseDialog').waitFor({state:'visible'});
}
async function fillAccountErasure(page){
 await page.locator('#accountErasePassword').fill('fixture-password');await page.locator('#accountErasePhrase').fill('DELETE MY WEEKWISE ACCOUNT');await page.locator('#accountEraseBackup').check();
}
function accountRoute(context,handler){
 return context.route('**/functions/v1/weekwise-account',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'},request=route.request();
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const result=await handler(request);return route.fulfill({status:result.status||200,headers,contentType:'application/json',body:JSON.stringify(result.body)});
 });
}
test('unconfigured account erasure stays disabled and preserves device records',async()=>{
 const {context,page}=await openPlanner({width:390,height:844});
 try{
  let posts=0;await accountRoute(context,request=>{if(request.method()==='POST')posts++;return {body:{configured:false,operation:'delete-own-account'}};});
  await page.evaluate(()=>localStorage.setItem('weekwise-account-cache-v1:weekwise-browser-test-user','preserved-original'));
  await openAccountErasure(page);await page.waitForFunction(()=>document.querySelector('#accountEraseStatus').textContent.includes('not activated'));
  assert.equal(await page.locator('#accountEraseSubmit').isDisabled(),true);assert.equal(posts,0);assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-account-cache-v1:weekwise-browser-test-user')),'preserved-original');
  await page.screenshot({animations:'disabled',path:path.join(root,'test-results','account-erasure-mobile.png')});await page.locator('#accountEraseClose').click();assert.equal(await page.locator('#accountEraseDialog').evaluate(el=>el.open),false);
 }finally{await context.close();}
});
test('account erasure rejects a mismatched server identity, then cleans only the confirmed owner after isolation',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  let wrong=true,posts=[];await accountRoute(context,request=>{if(request.method()==='GET')return {body:{configured:true,operation:'delete-own-account'}};posts.push({body:request.postDataJSON(),authorization:request.headers().authorization});return {body:{deleted:true,revokedRefreshSessions:true,owner:wrong?'other-owner':'weekwise-browser-test-user'}};});
  await page.evaluate(()=>{localStorage.setItem('weekwise-editor-draft-v1:weekwise-browser-test-user','{malformed');localStorage.setItem('weekwise-account-cache-v1:other-owner','other-original');});
  await openAccountErasure(page);await page.locator('#accountEraseSubmit').waitFor();await page.waitForFunction(()=>!document.querySelector('#accountEraseSubmit').disabled);await fillAccountErasure(page);page.once('dialog',d=>d.accept());await page.locator('#accountEraseSubmit').click();await page.waitForFunction(()=>document.querySelector('#accountEraseStatus').textContent.includes('did not confirm'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-editor-draft-v1:weekwise-browser-test-user')),'{malformed');assert.equal(await page.locator('#accountErasePassword').inputValue(),'');
  // Clear the synthetic malformed draft so normal account isolation can be checked.
  await page.evaluate(()=>localStorage.removeItem('weekwise-editor-draft-v1:weekwise-browser-test-user'));wrong=false;await fillAccountErasure(page);page.once('dialog',d=>d.accept());await page.locator('#accountEraseSubmit').click();await page.waitForFunction(()=>document.querySelector('#accountEraseStatus').textContent.includes('were deleted'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-account-cache-v1:weekwise-browser-test-user')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-account-cache-v1:other-owner')),'other-original');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')).userId),'');
  await page.locator('#accountEraseClose').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#accountErasePassword').evaluate(el=>el===document.activeElement),true,'native erasure dialog retains keyboard focus above the signed-out landing gate');
  assert.equal(posts.length,2);assert.deepEqual(Object.keys(posts[1].body).sort(),['backedUp','confirmation','password']);assert.equal(posts[1].authorization,'Bearer browser-test-access-token:weekwise-browser-test-user');
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>String(value).includes('fixture-password'))),false);
 }finally{await context.close();}
});
test('a delayed erasure response cleans its captured owner without signing out a newer account',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  let release,started;const began=new Promise(resolve=>started=resolve);await accountRoute(context,async request=>{if(request.method()==='GET')return {body:{configured:true,operation:'delete-own-account'}};started();await new Promise(resolve=>release=resolve);return {body:{deleted:true,revokedRefreshSessions:true,owner:'weekwise-browser-test-user'}};});
  await openAccountErasure(page);await page.waitForFunction(()=>!document.querySelector('#accountEraseSubmit').disabled);await fillAccountErasure(page);page.once('dialog',d=>d.accept());await page.locator('#accountEraseSubmit').click();await began;
  await page.evaluate(()=>window.WeekwiseTestAuth.setUser('newer-account'));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')||'{}').userId==='newer-account');release();await page.waitForFunction(()=>document.querySelector('#accountEraseStatus').textContent.includes('were deleted'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')).userId),'newer-account');assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-account-cache-v1:weekwise-browser-test-user')),null);
 }finally{await context.close();}
});

test('projected Calendar keyboard movement retains focus on phones and guards stale pointer moves',async()=>{
 const {context,page}=await openPlanner({width:390,height:844});
 try{
  await createScheduledTask(page,'Keyboard calendar responsibility');const before=await readPlannerStore(page),source=Object.entries(before.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task}))).find(r=>r.task.title==='Keyboard calendar responsibility');
  before.settings.calendarTimeZone='UTC';before.settings.timeZone='UTC';await page.evaluate(value=>localStorage.setItem('weekwise-planner-v2',JSON.stringify(value)),before);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);if(!await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').isVisible())await page.locator('#mobileNavigationToggle').click();await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();await page.locator('#dayViewBtn').click();
  const grip=page.locator('[data-range-drag][data-range-id="'+source.task.id+'"]');await grip.focus();await page.keyboard.press('ArrowUp');assert.equal((await readPlannerStore(page)).weeks[source.week].tasks.find(t=>t.id===source.task.id).start,source.task.start-15);assert.equal(await grip.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('ArrowDown');assert.equal((await readPlannerStore(page)).weeks[source.week].tasks.find(t=>t.id===source.task.id).start,source.task.start);
  const original=await readPlannerStore(page),bounds=await grip.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2+30);
  await page.evaluate(()=>{const value=JSON.parse(localStorage.getItem('weekwise-planner-v2'));value.weeks[Object.keys(value.weeks)[0]].notes='Changed in another tab';localStorage.setItem('weekwise-planner-v2',JSON.stringify(value));});await page.mouse.up();assert.match(await page.locator('#toast').innerText(),/Another tab|planner changed/i);assert.deepEqual(Object.values((await readPlannerStore(page)).weeks).flatMap(w=>w.tasks),Object.values(original.weeks).flatMap(w=>w.tasks));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({animations:'disabled',path:path.join(root,'test-results','calendar-zone-mobile-keyboard.png')});
 }finally{await context.close();}
});

test('a cached signed-in planner opens and keeps its owner offline without pretending to authenticate',async()=>{
 const rows=new Map(),{context,page}=await openPlanner({width:390,height:844},{serviceWorkers:'allow',rows});
 try{
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('Saved account responsibility');await page.locator('#saveTaskBtn').click();await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.unroute('**/supabase.min.js');await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#signinOfflineAccount').waitFor({state:'visible'});await page.locator('#signinOfflineAccount').click();await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);assert.equal(await countStoredTasksNamed(page,'Saved account responsibility'),1);assert.equal(await page.locator('#cloudMenuBadge').textContent(),'Offline');
  await page.locator('#workspaceCaptureInput').fill('New account edit while offline');await page.locator('#workspaceCaptureForm button[type=submit]').click();assert.equal(await countStoredTasksNamed(page,'New account edit while offline'),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('weekwise-cloud-sync-meta-v1')).userId),'weekwise-browser-test-user');
  const offline=await readPlannerStore(page);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);assert.equal(await countStoredTasksNamed(page,'New account edit while offline'),1);assert.equal(await page.locator('#cloudMenuBadge').textContent(),'Offline');assert.equal(Object.values(rows.get('weekwise-browser-test-user').data.store.weeks).flatMap(w=>w.tasks).some(t=>t.title==='New account edit while offline'),false);
  await context.setOffline(false);await context.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:supabaseStub}));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');assert.equal(await countStoredTasksNamed(page,'New account edit while offline'),1);assert.equal(await page.evaluate(()=>localStorage.getItem('weekwise-offline-owner-v1')),null);assert.equal(Object.values(rows.get('weekwise-browser-test-user').data.store.weeks).flatMap(w=>w.tasks).some(t=>t.title==='New account edit while offline'),true);
 }finally{await context.close();}
});

test('the task editor saves explicit overnight hours, shows both dates and retains them on a metadata edit',async()=>{
 const {context,page}=await openPlanner({width:390,height:844});
 try{
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('Overnight learning session');await page.locator('#modalListId').selectOption('personal');await page.locator('#modalNoSchedule').uncheck();await page.locator('#modalDay').selectOption('5');await page.locator('#modalTime').fill('23:30');await page.locator('#modalEndTime').fill('00:30');await page.locator('#modalEndNextDay').check();await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  const before=await readPlannerStore(page),source=Object.entries(before.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task}))).find(r=>r.task.title==='Overnight learning session');assert.equal(source.task.start,1410);assert.equal(source.task.duration,60);assert.equal(source.task.unscheduled,false);
  await page.locator('#weekViewBtn').click();assert.equal(await page.locator('article[data-range-id="'+source.task.id+'"]').count(),2,'one source record appears on both carried dates');assert.equal(await page.locator('#mobileDayPicker').isVisible(),false,'projected dates replace the legacy day strip');await page.locator('#daysGrid').evaluate(el=>el.scrollLeft=el.scrollWidth);const axis=await page.locator('.range-axis').boundingBox(),grid=await page.locator('#daysGrid').boundingBox();assert.ok(axis.x>=grid.x-1&&axis.x<grid.x+10,'time labels stay visible during horizontal scrolling');await page.locator('[data-range-edit][data-range-id="'+source.task.id+'"]').first().click();assert.equal(await page.locator('#modalEndNextDay').isChecked(),true);assert.equal(await page.locator('#modalEndTime').inputValue(),'00:30');await page.locator('#modalNote').fill('Keep the overnight slot');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  const retained=(await readPlannerStore(page)).weeks[source.week].tasks.find(t=>t.id===source.task.id);assert.equal(retained.start,1410);assert.equal(retained.duration,60);assert.equal(retained.note,'Keep the overnight slot');assert.deepEqual(retained.scheduleInstant,source.task.scheduleInstant);await page.screenshot({animations:'disabled',path:path.join(root,'test-results','overnight-calendar-mobile.png')});
 }finally{await context.close();}
});

test('dropping one projected activity onto another reviews and applies an atomic swap',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await createScheduledTask(page,'First swap activity');await createScheduledTask(page,'Second swap activity');const before=await readPlannerStore(page);before.settings.calendarTimeZone='UTC';before.settings.timeZone='UTC';await page.evaluate(value=>localStorage.setItem('weekwise-planner-v2',JSON.stringify(value)),before);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);await page.locator('#workspaceSidebar [data-workspace-view="calendar"]').click();await page.locator('#dayViewBtn').click();
  const source=Object.entries(before.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task}))),first=source.find(r=>r.task.title==='First swap activity'),second=source.find(r=>r.task.title==='Second swap activity'),grip=page.locator('[data-range-drag][data-range-id="'+first.task.id+'"]');await grip.scrollIntoViewIfNeeded();await page.locator('#daysGrid').evaluate((el,start)=>el.scrollTop=Math.max(0,start/60*56-el.clientHeight/2),first.task.start);const a=await grip.boundingBox(),b=await page.locator('article[data-range-id="'+second.task.id+'"]').boundingBox();let reviewed=false;page.once('dialog',d=>{reviewed=true;return d.accept();});await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});await page.mouse.up();
  assert.equal(reviewed,true,'dropping onto a task requires the swap review');const after=await readPlannerStore(page);assert.equal(after.weeks[first.week].tasks.find(t=>t.id===first.task.id).start,second.task.start);assert.equal(after.weeks[second.week].tasks.find(t=>t.id===second.task.id).start,first.task.start);assert.equal(after.weeks[first.week].tasks.find(t=>t.id===first.task.id).reschedulingHistory.at(-1).reason,'User-approved calendar swap');
 }finally{await context.close();}
});

test('planning previews use the saved zone when its date differs from the device date',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000},{now:Date.parse('2030-01-06T23:30:00Z')});
 try{
  await createFlexibleTask(page,'Keep source-clock planning','30');await page.waitForFunction(()=>document.querySelector('#cloudMenuBadge').textContent==='Synced');const before=await readPlannerStore(page);before.settings.timeZone='Asia/Tokyo';await page.evaluate(value=>localStorage.setItem('weekwise-planner-v2',JSON.stringify(value)),before);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);await page.locator('#workspaceSidebar [data-workspace-view="plan"]').click();await page.locator('#planWeek').fill('2030-01-06');for(const checkbox of await page.locator('[name="planDay"]').all())await checkbox.uncheck();await page.locator('[name="planDay"][value="1"]').check();await page.locator('#planStart').fill('07:00');await page.locator('#planEnd').fill('08:00');await page.locator('#planBuffer').fill('0');await page.locator('#planBreak').fill('0');await page.locator('#planPreferences button[type="submit"]').click();
  assert.match(await page.locator('#planCapacityNote').innerText(),/Planning clock: Asia\/Tokyo/);assert.equal(await page.locator('[name="planProposal"]').count(),0,'Monday 07:00–08:00 has passed at Tokyo Monday 08:30, even though the device is still on Sunday');assert.equal(await page.locator('#planApply').isDisabled(),true);assert.equal((await readPlannerStore(page)).weeks[Object.keys(before.weeks)[0]].tasks.filter(t=>t.title==='Keep source-clock planning')[0].start,null);
 }finally{await context.close();}
});

test('generated daily overnight occurrences keep their hours across future canonical weeks',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000});
 try{
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('Daily overnight template');await page.locator('#modalListId').selectOption('personal');await page.locator('#modalNoSchedule').uncheck();await page.locator('#modalDay').selectOption('5');await page.locator('#modalTime').fill('23:30');await page.locator('#modalEndTime').fill('00:30');await page.locator('#modalEndNextDay').check();await page.locator('#modalRecurrence').selectOption('daily');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  const records=Object.entries((await readPlannerStore(page)).weeks).flatMap(([week,value])=>value.tasks.filter(task=>task.title==='Daily overnight template').map(task=>({week,task})));assert.ok(records.length>20);for(const {task}of records){assert.equal(task.start,1410);assert.equal(task.duration,60);assert.equal(task.unscheduled,false);assert.equal(task.scheduleInstant.end-task.scheduleInstant.start,3600000);}
  const retained=records[0];await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);const reloaded=Object.values((await readPlannerStore(page)).weeks).flatMap(value=>value.tasks).find(task=>task.id===retained.task.id);assert.equal(reloaded.start,1410);assert.deepEqual(reloaded.scheduleInstant,retained.task.scheduleInstant);
 }finally{await context.close();}
});

test('a generated DST-gap occurrence needs review while the next valid day keeps its original rule time',async()=>{
 const {context,page}=await openPlanner({width:1440,height:1000},{now:Date.parse('2030-03-30T12:00:00Z'),timezoneId:'Europe/Berlin'});
 try{
  await page.locator('#globalCaptureBtn').click();await page.locator('#modalTitleInput').fill('DST reviewed recurrence');await page.locator('#modalListId').selectOption('personal');await page.locator('#modalNoSchedule').uncheck();await page.locator('#modalTime').fill('02:30');await page.locator('#modalEndTime').fill('03:00');await page.locator('#modalRecurrence').selectOption('daily');await page.locator('#saveTaskBtn').click();await page.locator('#taskModal').waitFor({state:'hidden'});
  const records=Object.values((await readPlannerStore(page)).weeks).flatMap(value=>value.tasks).filter(task=>task.title==='DST reviewed recurrence'),gap=records.find(task=>task.occurrenceDate==='2030-03-31'),next=records.find(task=>task.occurrenceDate==='2030-04-01');assert.ok(gap&&next);assert.equal(gap.start,null);assert.equal(gap.unscheduled,true);assert.match(gap.recurrenceScheduleReview.reason,/Nonexistent/);assert.equal(next.start,150);assert.equal(next.duration,30);assert.equal(new Date(next.scheduleInstant.start).toISOString(),'2030-04-01T00:30:00.000Z');
  const original=records.find(task=>task.occurrenceDate==='2030-03-30');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#signinLanding').hidden);const current=Object.values((await readPlannerStore(page)).weeks).flatMap(value=>value.tasks).find(task=>task.id===original.id);assert.deepEqual(current,original,'materialization never rewrites the retained original occurrence');
 }finally{await context.close();}
});
