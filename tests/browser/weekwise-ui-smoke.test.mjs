import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let browser;
let origin;

const supabaseStub = String.raw`
(() => {
  const user = { id: "weekwise-browser-test-user", email: "browser-test@example.invalid" };
  const session = { access_token: "browser-test-access-token", refresh_token: "browser-test-refresh-token", user };
  let cloudRow = null;
  let revision = 0;
  let authListener = null;

  const client = {
    auth: {
      onAuthStateChange(callback) {
        authListener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() { return { data: { session }, error: null }; },
      async getUser() { return { data: { user }, error: null }; },
      async signOut() {
        if (authListener) authListener("SIGNED_OUT", null);
        return { error: null };
      },
      async signInWithPassword() { return { data: { session, user }, error: null }; },
      async signUp() { return { data: { session, user }, error: null }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; }
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() { return { data: cloudRow, error: null }; }
              };
            }
          };
        }
      };
    },
    async rpc(name, args) {
      if (name !== "weekwise_save") return { data: null, error: { message: "Unexpected test RPC: " + name } };
      revision += 1;
      cloudRow = {
        user_id: user.id,
        data: args.p_data,
        revision,
        updated_at: new Date().toISOString()
      };
      return {
        data: [{ saved: true, revision, data: args.p_data, updated_at: cloudRow.updated_at }],
        error: null
      };
    }
  };
  window.supabase = { createClient() { return client; } };
})();
`;

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url || "/", origin || "http://127.0.0.1").pathname);
  let target = path.resolve(root, "." + pathname);
  if (target !== root && !target.startsWith(root + path.sep)) {
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

async function openPlanner(viewport) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: "block",
    isMobile: viewport.width <= 430,
    hasTouch: viewport.width <= 430
  });
  await context.route("**/supabase.min.js", route => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: supabaseStub
  }));
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
  await page.locator("#saveTaskBtn").click();
  await page.locator("#taskModal").waitFor({ state: "hidden" });
  await page.waitForFunction(
    taskTitle => document.querySelector("#daysGrid")?.innerText.includes(taskTitle),
    title,
    { timeout: 10000 }
  );
}

async function countStoredTasksNamed(page, title) {
  return page.evaluate((target) => {
    const count = value => {
      if (!value || typeof value !== "object") return 0;
      let total = value.title === target ? 1 : 0;
      for (const child of Object.values(value)) total += count(child);
      return total;
    };
    return Object.entries(localStorage).reduce((sum, [key, raw]) => {
      try { return sum + count(JSON.parse(raw)); } catch (_) { return sum; }
    }, 0);
  }, title);
}

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
   assert.match(await page.locator('#planUnscheduled').innerText(),/Duration unknown/);
   assert.equal(await page.locator('#planApply').isDisabled(),true);
   assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1),true,'Plan fits viewport '+viewport.width);
   await page.screenshot({path:path.join(root,'test-results',`plan-${viewport.width}.png`),fullPage:true});
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
