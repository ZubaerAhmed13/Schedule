import { createClient } from "npm:@supabase/supabase-js@2";
import { fromZonedTime } from "npm:date-fns-tz@3.2.0";

type Json = Record<string, unknown>;
type Provider = "google" | "microsoft";
type OAuthState = { user_id: string; provider: Provider; code_verifier: string };
type CalendarConnection = {
  user_id: string;
  provider: Provider;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  access_token_expires_at: string;
  granted_scope: string;
  provider_account_email: string | null;
  provider_calendar_timezone: string | null;
};
type CalendarLink = {
  user_id: string;
  provider: Provider;
  task_id: string;
  provider_event_id: string;
  weekwise_fingerprint: string;
  provider_updated_at: string | null;
  provider_event_start_at: string | null;
  origin: "weekwise" | "provider";
  synced_at: string;
};
type WeekwiseTask = Record<string, unknown> & { id: string; title: string };
type TaskRecord = { task: WeekwiseTask; weekKey: string; dateKey: string };
type NormalEvent = {
  id: string;
  taskId: string | null;
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  startAt: Date | null;
  endAt: Date | null;
  updatedAt: string | null;
  cancelled: boolean;
};

const APP_URL = "https://zubaerahmed13.github.io/Schedule/";
const ALLOWED_ORIGIN = Deno.env.get("WEEKWISE_ALLOWED_ORIGIN") ?? "https://zubaerahmed13.github.io";
const PAGE_SIZE = 250;
const GRAPH_EXT_ID = "String {3f3cbb11-2c2f-4cd8-82d7-7c04e47ef031} Name WeekwiseTaskId";
const COMMON_WINDOWS_TIMEZONES: Record<string, string> = {
  UTC: "UTC",
  "Europe/Berlin": "W. Europe Standard Time",
  "Europe/Paris": "Romance Standard Time",
  "Europe/Amsterdam": "W. Europe Standard Time",
  "Europe/Brussels": "Romance Standard Time",
  "Europe/Vienna": "W. Europe Standard Time",
  "Europe/Zurich": "W. Europe Standard Time",
  "Europe/Rome": "W. Europe Standard Time",
  "Europe/Madrid": "Romance Standard Time",
  "Europe/Prague": "Central Europe Standard Time",
  "Europe/Warsaw": "Central European Standard Time",
  "Europe/London": "GMT Standard Time",
  "Europe/Dublin": "GMT Standard Time",
  "America/New_York": "Eastern Standard Time",
  "America/Detroit": "Eastern Standard Time",
  "America/Toronto": "Eastern Standard Time",
  "America/Chicago": "Central Standard Time",
  "America/Winnipeg": "Central Standard Time",
  "America/Denver": "Mountain Standard Time",
  "America/Edmonton": "Mountain Standard Time",
  "America/Los_Angeles": "Pacific Standard Time",
  "America/Vancouver": "Pacific Standard Time",
  "America/Phoenix": "US Mountain Standard Time",
  "America/Anchorage": "Alaskan Standard Time",
  "Pacific/Honolulu": "Hawaiian Standard Time",
  "Asia/Dhaka": "Bangladesh Standard Time",
  "Asia/Kolkata": "India Standard Time",
  "Asia/Karachi": "Pakistan Standard Time",
  "Asia/Dubai": "Arabian Standard Time",
  "Asia/Singapore": "Singapore Standard Time",
  "Asia/Tokyo": "Tokyo Standard Time",
  "Asia/Seoul": "Korea Standard Time",
  "Asia/Bangkok": "SE Asia Standard Time",
  "Australia/Sydney": "AUS Eastern Standard Time",
  "Australia/Melbourne": "AUS Eastern Standard Time",
  "Australia/Perth": "W. Australia Standard Time",
  "Pacific/Auckland": "New Zealand Standard Time",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Server configuration is missing " + name + ".");
  return value;
}

function adminClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicUrl(path: string): string {
  return requiredEnv("SUPABASE_URL").replace(/\/+$/, "") + path;
}

function providerValid(value: unknown): value is Provider {
  return value === "google" || value === "microsoft";
}

function encryptionConfigured(): boolean {
  try {
    return fromBase64Url(Deno.env.get("WEEKWISE_CALENDAR_ENCRYPTION_KEY") ?? "").length === 32;
  } catch {
    return false;
  }
}

function providerConfigured(provider: Provider): boolean {
  if (provider === "google") {
    return Boolean(Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") && Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET"));
  }
  return Boolean(Deno.env.get("MICROSOFT_CALENDAR_CLIENT_ID") && Deno.env.get("MICROSOFT_CALENDAR_CLIENT_SECRET"));
}

function credentials(provider: Provider) {
  if (provider === "google") {
    return {
      clientId: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
      clientSecret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
      authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email"],
    };
  }
  return {
    clientId: requiredEnv("MICROSOFT_CALENDAR_CLIENT_ID"),
    clientSecret: requiredEnv("MICROSOFT_CALENDAR_CLIENT_SECRET"),
    authEndpoint: "https://login.microsoftonline.com/" +
      encodeURIComponent(Deno.env.get("MICROSOFT_CALENDAR_TENANT")?.trim() || "common") +
      "/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/" +
      encodeURIComponent(Deno.env.get("MICROSOFT_CALENDAR_TENANT")?.trim() || "common") +
      "/oauth2/v2.0/token",
    scopes: ["offline_access", "User.Read", "Calendars.ReadWrite"],
  };
}

function callbackUri(): string {
  return publicUrl("/functions/v1/weekwise-calendar");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function hashBase64Url(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function safeTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length > 100) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function graphTimeZone(iana: string): string {
  return COMMON_WINDOWS_TIMEZONES[iana] || "UTC";
}

function encryptionKeyBytes(): Uint8Array {
  const raw = requiredEnv("WEEKWISE_CALENDAR_ENCRYPTION_KEY");
  const bytes = fromBase64Url(raw);
  if (bytes.length !== 32) throw new Error("WEEKWISE_CALENDAR_ENCRYPTION_KEY must be a base64url-encoded 32-byte key.");
  return bytes;
}

async function aesKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(encryptionKeyBytes()), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptText(value: string): Promise<string> {
  const iv = randomBytes(12);
  const key = await aesKey();
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(value)),
  ));
  return base64Url(iv) + "." + base64Url(ciphertext);
}

