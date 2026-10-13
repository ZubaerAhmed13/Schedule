#!/usr/bin/env node
/**
 * Dependency-free release sanity checks for the actual GitHub Pages source.
 * This is not a security audit or end-to-end browser test.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const pass = (message) => console.log("PASS " + message);
const fail = (message) => { failures.push(message); console.error("FAIL " + message); };

const applicationText = fs.readFileSync(path.join(root, "js/weekwise-app.js"), "utf8");
const indexPath = path.join(root, "index.html");
if (!fs.existsSync(indexPath)) {
  fail("index.html exists");
} else {
  const html = fs.readFileSync(indexPath, "utf8");
  if (/<title>\s*Weekwise/i.test(html)) pass("Weekwise document title exists");
  else fail("Weekwise document title exists");

  if (/<meta[^>]+name=["']viewport["'][^>]+content=/i.test(html)) pass("responsive viewport metadata exists");
  else fail("responsive viewport metadata exists");

  if (/SUPABASE_SERVICE_ROLE_KEY|service_role_key\s*[:=]\s*["'][^"']+["']/i.test(html)) {
    fail("no Supabase service-role secret embedded in public HTML");
  } else pass("no obvious service-role secret embedded in public HTML");

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  let checked = 0;
  for (const [index, match] of scripts.entries()) {
    const attrs = match[1] || "";
    const source = match[2] || "";
    if (/\bsrc\s*=/i.test(attrs) || !source.trim()) continue;
    try {
      new vm.Script(source, { filename: `index.html:inline-script-${index + 1}` });
      checked += 1;
    } catch (error) {
      fail(`inline script ${index + 1} parses: ${error.message}`);
    }
  }
  if (checked > 0 && failures.length === 0) pass(`${checked} inline JavaScript block(s) parse`);
  else if (checked === 0) fail("at least one inline JavaScript block can be checked");

  for (const attr of ["href", "src"]) {
    const regex = new RegExp(`\\b${attr}=["']([^"']+)["']`, "gi");
    for (const match of html.matchAll(regex)) {
      const ref = match[1].trim();
      if (!ref || ref.startsWith("#") || /^(?:[a-z]+:|\/\/|data:|mailto:|tel:)/i.test(ref)) continue;
      const clean = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
      if (!clean) continue;
      const resolved = path.resolve(root, clean);
      if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        fail(`local ${attr} reference stays inside repository: ${ref}`);
      } else if (!fs.existsSync(resolved)) {
        fail(`local ${attr} reference exists: ${ref}`);
      }
    }
  }
}

// Parse all independent local scripts, including the additive data/planning modules.
for (const filename of ["js/weekwise-account-privacy.js", "js/weekwise-account-ui.js", "js/weekwise-task-schedule.js", "js/weekwise-calendar-range.js", "js/weekwise-calendar-range-ui.js", "js/weekwise-data.js", "js/weekwise-timezones.js", "js/weekwise-recurring-bulk.js", "js/weekwise-onboarding.js", "js/weekwise-insights.js", "js/weekwise-update-safety.js", "js/weekwise-calendar-layout.js", "js/weekwise-planning.js", "js/weekwise-plan-ui.js", "js/weekwise-app.js", "js/weekwise-focus.js", "js/weekwise-cloud-transport.js", "js/weekwise-experience.js", "js/weekwise-accessibility.js", "js/weekwise-habits.js", "js/weekwise-pwa.js", "js/weekwise-drafts.js", "js/weekwise-list-window.js"]) {
  try { new vm.Script(fs.readFileSync(path.join(root, filename), "utf8"), { filename }); pass(filename + " parses"); }
  catch (error) { fail(filename + " parses: " + error.message); }
}

for (const filename of ["manifest.webmanifest"]) {
  const full = path.join(root, filename);
  try {
    const data = JSON.parse(fs.readFileSync(full, "utf8"));
    if (data.name && data.start_url && data.display) pass(`${filename} is valid JSON with install metadata`);
    else fail(`${filename} has required install metadata`);
  } catch (error) {
    fail(`${filename} parses as JSON: ${error.message}`);
  }
}

const sw = path.join(root, "sw.js");
if (fs.existsSync(sw)) {
  const swText = fs.readFileSync(sw, "utf8");
  if (/addEventListener\s*\(\s*["']fetch["']/.test(swText)) pass("service worker has a fetch handler");
  else fail("service worker has a fetch handler");
} else {
  fail("sw.js exists");
}


// Focused regression checks for the cloud-save race and invite-trigger hardening.
const appSource = fs.readFileSync(indexPath, "utf8") + "\n" + applicationText;
if (/let savedPayload=null;[\s\S]*?finally\{\s*cloudBusy=false;[\s\S]*?if\(savedPayload&&cloudUser&&cloudReady&&!cloudConflict&&cloudFingerprint\(buildCloudPayload\(\)\)!==cloudFingerprint\(savedPayload\)\)queueCloudSave\(\);/.test(appSource)) {
  pass("cloud save re-queues edits made while a request is in flight");
} else {
  fail("cloud save re-queues edits made while a request is in flight");
}

if (appSource.includes("function taskModalFingerprint()") &&
    appSource.includes("This activity is no longer available") &&
    appSource.includes("Discard your unsaved changes") &&
    appSource.includes("closeTaskModal(true)") &&
    appSource.includes("$('closeModal').addEventListener('click',()=>closeTaskModal())")) {
  pass("activity editor guards stale records and protects unsaved changes");
} else {
  fail("activity editor guards stale records and protects unsaved changes");
}

const inviteSqlPath = path.join(root, "supabase_invite_code_setup.sql");
if (fs.existsSync(inviteSqlPath)) {
  const inviteSql = fs.readFileSync(inviteSqlPath, "utf8");
  if (/set search_path = pg_catalog, extensions, private/i.test(inviteSql) &&
      /extensions\.digest\(submitted_code,\s*'sha256'\)/i.test(inviteSql)) {
    pass("invite trigger uses a restricted search path and schema-qualified digest");
  } else fail("invite trigger uses a restricted search path and schema-qualified digest");
  if (/on conflict \(code_hash\) do nothing;/i.test(inviteSql)) {
    pass("rerunning invite setup does not reactivate a revoked invite");
  } else fail("rerunning invite setup does not reactivate a revoked invite");
} else fail("invite-code SQL exists for validation");


// Integration-readiness artifacts must exist and remain explicitly non-destructive.
const diagnosticPath = path.join(root, "supabase_verify_setup.sql");
if (fs.existsSync(diagnosticPath)) {
  const diagnostic = fs.readFileSync(diagnosticPath, "utf8");
  if (/read-only integration diagnostics/i.test(diagnostic) &&
      /public\.weekwise_cloud_data/i.test(diagnostic) &&
      /public\.weekwise_save/i.test(diagnostic) &&
      /weekwise_require_referral_code/i.test(diagnostic) &&
      /select check_name, status, details/i.test(diagnostic) &&
      ! /^\s*(?:insert\s+into|update\s+\w|delete\s+from|drop\s+|create\s+|alter\s+)/im.test(diagnostic.replace(/^\s*--.*$/gm, ""))) {
    pass("Supabase diagnostics cover schema, RPC, RLS and invite setup without writes");
  } else fail("Supabase diagnostics cover schema, RPC, RLS and invite setup without writes");
} else fail("read-only Supabase diagnostic SQL exists");

const integrationGuidePath = path.join(root, "docs", "INTEGRATION_READINESS.md");
if (fs.existsSync(integrationGuidePath)) {
  const integrationGuide = fs.readFileSync(integrationGuidePath, "utf8");
  if (/Calendar OAuth: code ready, provider setup required/i.test(integrationGuide) &&
      /Background push: code ready, external activation required/i.test(integrationGuide) &&
      /Data safety/i.test(integrationGuide) &&
      /not live until/i.test(integrationGuide)) {
    pass("integration guide distinguishes implemented features from external setup requirements");
  } else fail("integration guide distinguishes implemented features from external setup requirements");
} else fail("integration readiness guide exists");


// The Pages deployment must identify its build and verify the live site serves that exact revision.
const deploymentWorkflowPath = path.join(root, ".github", "workflows", "deploy-pages.yml");
if (fs.existsSync(deploymentWorkflowPath)) {
  const deploymentWorkflow = fs.readFileSync(deploymentWorkflowPath, "utf8");
  if (/Embed deployment identity/.test(deploymentWorkflow) &&
      /build-info\.json/.test(deploymentWorkflow) &&
      /EXPECTED_COMMIT/.test(deploymentWorkflow) &&
      /EXPECTED_RUN_ID/.test(deploymentWorkflow) &&
      /published_commit/.test(deploymentWorkflow) &&
      /published_run_id/.test(deploymentWorkflow) &&
      /Smoke-test the published Weekwise app/.test(deploymentWorkflow)) {
    pass("Pages deployment publishes a build marker and checks the live commit/run identity");
  } else fail("Pages deployment publishes a build marker and checks the live commit/run identity");

  const lines = deploymentWorkflow.split("\n");
  const shellBlocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^ {8}run:\s*\|\s*$/.test(lines[i])) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "") {
        body.push("");
        continue;
      }
      if (!/^ {10}/.test(lines[j])) break;
      body.push(lines[j].slice(10));
    }
    shellBlocks.push(body.join("\n"));
  }
  if (shellBlocks.length >= 2) {
    for (const [index, shell] of shellBlocks.entries()) {
      const result = spawnSync("bash", ["-n"], { input: shell, encoding: "utf8" });
      if (result.status === 0) pass(`Pages deploy shell block ${index + 1} parses`);
      else fail(`Pages deploy shell block ${index + 1} parses: ${result.stderr.trim()}`);
    }
  } else fail("Pages deploy workflow contains both shell blocks");
} else fail("Pages deployment workflow exists for validation");


// Keep the opt-in/live-triggered Supabase diagnostic read-only and syntax-valid.
const liveDiagnosticsPath = path.join(root, ".github", "workflows", "supabase-live-diagnostics.yml");
if (fs.existsSync(liveDiagnosticsPath)) {
  const liveWorkflow = fs.readFileSync(liveDiagnosticsPath, "utf8");
  if (/workflow_dispatch/.test(liveWorkflow) &&
      /\/auth\/v1/.test(liveWorkflow) &&
      /auth_base\/health/.test(liveWorkflow) &&
      /auth_base\/settings/.test(liveWorkflow) &&
      /Google OAuth sign-in/.test(liveWorkflow) &&
      /Microsoft\/Azure OAuth sign-in/.test(liveWorkflow) &&
      /not an end-to-end OAuth test/.test(liveWorkflow) &&
      /GITHUB_STEP_SUMMARY/.test(liveWorkflow) &&
      !/SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(liveWorkflow)) {
    pass("live Supabase workflow checks public Auth health/provider flags without service-role credentials");
  } else fail("live Supabase workflow checks public Auth health/provider flags without service-role credentials");

  const lines = liveWorkflow.split("\n");
  const shellBlocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^ {8}run:\s*\|\s*$/.test(lines[i])) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "") {
        body.push("");
        continue;
      }
      if (!/^ {10}/.test(lines[j])) break;
      body.push(lines[j].slice(10));
    }
    shellBlocks.push(body.join("\n"));
  }
  if (shellBlocks.length === 3) {
    for (const [index, shell] of shellBlocks.entries()) {
      const result = spawnSync("bash", ["-n"], { input: shell, encoding: "utf8" });
      if (result.status === 0) pass(`Supabase diagnostics shell block ${index + 1} parses`);
      else fail(`Supabase diagnostics shell block ${index + 1} parses: ${result.stderr.trim()}`);
    }
  } else fail("Supabase diagnostic workflow contains all three shell blocks");
} else fail("live Supabase diagnostic workflow exists");


// Background push must be explicit, service-only in the database, and safely registered in the PWA.
const pushEdgePath = path.join(root, "supabase", "functions", "weekwise-push", "index.ts");
const pushSqlPath = path.join(root, "supabase_push_setup.sql");
const pushCronPath = path.join(root, "supabase_push_cron_setup.sql");
const pushClientPath = path.join(root, "weekwise-push.js");
if (fs.existsSync(pushEdgePath) && fs.existsSync(pushSqlPath) && fs.existsSync(pushCronPath) && fs.existsSync(pushClientPath)) {
  const pushEdge = fs.readFileSync(pushEdgePath, "utf8");
  const pushSql = fs.readFileSync(pushSqlPath, "utf8");
  const pushCron = fs.readFileSync(pushCronPath, "utf8");
  const pushClient = fs.readFileSync(pushClientPath, "utf8");
  if (/auth\.getUser\(\)/.test(pushEdge) &&
      /x-weekwise-cron-secret/.test(pushEdge) &&
      /constantTimeEqual\(receivedSecret, expectedSecret\)/.test(pushEdge) &&
      /weekwise_claim_push_delivery/.test(pushEdge) &&
      /fromZonedTime\(text, timeZone\)/.test(pushEdge) &&
      /isTrustedPushEndpoint\(endpoint\)/.test(pushEdge)) {
    pass("background push verifies user sessions, cron secret, time zones and push endpoint hosts");
  } else fail("background push verifies user sessions, cron secret, time zones and push endpoint hosts");

  if (/alter table public\.weekwise_push_subscriptions enable row level security/i.test(pushSql) &&
      /revoke all on table public\.weekwise_push_subscriptions from public, anon, authenticated/i.test(pushSql) &&
      /revoke all on table public\.weekwise_push_delivery_log from public, anon, authenticated/i.test(pushSql) &&
      /security definer[\s\S]{0,100}set search_path = pg_catalog, auth/i.test(pushSql) &&
      /auth\.role\(\)[\s\S]*?service_role/i.test(pushSql)) {
    pass("push subscription and delivery records are server-role only");
  } else fail("push subscription and delivery records are server-role only");

  if (/vault\.decrypted_secrets/.test(pushCron) &&
      /weekwise_push_cron_secret/.test(pushCron) &&
      /weekwise-push-dispatch/.test(pushCron) &&
      !/x-weekwise-cron-secret['"]\s*,\s*['"][0-9a-f]{32,}/i.test(pushCron)) {
    pass("background-push schedule keeps its shared secret in Vault");
  } else fail("background-push schedule keeps its shared secret in Vault");

  if (/functions\.invoke\("weekwise-push"/.test(pushClient) &&
      /pushManager\.subscribe\(/.test(pushClient) &&
      /Notification\.requestPermission\(\)/.test(pushClient) &&
      !/SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|WEEKWISE_PUSH_CRON_SECRET/i.test(pushClient)) {
    pass("browser push client uses the Edge Function without embedded server secrets");
  } else fail("browser push client uses the Edge Function without embedded server secrets");

  try {
    new vm.Script(pushClient, { filename: "weekwise-push.js" });
    pass("weekwise-push.js parses");
  } catch (error) {
    fail(`weekwise-push.js parses: ${error.message}`);
  }
} else fail("background push server, SQL, scheduler and client files exist");

if (/addEventListener\(['"]push['"]/.test(fs.readFileSync(sw, "utf8")) &&
    /addEventListener\(['"]notificationclick['"]/.test(fs.readFileSync(sw, "utf8")) &&
    /weekwise-push\.js/.test(fs.readFileSync(sw, "utf8")) &&
    /weekwise-calendar\.js/.test(fs.readFileSync(sw, "utf8"))) {
  pass("service worker handles Web Push and caches both integration clients");
} else fail("service worker handles Web Push and caches both integration clients");


// Calendar OAuth must keep provider secrets server-side and use revision-conflict protection.
const calendarEdgePath = path.join(root, "supabase", "functions", "weekwise-calendar", "index.ts");
const calendarSqlPath = path.join(root, "supabase_calendar_setup.sql");
const calendarClientPath = path.join(root, "weekwise-calendar.js");
if (fs.existsSync(calendarEdgePath) && fs.existsSync(calendarSqlPath) && fs.existsSync(calendarClientPath)) {
  const calendarEdge = fs.readFileSync(calendarEdgePath, "utf8");
  const calendarSql = fs.readFileSync(calendarSqlPath, "utf8");
  const calendarClient = fs.readFileSync(calendarClientPath, "utf8");
  if (/code_challenge_method", "S256"/.test(calendarEdge) &&
      /weekwise_consume_calendar_oauth_state/.test(calendarEdge) &&
      /AES-GCM/.test(calendarEdge) &&
      /WEEKWISE_CALENDAR_ENCRYPTION_KEY/.test(calendarEdge) &&
      /auth\.getUser\(\)/.test(calendarEdge) &&
      /weekwise_calendar_save_cloud/.test(calendarEdge) &&
      /localChanged && remoteChanged/.test(calendarEdge)) {
    pass("calendar OAuth uses PKCE, encrypted tokens, validated sessions and revision-aware sync");
  } else fail("calendar OAuth uses PKCE, encrypted tokens, validated sessions and revision-aware sync");

  if (/alter table public\.weekwise_calendar_connections enable row level security/i.test(calendarSql) &&
      /revoke all on table public\.weekwise_calendar_connections from public, anon, authenticated/i.test(calendarSql) &&
      /revoke all on function public\.weekwise_consume_calendar_oauth_state\(text\) from public, anon, authenticated/i.test(calendarSql) &&
      /revoke all on function public\.weekwise_calendar_save_cloud\(uuid, jsonb, bigint\) from public, anon, authenticated/i.test(calendarSql) &&
      /origin text not null default 'weekwise'/.test(calendarSql)) {
    pass("calendar tokens, OAuth transactions and event links are server-only");
  } else fail("calendar tokens, OAuth transactions and event links are server-only");

  if (/functions\.invoke\("weekwise-calendar"/.test(calendarClient) &&
      /new URL\(response\.authorizationUrl\)/.test(calendarClient) &&
      /url\.protocol !== "https:"/.test(calendarClient) &&
      !/GOOGLE_CALENDAR_CLIENT_SECRET|MICROSOFT_CALENDAR_CLIENT_SECRET|WEEKWISE_CALENDAR_ENCRYPTION_KEY/i.test(calendarClient)) {
    pass("calendar browser UI uses the Edge Function and embeds no provider secrets");
  } else fail("calendar browser UI uses the Edge Function and embeds no provider secrets");

  try {
    new vm.Script(calendarClient, { filename: "weekwise-calendar.js" });
    pass("weekwise-calendar.js parses");
  } catch (error) {
    fail("weekwise-calendar.js parses: " + error.message);
  }

  const edgeWorkflowPath = path.join(root, ".github", "workflows", "check-edge-functions.yml");
  if (fs.existsSync(edgeWorkflowPath)) {
    const edgeWorkflow = fs.readFileSync(edgeWorkflowPath, "utf8");
    if (/deno check --no-lock supabase\/functions\/weekwise-push\/index\.ts/.test(edgeWorkflow) &&
        /deno check --no-lock supabase\/functions\/weekwise-calendar\/index\.ts/.test(edgeWorkflow)) {
      pass("Deno type-check workflow covers both Supabase Edge Functions");
    } else fail("Deno type-check workflow covers both Supabase Edge Functions");
  } else fail("Supabase Edge Function type-check workflow exists");
} else fail("calendar OAuth server, SQL and client files exist");


if (failures.length) {
  console.error(`\\n${failures.length} release sanity check(s) failed.`);
  process.exit(1);
}
console.log("\\nAll release sanity checks passed. This does not replace browser, backend, or deployment tests.");
