import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const edge = read("../supabase/functions/weekwise-push/index.ts");
const sql = read("../supabase_push_setup.sql");
const cron = read("../supabase_push_cron_setup.sql");
const worker = read("../sw.js");
const html = read("../index.html");
const clientScript = read("../weekwise-push.js");

test("background push records cannot be queried or mutated by browser roles", () => {
  for (const table of ["weekwise_push_subscriptions", "weekwise_push_delivery_log"]) {
    assert.match(sql, new RegExp("alter table public\\." + table + " enable row level security", "i"));
    assert.match(sql, new RegExp("revoke all on table public\\." + table + " from public, anon, authenticated", "i"));
    assert.match(sql, new RegExp("grant all on table public\\." + table + " to service_role", "i"));
  }
  assert.match(sql, /auth\.role\(\)[\s\S]{0,100}service_role/i);
  assert.match(sql, /security definer[\s\S]{0,100}set search_path = pg_catalog, auth/i);
  assert.match(sql, /status <> 'sent'[\s\S]{0,160}attempted_at < now\(\) - interval '5 minutes'/i);
  assert.match(sql, /revoke all on function public\.weekwise_claim_push_delivery\(uuid, text, text\) from public, anon, authenticated/i);
});

test("push dispatcher is authenticated, secret-gated and timezone-aware", () => {
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /x-weekwise-cron-secret/);
  assert.match(edge, /constantTimeEqual\(receivedSecret, expectedSecret\)/);
  assert.match(edge, /fromZonedTime\(text, timeZone\)/);
  assert.match(edge, /MAX_REMINDER_AGE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(edge, /weekwise_claim_push_delivery/);
  assert.match(edge, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(edge, /isTrustedPushEndpoint\(endpoint\)/);
  assert.match(edge, /host === "fcm\.googleapis\.com"/);
  assert.doesNotMatch(edge, /service_role_key\s*[:=]\s*["'][^"']+["']/i);
});

test("client-side push controls use authenticated function calls and no server secrets", () => {
  assert.match(html, /id="toggleBackgroundPushBtn"/);
  assert.match(html, /id="backgroundPushStatus"/);
  assert.match(html, /src="\.\/weekwise-push\.js"/);
  assert.match(html, /window\.weekwiseCloudClient=cloudClient/);
  assert.match(clientScript, /functions\.invoke\("weekwise-push"/);
  assert.match(clientScript, /Notification\.requestPermission\(\)/);
  assert.match(clientScript, /pushManager\.subscribe\(/);
  assert.match(clientScript, /pushManager\.getSubscription\(/);
  assert.match(clientScript, /navigator\.serviceWorker\.ready\.then\(\(\) => refreshState\(\)\)/);
  assert.match(clientScript, /invoke\("status", \{ endpoint: subscription\?\.endpoint \|\| "" \}\)/);
  assert.match(clientScript, /unsubscribe/);
  assert.doesNotMatch(clientScript, /SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|WEEKWISE_PUSH_CRON_SECRET/i);
});

test("service worker displays pushed reminders and safely opens only Weekwise URLs", () => {
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /showNotification\(title, options\)/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /candidate\.origin === scope\.origin/);
  assert.match(worker, /candidate\.pathname\.startsWith\(scope\.pathname\)/);
  assert.match(worker, /weekwise-static-v76/);
  assert.match(worker, /weekwise-push\.js/);
});

test("scheduler reads its secret from Vault and calls the trusted dispatcher", () => {
  assert.match(cron, /weekwise_project_url/);
  assert.match(cron, /weekwise_push_cron_secret/);
  assert.match(cron, /vault\.decrypted_secrets/);
  assert.match(cron, /weekwise-push-dispatch/);
  assert.match(cron, /\* \* \* \* \*/);
  assert.doesNotMatch(cron, /x-weekwise-cron-secret['"]\s*,\s*['"][0-9a-f]{32,}/i);
});