async function decryptText(value: string): Promise<string> {
  const pieces = value.split(".");
  if (pieces.length !== 2) throw new Error("Stored calendar credential has an invalid format.");
  const key = await aesKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64Url(pieces[0])) },
    key,
    toArrayBuffer(fromBase64Url(pieces[1])),
  );
  return new TextDecoder().decode(plaintext);
}

async function getUser(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return null;
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("Server configuration is missing SUPABASE_ANON_KEY.");
  const client = createClient(requiredEnv("SUPABASE_URL"), key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function appRedirect(status: string, provider?: string, reason?: string): Response {
  const url = new URL(APP_URL);
  url.searchParams.set("calendar_oauth_status", status);
  if (provider) url.searchParams.set("calendar_provider", provider);
  if (reason) url.searchParams.set("calendar_reason", reason);
  return Response.redirect(url.toString(), 302);
}

async function startOAuth(admin: ReturnType<typeof adminClient>, userId: string, provider: Provider) {
  if (!encryptionConfigured()) {
    return jsonResponse({ error: "Calendar token encryption is not configured in Supabase yet.", code: "encryption_not_configured" }, 503);
  }
  if (!providerConfigured(provider)) {
    return jsonResponse({
      error: provider === "google"
        ? "Google Calendar OAuth is not configured in Supabase yet."
        : "Microsoft Outlook OAuth is not configured in Supabase yet.",
      code: "provider_not_configured",
    }, 503);
  }

  const config = credentials(provider);
  const state = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(64));
  const challenge = await hashBase64Url(verifier);
  const stateHash = await sha256Hex(state);
  await admin.from("weekwise_calendar_oauth_states").delete().lt("expires_at", new Date().toISOString());

  const { error } = await admin.from("weekwise_calendar_oauth_states").insert({
    state_hash: stateHash,
    user_id: userId,
    provider,
    code_verifier: verifier,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error("Could not start a secure calendar connection. Run supabase_calendar_setup.sql first.");

  const authUrl = new URL(config.authEndpoint);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", callbackUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "consent");
  if (provider === "google") {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
  }
  return jsonResponse({ authorizationUrl: authUrl.toString(), provider });
}

async function exchangeToken(
  provider: Provider,
  values: Record<string, string>,
): Promise<Record<string, unknown>> {
  const config = credentials(provider);
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: callbackUri(),
    ...values,
  });
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || !json.access_token) {
    // Never echo the token response; it can contain provider diagnostics and sensitive content.
    throw new Error("The calendar provider rejected the OAuth exchange (HTTP " + response.status + "). Reconnect and verify its redirect URI and client secrets.");
  }
  return json;
}

async function providerAccount(provider: Provider, accessToken: string): Promise<{ email: string | null; calendarTimezone: string | null }> {
  try {
    if (provider === "google") {
      const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + accessToken },
      });
      if (!response.ok) return { email: null, calendarTimezone: null };
      const body = await response.json() as { email?: string };
      return { email: body.email ?? null, calendarTimezone: null };
    }

    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    const profile = profileResponse.ok ? await profileResponse.json() as { mail?: string; userPrincipalName?: string } : {};
    return { email: profile.mail ?? profile.userPrincipalName ?? null, calendarTimezone: null };
  } catch {
    return { email: null, calendarTimezone: null };
  }
}

async function handleOAuthCallback(url: URL): Promise<Response> {
  const state = url.searchParams.get("state") ?? "";
  if (!state || state.length > 300) return appRedirect("error", undefined, "invalid_state");
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const admin = adminClient();
  const stateHash = await sha256Hex(state);
  const { data, error } = await admin.rpc("weekwise_consume_calendar_oauth_state", { p_state_hash: stateHash });
  if (error) {
    console.error("Could not consume a Weekwise OAuth transaction.");
    return appRedirect("error", undefined, "server_setup");
  }
  const transaction = Array.isArray(data) ? data[0] as OAuthState | undefined : data as OAuthState | null;
  if (!transaction || !providerValid(transaction.provider)) return appRedirect("error", undefined, "invalid_or_expired_state");
  if (providerError || !code) return appRedirect("error", transaction.provider, "provider_cancelled");

  try {
    const tokens = await exchangeToken(transaction.provider, {
      grant_type: "authorization_code",
      code,
      code_verifier: transaction.code_verifier,
    });
    const expiresIn = Math.max(60, Math.min(86400, Number(tokens.expires_in) || 3600));
    const { data: existing } = await admin.from("weekwise_calendar_connections")
      .select("*").eq("user_id", transaction.user_id).eq("provider", transaction.provider).maybeSingle();
    let refreshToken = typeof tokens.refresh_token === "string" ? tokens.refresh_token : null;
    if (!refreshToken && existing?.encrypted_refresh_token) {
      refreshToken = await decryptText(existing.encrypted_refresh_token);
    }
    if (!refreshToken) {
      return appRedirect("error", transaction.provider, "refresh_token_missing");
    }

    const accessToken = String(tokens.access_token);
    const account = await providerAccount(transaction.provider, accessToken);
    const encryptedAccess = await encryptText(accessToken);
    const encryptedRefresh = await encryptText(refreshToken);
    const { error: saveError } = await admin.from("weekwise_calendar_connections").upsert({
      user_id: transaction.user_id,
      provider: transaction.provider,
      encrypted_access_token: encryptedAccess,
      encrypted_refresh_token: encryptedRefresh,
      access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      granted_scope: String(tokens.scope ?? credentials(transaction.provider).scopes.join(" ")),
      provider_account_email: account.email,
      provider_calendar_timezone: account.calendarTimezone,
      updated_at: new Date().toISOString(),
      connected_at: existing?.connected_at ?? new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (saveError) throw new Error("Could not safely save the calendar connection. Run the calendar setup SQL and try again.");
    return appRedirect("connected", transaction.provider);
  } catch (error) {
    console.error("Weekwise calendar OAuth callback failed:", error instanceof Error ? error.message : "unknown error");
    return appRedirect("error", transaction.provider, "token_exchange_failed");
  }
}

async function refreshConnectionToken(
  admin: ReturnType<typeof adminClient>,
  connection: CalendarConnection,
): Promise<{ connection: CalendarConnection; accessToken: string }> {
  const expiration = new Date(connection.access_token_expires_at).getTime();
  if (Number.isFinite(expiration) && expiration > Date.now() + 90_000) {
    return { connection, accessToken: await decryptText(connection.encrypted_access_token) };
  }

  const refreshToken = await decryptText(connection.encrypted_refresh_token);
  const tokens = await exchangeToken(connection.provider, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    ...(connection.provider === "microsoft" ? { scope: credentials(connection.provider).scopes.join(" ") } : {}),
  });
  const newRefreshToken = typeof tokens.refresh_token === "string" ? tokens.refresh_token : refreshToken;
  const expiresIn = Math.max(60, Math.min(86400, Number(tokens.expires_in) || 3600));
  const updated: CalendarConnection = {
    ...connection,
    encrypted_access_token: await encryptText(String(tokens.access_token)),
    encrypted_refresh_token: await encryptText(newRefreshToken),
    access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    granted_scope: String(tokens.scope ?? connection.granted_scope),
  };
  const { error } = await admin.from("weekwise_calendar_connections").upsert({
    ...updated,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });
  if (error) throw new Error("Could not refresh the calendar provider session. Disconnect and reconnect the calendar.");
  return { connection: updated, accessToken: String(tokens.access_token) };
}

function isoDateParts(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Calendar date is invalid.");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function addIsoDays(key: string, days: number): string {
  const parts = isoDateParts(key);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0");
}

function sundayIso(key: string): string {
  const parts = isoDateParts(key);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0");
}

function dateKeyInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function partsInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>;
}

