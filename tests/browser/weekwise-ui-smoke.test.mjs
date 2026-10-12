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
