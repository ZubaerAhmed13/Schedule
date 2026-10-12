import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const edge = read("../supabase/functions/weekwise-calendar/index.ts");
const sql = read("../supabase_calendar_setup.sql");
const client = read("../weekwise-calendar.js");
const html = read("../index.html") + "\n" + read("../js/weekwise-app.js");
const worker = read("../sw.js");
const config = read("../supabase/config.toml");

test("calendar OAuth uses PKCE, one-use state and server-side encrypted tokens", () => {
  assert.match(edge, /code_challenge_method", "S256"/);
  assert.match(edge, /weekwise_calendar_oauth_states/);
  assert.match(edge, /weekwise_consume_calendar_oauth_state/);
  assert.match(sql, /expires_at > now\(\)/);
  assert.match(edge, /AES-GCM/);
  assert.match(edge, /WEEKWISE_CALENDAR_ENCRYPTION_KEY/);
  assert.match(edge, /encrypted_refresh_token/);
  assert.match(edge, /client_secret: requiredEnv|clientSecret: requiredEnv/);
  assert.doesNotMatch(client, /GOOGLE_CALENDAR_CLIENT_SECRET|MICROSOFT_CALENDAR_CLIENT_SECRET|WEEKWISE_CALENDAR_ENCRYPTION_KEY|encrypted_refresh_token/i);
});

test("calendar secrets and cloud changes are protected by server-only database permissions", () => {
  for (const table of [
    "weekwise_calendar_oauth_states",
    "weekwise_calendar_connections",
    "weekwise_calendar_event_links"
  ]) {
    assert.match(sql, new RegExp("alter table public\." + table + " enable row level security", "i"));
    assert.match(sql, new RegExp("revoke all on table public\." + table + " from public, anon, authenticated", "i"));
    assert.match(sql, new RegExp("grant all on table public\." + table + " to service_role", "i"));
  }
  assert.match(sql, /revoke all on function public\.weekwise_consume_calendar_oauth_state\(text\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.weekwise_calendar_save_cloud\(uuid, jsonb, bigint\) from public, anon, authenticated/i);
  assert.match(sql, /current_row\.revision <> coalesce\(p_expected_revision, -1\)/);
  assert.match(sql, /current_row\.data is not distinct from p_data/);
});

test("calendar handlers cover both providers, time zones, mappings, and conflict-safe sync", () => {
  assert.match(edge, /accounts\.google\.com\/o\/oauth2/);
  assert.match(edge, /login\.microsoftonline\.com/);
  assert.match(edge, /googleapis\.com\/calendar\/v3\/calendars\/primary\/events/);
  assert.match(edge, /graph\.microsoft\.com\/v1\.0\/me\/calendarView/);
  assert.match(edge, /fromZonedTime/);
  assert.match(edge, /weekwise_calendar_event_links/);
  assert.match(edge, /localChanged && remoteChanged/);
  assert.match(edge, /revision_conflict/);
  assert.match(edge, /extendedProperties/);
  assert.match(edge, /weekwise_calendar_save_cloud/);
  assert.match(edge, /primary calendar/i);
});

test("calendar UI is exposed through the app bridge and never stores provider secrets", () => {
  assert.match(html, /id="calendarConnectionsPanel"/);
  assert.match(html, /id="connectGoogleCalendarBtn"/);
  assert.match(html, /id="connectMicrosoftCalendarBtn"/);
  assert.match(html, /id="syncGoogleCalendarBtn"/);
  assert.match(html, /id="syncMicrosoftCalendarBtn"/);
  assert.match(html, /window\.weekwiseCalendarBridge/);
  assert.match(client, /functions\.invoke\("weekwise-calendar"/);
  assert.match(client, /window\.weekwiseCalendarBridge\?\.openPanel\?\./);
  assert.match(client, /new URL\(response\.authorizationUrl\)/);
  assert.match(client, /url\.protocol !== "https:"/);
  assert.match(client, /prepareSync\(\)/);
  assert.match(client, /reloadAfterSync\(\)/);
});

test("the service worker caches calendar controls and callback JWT verification is handled in code", () => {
  assert.match(worker, /weekwise-static-v77/);
  assert.match(worker, /weekwise-calendar\.js/);
  assert.match(config, /\[functions\.weekwise-calendar\]\s+verify_jwt = false/);
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /GET" && \(url\.searchParams\.has\("code"\)/);
});