function validCalendarDate(dateKey: string): boolean {
  try {
    const parts = isoDateParts(dateKey);
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return date.getUTCFullYear() === parts.year && date.getUTCMonth() + 1 === parts.month && date.getUTCDate() === parts.day;
  } catch {
    return false;
  }
}

function taskEntries(payload: Json, fromKey: string, toKey: string): TaskRecord[] {
  const store = payload.store as Record<string, unknown> | undefined;
  const weeks = store?.weeks as Record<string, { tasks?: unknown[] }> | undefined;
  if (!weeks || typeof weeks !== "object") return [];
  const rows: TaskRecord[] = [];
  for (const [weekKey, week] of Object.entries(weeks)) {
    if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(weekKey) || !Array.isArray(week?.tasks)) continue;
    for (const raw of week.tasks) {
      if (!raw || typeof raw !== "object") continue;
      const task = raw as WeekwiseTask;
      if (!task.id || typeof task.title !== "string" || task.custom === false || task.fixed === true || task.done === true || task.status === "done") continue;
      const dateKey = task.allDay && typeof task.allDayDate === "string"
        ? task.allDayDate
        : addIsoDays(weekKey, Number(task.day) || 0);
      if (dateKey < fromKey || dateKey > toKey) continue;
      const scheduled = !!task.allDay || (task.start !== null && task.start !== undefined && !task.unscheduled && Number(task.duration) > 0);
      if (!scheduled) continue;
      rows.push({ task, weekKey, dateKey });
    }
  }
  return rows;
}

async function taskFingerprint(task: WeekwiseTask, dateKey: string): Promise<string> {
  const content = JSON.stringify({
    title: String(task.title ?? ""),
    dateKey,
    start: task.allDay ? null : (task.start === null || task.start === undefined ? null : Number(task.start)),
    duration: Number(task.duration) || 0,
    allDay: !!task.allDay,
    note: String(task.note ?? ""),
    done: !!task.done,
    status: String(task.status ?? ""),
  });
  return await sha256Hex(content);
}

function findTask(payload: Json, taskId: string): TaskRecord | null {
  const store = payload.store as Record<string, unknown> | undefined;
  const weeks = store?.weeks as Record<string, { tasks?: unknown[] }> | undefined;
  if (!weeks) return null;
  for (const [weekKey, week] of Object.entries(weeks)) {
    if (!Array.isArray(week?.tasks)) continue;
    const task = week.tasks.find(row => row && typeof row === "object" && (row as WeekwiseTask).id === taskId) as WeekwiseTask | undefined;
    if (task) {
      const dateKey = task.allDay && typeof task.allDayDate === "string" ? task.allDayDate : addIsoDays(weekKey, Number(task.day) || 0);
      return { task, weekKey, dateKey };
    }
  }
  return null;
}

function ensureWeek(payload: Json, weekKey: string): { tasks: unknown[]; [key: string]: unknown } {
  const store = payload.store as Record<string, unknown>;
  if (!store.weeks || typeof store.weeks !== "object") store.weeks = {};
  const weeks = store.weeks as Record<string, { tasks?: unknown[]; [key: string]: unknown }>;
  if (!weeks[weekKey] || typeof weeks[weekKey] !== "object") weeks[weekKey] = { tasks: [] };
  if (!Array.isArray(weeks[weekKey].tasks)) weeks[weekKey].tasks = [];
  return weeks[weekKey] as { tasks: unknown[]; [key: string]: unknown };
}

function eventTaskFields(event: NormalEvent, timezone: string): { dateKey: string; allDay: boolean; start: number | null; duration: number } {
  if (event.allDay) return { dateKey: event.startDate, allDay: true, start: null, duration: 30 };
  if (!event.startAt || !event.endAt) return { dateKey: event.startDate, allDay: false, start: null, duration: 30 };
  const local = partsInZone(event.startAt, timezone);
  const dateKey = local.year + "-" + local.month + "-" + local.day;
  const start = Number(local.hour) * 60 + Number(local.minute);
  const duration = Math.max(10, Math.min(1440, Math.round((event.endAt.getTime() - event.startAt.getTime()) / 60000)));
  return { dateKey, allDay: false, start, duration };
}

function moveOrUpdateTask(
  payload: Json,
  taskId: string,
  event: NormalEvent,
  timezone: string,
): { task: WeekwiseTask; dateKey: string; wasCreated: boolean } {
  const fields = eventTaskFields(event, timezone);
  const newWeekKey = sundayIso(fields.dateKey);
  const existing = findTask(payload, taskId);
  const store = payload.store as Record<string, unknown>;
  const weeks = store.weeks as Record<string, { tasks?: unknown[]; [key: string]: unknown }>;
  let task: WeekwiseTask;
  let wasCreated = false;

  if (existing && existing.weekKey !== newWeekKey) {
    weeks[existing.weekKey].tasks = (weeks[existing.weekKey].tasks || []).filter(item => (item as WeekwiseTask).id !== taskId);
    task = existing.task;
  } else if (existing) {
    task = existing.task;
  } else {
    task = {
      id: taskId,
      title: event.title || "Untitled calendar event",
      day: new Date(Date.UTC(isoDateParts(fields.dateKey).year, isoDateParts(fields.dateKey).month - 1, isoDateParts(fields.dateKey).day)).getUTCDay(),
      type: "other",
      duration: fields.duration,
      start: fields.start,
      custom: true,
      fixed: false,
      unscheduled: false,
      allDay: fields.allDay,
      allDayDate: fields.allDay ? fields.dateKey : null,
      dueDate: null,
      reminderAt: null,
      reminderTimes: [],
      reminderNotifiedTimes: [],
      reminderNotifiedAt: null,
      listId: "personal",
      folderName: "Calendar imports",
      sectionName: "Connected calendar",
      priority: "none",
      status: "todo",
      done: false,
      note: event.description.slice(0, 180),
      recurrence: "none",
      tags: ["calendar-import"],
      attachments: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    wasCreated = true;
  }

  const p = isoDateParts(fields.dateKey);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  task.title = event.title || "Untitled calendar event";
  task.day = day;
  task.duration = fields.duration;
  task.start = fields.start;
  task.allDay = fields.allDay;
  task.allDayDate = fields.allDay ? fields.dateKey : null;
  task.unscheduled = false;
  task.note = event.description.slice(0, 180);
  task.updatedAt = new Date().toISOString();

  ensureWeek(payload, newWeekKey).tasks = (ensureWeek(payload, newWeekKey).tasks as unknown[]).filter(item => (item as WeekwiseTask).id !== taskId).concat(task);
  return { task, dateKey: fields.dateKey, wasCreated };
}

function remoteEventFor(provider: Provider, event: Record<string, unknown>, timezone: string): NormalEvent | null {
  const id = String(event.id ?? "");
  if (!id || event.status === "cancelled" || event.isCancelled === true || event.isCancelled === "true") return null;
  const title = String(provider === "google" ? event.summary ?? "" : event.subject ?? "").slice(0, 100);
  const description = String(
    provider === "google"
      ? event.description ?? ""
      : ((event.body as Record<string, unknown> | undefined)?.content ?? ""),
  ).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);

  if (provider === "google") {
    const start = event.start as Record<string, unknown> | undefined;
    const end = event.end as Record<string, unknown> | undefined;
    if (!start || !end) return null;
    if (typeof start.date === "string") {
      const eventDate = start.date;
      if (!validCalendarDate(eventDate)) return null;
      return {
        id,
        taskId: String(((event.extendedProperties as Record<string, unknown> | undefined)?.private as Record<string, unknown> | undefined)?.weekwiseTaskId ?? "") || null,
        title,
        description,
        allDay: true,
        startDate: eventDate,
        startAt: null,
        endAt: null,
        updatedAt: String(event.updated ?? "") || null,
        cancelled: false,
      };
    }
    const startAt = new Date(String(start.dateTime ?? ""));
    const endAt = new Date(String(end.dateTime ?? ""));
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) return null;
    return {
      id,
      taskId: String(((event.extendedProperties as Record<string, unknown> | undefined)?.private as Record<string, unknown> | undefined)?.weekwiseTaskId ?? "") || null,
      title,
      description,
      allDay: false,
      startDate: dateKeyInZone(startAt, timezone),
      startAt,
      endAt,
      updatedAt: String(event.updated ?? "") || null,
      cancelled: false,
    };
  }

  const start = event.start as Record<string, unknown> | undefined;
  const end = event.end as Record<string, unknown> | undefined;
  if (!start || !end) return null;
  const startText = String(start.dateTime ?? "");
  const endText = String(end.dateTime ?? "");
  if (!startText || !endText) return null;
  const allDay = event.isAllDay === true;
  const props = Array.isArray(event.singleValueExtendedProperties)
    ? event.singleValueExtendedProperties as Array<{ id?: string; value?: string }>
    : [];
  const taskId = props.find(item => item.id === GRAPH_EXT_ID)?.value ?? null;

  // Microsoft Graph returns all-day start/end as local midnight in the requested Windows
  // time zone. Preserve calendar dates directly; no timezone conversion is needed for them.
  if (allDay) {
    const startDate = startText.slice(0, 10);
    const endDate = endText.slice(0, 10);
    if (!validCalendarDate(startDate) || !validCalendarDate(endDate)) return null;
    return {
      id,
      taskId: taskId ? String(taskId) : null,
      title,
      description,
      allDay: true,
      startDate,
      startAt: null,
      endAt: null,
      updatedAt: String(event.lastModifiedDateTime ?? "") || null,
      cancelled: false,
    };
  }

  // Graph can serialize fractional seconds with seven digits; native Date parsing and
  // date-fns timezone conversion should not depend on precision beyond milliseconds.
  const normalizeGraphDateTime = (value: string) =>
    value.replace(/(\\.\\d{3})\\d+(?=$|Z|[+-]\\d{2}:\\d{2})/, "$1").replace(/Z$/i, "");
  const startAt = fromZonedTime(normalizeGraphDateTime(startText), timezone);
  const endAt = fromZonedTime(normalizeGraphDateTime(endText), timezone);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) return null;
  return {
    id,
    taskId: taskId ? String(taskId) : null,
    title,
    description,
    allDay: false,
    startDate: dateKeyInZone(startAt, timezone),
    startAt,
    endAt,
    updatedAt: String(event.lastModifiedDateTime ?? "") || null,
    cancelled: false,
  };
}

async function fetchJson(url: string, accessToken: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined ?? {}),
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new Error("The calendar provider rejected the access token. Try Sync again to refresh the connection.");
    if (status === 403) throw new Error("The connected calendar denied access. Reconnect and grant calendar read/write permission.");
    if (status === 404) throw new Error("A linked calendar event no longer exists. Review sync conflicts before reconnecting.");
    throw new Error("The calendar provider returned HTTP " + status + ". No Weekwise cloud changes were overwritten silently.");
  }
  return body;
}

// This integration deliberately syncs only the connected user's primary calendar.
async function listRemoteEvents(
  provider: Provider,
  accessToken: string,
  from: Date,
  to: Date,
  timezone: string,
): Promise<NormalEvent[]> {
  const events: NormalEvent[] = [];
  if (provider === "google") {
    let nextPageToken = "";
    do {
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", from.toISOString());
      url.searchParams.set("timeMax", to.toISOString());
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("maxResults", "2500");
      url.searchParams.set("showDeleted", "false");
      url.searchParams.set("orderBy", "startTime");
      if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);
      const body = await fetchJson(url.toString(), accessToken);
      const batch = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
      for (const item of batch) {
        const normalized = remoteEventFor(provider, item, timezone);
        if (normalized) events.push(normalized);
      }
      nextPageToken = String(body.nextPageToken ?? "");
    } while (nextPageToken);
    return events;
  }

  let nextLink: string | null = null;
  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", from.toISOString());
  url.searchParams.set("endDateTime", to.toISOString());
  url.searchParams.set("$top", "500");
  url.searchParams.set("$expand", "singleValueExtendedProperties($filter=id eq '" + GRAPH_EXT_ID + "')");
  nextLink = url.toString();
  const windowsZone = graphTimeZone(timezone);
  while (nextLink) {
    const body = await fetchJson(nextLink, accessToken, {
      headers: { Prefer: 'outlook.timezone="' + windowsZone + '", IdType="ImmutableId"' },
    });
    const batch = Array.isArray(body.value) ? body.value as Array<Record<string, unknown>> : [];
    for (const item of batch) {
      const normalized = remoteEventFor(provider, item, timezone);
      if (normalized) events.push(normalized);
    }
    nextLink = typeof body["@odata.nextLink"] === "string" ? body["@odata.nextLink"] as string : null;
  }
  return events;
}

function createProviderEvent(record: TaskRecord, provider: Provider, timezone: string): Record<string, unknown> {
  const task = record.task;
  const dateKey = task.allDay && typeof task.allDayDate === "string" ? task.allDayDate : record.dateKey;
  if (task.allDay) {
    const endDate = addIsoDays(dateKey, 1);
    if (provider === "google") {
      return {
        summary: String(task.title).slice(0, 100),
        description: String(task.note ?? "").slice(0, 180),
        start: { date: dateKey },
        end: { date: endDate },
        extendedProperties: { private: { weekwiseTaskId: task.id } },
      };
    }
    const zone = graphTimeZone(timezone);
    return {
      subject: String(task.title).slice(0, 100),
      body: { contentType: "text", content: String(task.note ?? "").slice(0, 180) },
      isAllDay: true,
      start: { dateTime: dateKey + "T00:00:00", timeZone: zone },
      end: { dateTime: endDate + "T00:00:00", timeZone: zone },
      singleValueExtendedProperties: [{ id: GRAPH_EXT_ID, value: task.id }],
    };
  }

  const startMinutes = Math.max(0, Math.min(1439, Number(task.start) || 0));
  const duration = Math.max(10, Math.min(1440, Number(task.duration) || 30));
  const startLocal = dateKey + "T" + String(Math.floor(startMinutes / 60)).padStart(2, "0") + ":" + String(startMinutes % 60).padStart(2, "0") + ":00";
  const endTotal = startMinutes + duration;
  const endDate = addIsoDays(dateKey, Math.floor(endTotal / 1440));
  const endMin = endTotal % 1440;
  const endLocal = endDate + "T" + String(Math.floor(endMin / 60)).padStart(2, "0") + ":" + String(endMin % 60).padStart(2, "0") + ":00";
  if (provider === "google") {
    return {
      summary: String(task.title).slice(0, 100),
      description: String(task.note ?? "").slice(0, 180),
      start: { dateTime: fromZonedTime(startLocal, timezone).toISOString(), timeZone: timezone },
      end: { dateTime: fromZonedTime(endLocal, timezone).toISOString(), timeZone: timezone },
      extendedProperties: { private: { weekwiseTaskId: task.id } },
    };
  }
  const zone = graphTimeZone(timezone);
  return {
    subject: String(task.title).slice(0, 100),
    body: { contentType: "text", content: String(task.note ?? "").slice(0, 180) },
    isAllDay: false,
    start: { dateTime: startLocal, timeZone: zone },
    end: { dateTime: endLocal, timeZone: zone },
    singleValueExtendedProperties: [{ id: GRAPH_EXT_ID, value: task.id }],
  };
}

async function writeProviderEvent(
  provider: Provider,
  accessToken: string,
  taskRecord: TaskRecord,
  timezone: string,
  existingEventId: string | null,
): Promise<NormalEvent> {
  const eventBody = createProviderEvent(taskRecord, provider, timezone);
  let body: Record<string, unknown>;
  if (provider === "google") {
    const url = existingEventId
      ? "https://www.googleapis.com/calendar/v3/calendars/primary/events/" + encodeURIComponent(existingEventId)
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    body = await fetchJson(url, accessToken, {
      method: existingEventId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
    });
  } else {
    const url = existingEventId
      ? "https://graph.microsoft.com/v1.0/me/events/" + encodeURIComponent(existingEventId)
      : "https://graph.microsoft.com/v1.0/me/events";
    if (existingEventId) {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + accessToken,
          Accept: "application/json",
          "Content-Type": "application/json",
          Prefer: 'outlook.timezone="' + graphTimeZone(timezone) + '", IdType="ImmutableId"',
        },
        body: JSON.stringify(eventBody),
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error("A linked Outlook event was deleted. Resolve this sync conflict before retrying.");
        throw new Error("Outlook could not update a linked event (HTTP " + response.status + ").");
      }
      // Graph PATCH may return 204 without the new event body; fetch by ID for a new ETag/time.
      body = await fetchJson(url, accessToken, { headers: { Prefer: 'outlook.timezone="' + graphTimeZone(timezone) + '", IdType="ImmutableId"' } });
    } else {
      body = await fetchJson(url, accessToken, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: 'outlook.timezone="' + graphTimeZone(timezone) + '", IdType="ImmutableId"',
        },
        body: JSON.stringify(eventBody),
      });
    }
  }
  const normalized = remoteEventFor(provider, body, timezone);
  if (!normalized) throw new Error("The provider saved an event but returned an unsupported event representation.");
  return normalized;
}

function makeTaskId(provider: Provider, eventId: string): Promise<string> {
  return sha256Hex(provider + ":" + eventId).then(hash => (provider === "google" ? "gcal_" : "outlook_") + hash.slice(0, 20));
}

async function synchronizeCalendar(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  provider: Provider,
  timezoneInput: unknown,
): Promise<Json | Response> {
  const timezone = safeTimeZone(timezoneInput);
  if (provider === "microsoft" && timezone !== "UTC" && !COMMON_WINDOWS_TIMEZONES[timezone]) {
    throw new Error("Outlook calendar sync does not yet have a verified Windows time-zone mapping for " + timezone + ". Use Google Calendar or change this device to a supported time zone before syncing.");
  }
  const { data: connection, error: connectionError } = await admin.from("weekwise_calendar_connections")
    .select("*").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (connectionError) throw new Error("Could not read this calendar connection.");
  if (!connection) throw new Error("Connect this calendar first.");
  const tokenResult = await refreshConnectionToken(admin, connection as CalendarConnection);
  const accessToken = tokenResult.accessToken;
  const today = dateKeyInZone(new Date(), timezone);
  const fromKey = addIsoDays(today, -30);
  const toKey = addIsoDays(today, 90);
  const from = fromZonedTime(fromKey + "T00:00:00", timezone);
  const to = fromZonedTime(addIsoDays(toKey, 1) + "T00:00:00", timezone);

  const { data: cloud, error: cloudError } = await admin.from("weekwise_cloud_data")
    .select("user_id,data,revision,updated_at").eq("user_id", userId).maybeSingle();
  if (cloudError) throw new Error("Could not read the Weekwise cloud snapshot.");
  if (!cloud) throw new Error("Cloud sync has not been initialized. Sign in to Weekwise and press Sync now first.");

  const payload = JSON.parse(JSON.stringify(cloud.data ?? {})) as Json;
  if (!payload.store || typeof payload.store !== "object") throw new Error("The cloud snapshot has no planner store to synchronize.");
  const linksQuery = await admin.from("weekwise_calendar_event_links").select("*").eq("user_id", userId).eq("provider", provider);
  if (linksQuery.error) throw new Error("Could not read saved calendar event links.");
  const links = (linksQuery.data ?? []) as CalendarLink[];
  const linksByTask = new Map(links.map(link => [link.task_id, link]));
  const linksByEvent = new Map(links.map(link => [link.provider_event_id, link]));
  const remoteEvents = await listRemoteEvents(provider, accessToken, from, to, timezone);
  const remoteById = new Map(remoteEvents.map(event => [event.id, event]));
  const activeTaskIds = new Set<string>();
  const handledTaskIds = new Set<string>();
  const linkUpserts = new Map<string, Record<string, unknown>>();
  const linkDeletes: string[] = [];
  const conflicts: Array<{ title: string; reason: string }> = [];
  const result = { imported: 0, exported: 0, updatedInWeekwise: 0, updatedInCalendar: 0, conflicts: 0, skipped: 0 };
  let payloadChanged = false;

  for (const remote of remoteEvents) {
    let link = linksByEvent.get(remote.id);
    let taskId = link?.task_id ?? remote.taskId;
    let record = taskId ? findTask(payload, taskId) : null;

    if (!link && taskId && record) {
      // Recover the map after a function retry; provider event metadata is an idempotency key.
      const fingerprint = await taskFingerprint(record.task, record.dateKey);
      link = {
        user_id: userId,
        provider,
        task_id: taskId,
        provider_event_id: remote.id,
        weekwise_fingerprint: fingerprint,
        provider_updated_at: remote.updatedAt,
        provider_event_start_at: remote.allDay ? fromZonedTime(remote.startDate + "T00:00:00", timezone).toISOString() : remote.startAt?.toISOString() ?? null,
        origin: "weekwise",
        synced_at: new Date().toISOString(),
      };
      linkUpserts.set(taskId, link as unknown as Record<string, unknown>);
      linksByTask.set(taskId, link);
      linksByEvent.set(remote.id, link);
    }

    if (!taskId) {
      taskId = await makeTaskId(provider, remote.id);
      record = findTask(payload, taskId);
      if (!record) {
        const moved = moveOrUpdateTask(payload, taskId, remote, timezone);
        result.imported += 1;
        payloadChanged = true;
        record = findTask(payload, moved.task.id);
      }
      if (record) {
        const fingerprint = await taskFingerprint(record.task, record.dateKey);
        link = {
          user_id: userId,
          provider,
          task_id: taskId,
          provider_event_id: remote.id,
          weekwise_fingerprint: fingerprint,
          provider_updated_at: remote.updatedAt,
          provider_event_start_at: remote.allDay ? fromZonedTime(remote.startDate + "T00:00:00", timezone).toISOString() : remote.startAt?.toISOString() ?? null,
          origin: "provider",
          synced_at: new Date().toISOString(),
        };
        linkUpserts.set(taskId, link as unknown as Record<string, unknown>);
        linksByTask.set(taskId, link);
        linksByEvent.set(remote.id, link);
        handledTaskIds.add(taskId);
      }
      continue;
    }

    handledTaskIds.add(taskId);
    if (!record) {
      if (link?.origin === "provider") {
        const moved = moveOrUpdateTask(payload, taskId, remote, timezone);
        record = findTask(payload, moved.task.id);
        if (record) {
          const fingerprint = await taskFingerprint(record.task, record.dateKey);
          linkUpserts.set(taskId, {
            user_id: userId,
            provider,
            task_id: taskId,
            provider_event_id: remote.id,
            weekwise_fingerprint: fingerprint,
            provider_updated_at: remote.updatedAt,
            provider_event_start_at: remote.allDay ? fromZonedTime(remote.startDate + "T00:00:00", timezone).toISOString() : remote.startAt?.toISOString() ?? null,
            origin: "provider",
            synced_at: new Date().toISOString(),
          });
          result.imported += 1;
          payloadChanged = true;
        }
      } else {
        conflicts.push({ title: remote.title || "Untitled event", reason: "The linked Weekwise task was deleted locally." });
      }
      continue;
    }

    activeTaskIds.add(taskId);
    const currentFingerprint = await taskFingerprint(record.task, record.dateKey);
    const baseFingerprint = String(link?.weekwise_fingerprint ?? "");
    const localChanged = baseFingerprint !== "" && currentFingerprint !== baseFingerprint;
    const updatedAt = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
    const previousRemoteUpdatedAt = link?.provider_updated_at ? new Date(link.provider_updated_at).getTime() : 0;
    const remoteChanged = !!link && updatedAt > previousRemoteUpdatedAt + 1000;

    if (link && localChanged && remoteChanged) {
      conflicts.push({ title: remote.title || String(record.task.title), reason: "Both Weekwise and the provider changed this event since the last sync." });
      continue;
    }

    if (link && remoteChanged && !localChanged) {
      const moved = moveOrUpdateTask(payload, taskId, remote, timezone);
      const current = findTask(payload, moved.task.id);
      if (current) {
        const fingerprint = await taskFingerprint(current.task, current.dateKey);
        linkUpserts.set(taskId, {
          user_id: userId,
          provider,
          task_id: taskId,
          provider_event_id: remote.id,
          weekwise_fingerprint: fingerprint,
          provider_updated_at: remote.updatedAt,
          provider_event_start_at: remote.allDay ? fromZonedTime(remote.startDate + "T00:00:00", timezone).toISOString() : remote.startAt?.toISOString() ?? null,
          origin: link.origin,
          synced_at: new Date().toISOString(),
        });
        result.updatedInWeekwise += 1;
        payloadChanged = true;
      }
    } else if (link && localChanged && !remoteChanged) {
      const taskRecord = findTask(payload, taskId);
      if (!taskRecord) continue;
      // Queue provider changes only after the revision-checked cloud save succeeds.
      linkUpserts.set(taskId, {
        ...link,
        __pendingProviderWrite: true,
        __pendingFingerprint: currentFingerprint,
        __pendingWeekKey: taskRecord.weekKey,
        __pendingDateKey: taskRecord.dateKey,
      });
    } else if (!link) {
      const fingerprint = await taskFingerprint(record.task, record.dateKey);
      linkUpserts.set(taskId, {
        user_id: userId,
        provider,
        task_id: taskId,
        provider_event_id: remote.id,
        weekwise_fingerprint: fingerprint,
        provider_updated_at: remote.updatedAt,
        provider_event_start_at: remote.allDay ? fromZonedTime(remote.startDate + "T00:00:00", timezone).toISOString() : remote.startAt?.toISOString() ?? null,
        origin: "weekwise",
        synced_at: new Date().toISOString(),
      });
    }
  }

  const currentTasks = taskEntries(payload, fromKey, toKey);
  for (const record of currentTasks) {
    const taskId = record.task.id;
    if (handledTaskIds.has(taskId)) continue;
    activeTaskIds.add(taskId);
    const link = linksByTask.get(taskId);
    if (!link) {
      const fingerprint = await taskFingerprint(record.task, record.dateKey);
      linkUpserts.set(taskId, {
        user_id: userId,
        provider,
        task_id: taskId,
        provider_event_id: "",
        weekwise_fingerprint: fingerprint,
        provider_updated_at: null,
        provider_event_start_at: record.task.allDay
          ? fromZonedTime(record.dateKey + "T00:00:00", timezone).toISOString()
          : fromZonedTime(record.dateKey + "T" + String(Math.floor(Number(record.task.start) / 60)).padStart(2, "0") + ":" + String(Number(record.task.start) % 60).padStart(2, "0") + ":00", timezone).toISOString(),
        origin: "weekwise",
        synced_at: new Date().toISOString(),
        __pendingProviderWrite: true,
        __pendingFingerprint: fingerprint,
        __pendingWeekKey: record.weekKey,
        __pendingDateKey: record.dateKey,
      });
      continue;
    }

    const remote = remoteById.get(link.provider_event_id);
    if (!remote) {
      const linkedDate = link.provider_event_start_at ? dateKeyInZone(new Date(link.provider_event_start_at), timezone) : record.dateKey;
      if (linkedDate >= fromKey && linkedDate <= toKey) {
        conflicts.push({ title: String(record.task.title), reason: "The linked provider event was deleted or moved out of the sync window. Weekwise kept its task." });
      }
      continue;
    }
    // This is the link fallback when a provider update occurred without a usable updated timestamp.
    if (!link.provider_updated_at && !handledTaskIds.has(taskId)) {
      const fingerprint = await taskFingerprint(record.task, record.dateKey);
      linkUpserts.set(taskId, {
        ...link,
        weekwise_fingerprint: fingerprint,
        provider_updated_at: remote.updatedAt,
        provider_event_start_at: remote.allDay ? fromZonedTime(remote.startDate + "T00:00:00", timezone).toISOString() : remote.startAt?.toISOString() ?? null,
        synced_at: new Date().toISOString(),
      });
    }
  }

  // Keep the snapshot update revision-safe; if another device changed it concurrently,
  // do not proceed with provider writes.
  const save = await admin.rpc("weekwise_calendar_save_cloud", {
    p_user_id: userId,
    p_data: payload,
    p_expected_revision: Number(cloud.revision) || 0,
  });
  if (save.error) throw new Error("Could not save calendar imports to the cloud. Check that supabase_calendar_setup.sql has been applied.");
  const saveResult = Array.isArray(save.data) ? save.data[0] as Record<string, unknown> | undefined : save.data as Record<string, unknown> | null;
  if (!saveResult?.saved) {
    return jsonResponse({
      error: "Weekwise changed in another session during calendar sync. No pending calendar writes were applied. Press Sync now and retry.",
      code: "revision_conflict",
    }, 409);
  }

  // Persist imported items and event mappings now that the cloud revision has been accepted.
  for (const [taskId, rawLink] of [...linkUpserts.entries()]) {
    if (!rawLink.__pendingProviderWrite) {
      const { error } = await admin.from("weekwise_calendar_event_links").upsert(rawLink, { onConflict: "user_id,provider,task_id" });
      if (error) console.error("Could not save a Weekwise calendar event link for task " + taskId + ".");
    }
  }

  const pendingWrites = [...linkUpserts.entries()].filter(([, row]) => row.__pendingProviderWrite);
  for (const [taskId, pending] of pendingWrites) {
    const current = findTask(payload, taskId);
    if (!current) {
      conflicts.push({ title: "Task " + taskId, reason: "The local task was not present in the saved Weekwise snapshot." });
      continue;
    }
    const existingLink = linksByTask.get(taskId);
    const eventId = existingLink?.provider_event_id || null;
    try {
      const updatedEvent = await writeProviderEvent(provider, accessToken, current, timezone, eventId);
      const fingerprint = await taskFingerprint(current.task, current.dateKey);
      const linkRow: CalendarLink = {
        user_id: userId,
        provider,
        task_id: taskId,
        provider_event_id: updatedEvent.id,
        weekwise_fingerprint: fingerprint,
        provider_updated_at: updatedEvent.updatedAt,
        provider_event_start_at: updatedEvent.allDay
          ? fromZonedTime(updatedEvent.startDate + "T00:00:00", timezone).toISOString()
          : updatedEvent.startAt?.toISOString() ?? null,
        origin: "weekwise",
        synced_at: new Date().toISOString(),
      };
      const { error } = await admin.from("weekwise_calendar_event_links").upsert(linkRow, { onConflict: "user_id,provider,task_id" });
      if (error) {
        conflicts.push({ title: String(current.task.title), reason: "The provider event was written but its link could not be saved. Retry sync to reconcile it." });
      } else {
        linksByTask.set(taskId, linkRow);
        linksByEvent.set(updatedEvent.id, linkRow);
        result.exported += eventId ? 0 : 1;
        result.updatedInCalendar += eventId ? 1 : 0;
      }
    } catch (error) {
      conflicts.push({ title: String(current.task.title), reason: error instanceof Error ? error.message : "Calendar provider write failed." });
    }
  }

  result.conflicts = conflicts.length;
  return {
    ok: true,
    provider,
    timezone,
    range: { from: fromKey, to: toKey },
    ...result,
    conflicts: conflicts.slice(0, 20),
    revision: Number(saveResult.revision) || Number(cloud.revision) || 0,
    message: conflicts.length
      ? "Sync completed with conflicts. Weekwise did not silently overwrite either version."
      : "Weekwise and the connected calendar are synchronized for the selected date window.",
  };
}

async function main(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) return jsonResponse({ error: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(request.url);
  if (request.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("state") || url.searchParams.has("error"))) {
    return await handleOAuthCallback(url);
  }
  if (request.method !== "POST") return jsonResponse({ error: "Use POST to manage a Weekwise calendar connection." }, 405);

  try {
    const user = await getUser(request);
    if (!user) return jsonResponse({ error: "Sign in to Weekwise before connecting or syncing a calendar." }, 401);
    const body = await request.json().catch(() => ({} as Json)) as Json;
    const action = String(body.action ?? "");
    const admin = adminClient();

    if (action === "status") {
      const { data, error } = await admin.from("weekwise_calendar_connections")
        .select("provider,provider_account_email,access_token_expires_at,provider_calendar_timezone,connected_at,updated_at")
        .eq("user_id", user.id);
      if (error) throw new Error("Could not read the saved calendar connection status. Run supabase_calendar_setup.sql first.");
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return jsonResponse({
        ok: true,
        configured: {
          google: providerConfigured("google"),
          microsoft: providerConfigured("microsoft"),
          encryption: encryptionConfigured(),
        },
        providers: {
          google: rows.find(row => row.provider === "google") ?? null,
          microsoft: rows.find(row => row.provider === "microsoft") ?? null,
        },
      });
    }

    if (action === "connect") {
      const provider = body.provider;
      if (!providerValid(provider)) return jsonResponse({ error: "Choose Google Calendar or Microsoft Outlook." }, 400);
      return await startOAuth(admin, user.id, provider);
    }

    if (action === "disconnect") {
      const provider = body.provider;
      if (!providerValid(provider)) return jsonResponse({ error: "Choose a calendar provider." }, 400);
      const { error: linkError } = await admin.from("weekwise_calendar_event_links").delete().eq("user_id", user.id).eq("provider", provider);
      if (linkError) throw new Error("Could not remove calendar event links.");
      const { error } = await admin.from("weekwise_calendar_connections").delete().eq("user_id", user.id).eq("provider", provider);
      if (error) throw new Error("Could not disconnect this calendar.");
      return jsonResponse({
        ok: true,
        provider,
        message: "Weekwise removed its stored connection and sync links. To revoke provider consent as well, remove Weekwise from the Google or Microsoft account security page.",
      });
    }

    if (action === "sync") {
      const provider = body.provider;
      if (!providerValid(provider)) return jsonResponse({ error: "Choose a calendar provider." }, 400);
      const result = await synchronizeCalendar(admin, user.id, provider, body.timezone);
      return result instanceof Response ? result : jsonResponse(result);
    }

    return jsonResponse({ error: "Unknown Weekwise calendar action." }, 400);
  } catch (error) {
    console.error("Weekwise calendar request failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse({ error: error instanceof Error ? error.message : "Weekwise calendar request failed." }, 500);
  }
}

Deno.serve(main);
