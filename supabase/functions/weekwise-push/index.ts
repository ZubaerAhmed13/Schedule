import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { pushConfiguration } from "../_shared/runtime-config.mjs";
import webpush from "npm:web-push@3.6.7";
import { reminderTime, reminderZone } from "../_shared/reminder-clock.mjs";

type Json = Record<string, unknown>;
type BrowserPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};
type PushSubscriptionRow = {
  endpoint: string;
  subscription: BrowserPushSubscription;
  timezone: string;
  user_agent: string | null;
  updated_at: string;
};
type CloudRow = { user_id: string; data: Json; revision: number };

let runtime: Record<string,string> = {};
const APP_URL = "https://zubaerahmed13.github.io/Schedule/";
const ALLOWED_ORIGIN = Deno.env.get("WEEKWISE_ALLOWED_ORIGIN") ?? "https://zubaerahmed13.github.io";
const MAX_REMINDER_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 250;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-weekwise-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function jsonResponse(body: Json, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function requiredEnv(name: string): string {
  const value = (Deno.env.get(name) || runtime[name])?.trim();
  if (!value) throw new Error("Server configuration is missing " + name + ".");
  return value;
}

function adminClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return difference === 0;
}


function isTrustedPushEndpoint(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" ||
      host === "notify.windows.com" ||
      host === "push.services.mozilla.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

function validTimeZone(candidate: unknown): string {
  if (typeof candidate !== "string" || candidate.length > 100) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function listTasksFromCloud(data: Json): Array<{ task: Json; reminderAt: string }> {
  const store = data.store as Json | undefined;
  const weeks = store?.weeks as Record<string, Json> | undefined;
  if (!weeks || typeof weeks !== "object") return [];
  const output: Array<{ task: Json; reminderAt: string }> = [];
  for (const week of Object.values(weeks)) {
    const tasks = week?.tasks;
    if (!Array.isArray(tasks)) continue;
    for (const task of tasks) {
      if (!task || typeof task !== "object" || task.custom === false || task.done === true || task.status === "done") continue;
      const id = String(task.id ?? "").trim();
      if (!id) continue;
      const values = Array.isArray(task.reminderTimes) ? task.reminderTimes : (task.reminderAt ? [task.reminderAt] : []);
      const notified = new Set(Array.isArray(task.reminderNotifiedTimes) ? task.reminderNotifiedTimes.map(String) : []);
      if (task.reminderAt && task.reminderNotifiedAt === task.reminderAt) notified.add(String(task.reminderAt));
      for (const raw of values.slice(0, 5)) {
        const reminderAt = String(raw ?? "").trim();
        if (reminderAt && !notified.has(reminderAt)) output.push({ task: task as Json, reminderAt });
      }
    }
  }
  return output;
}

async function authenticateUser(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return { user: null, error: "Sign in to manage background reminders." };
  }
  const url = requiredEnv("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("Server configuration is missing SUPABASE_ANON_KEY.");
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { user: null, error: "Your sign-in has expired. Sign in again and retry." };
  }
  return { user: data.user, error: null };
}

function getTaskName(task: Json): string {
  const name = String(task.title ?? "Untitled task").trim().slice(0, 100);
  return name || "Untitled task";
}

async function dispatchDueReminders(admin: ReturnType<typeof adminClient>) {
  webpush.setVapidDetails(
    requiredEnv("VAPID_SUBJECT"),
    requiredEnv("VAPID_PUBLIC_KEY"),
    requiredEnv("VAPID_PRIVATE_KEY"),
  );

  const now = new Date();
  const cutoff = now.getTime() - MAX_REMINDER_AGE_MS;
  const totals = { usersChecked: 0, dueReminders: 0, sent: 0, failed: 0, skipped: 0, removedSubscriptions: 0 };

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: cloudRows, error } = await admin
      .from("weekwise_cloud_data")
      .select("user_id,data,revision")
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Could not load cloud reminder records: " + error.message);
    const rows = (cloudRows ?? []) as CloudRow[];
    if (!rows.length) break;

    for (const cloud of rows) {
      const records = listTasksFromCloud(cloud.data ?? {});
      if (!records.length) continue;
      const { data: subscriptionRows, error: subscriptionError } = await admin
        .from("weekwise_push_subscriptions")
        .select("endpoint,subscription,timezone,user_agent,updated_at")
        .eq("user_id", cloud.user_id)
        .order("updated_at", { ascending: false });
      if (subscriptionError) throw new Error("Could not load push subscriptions.");
      const subscriptions = (subscriptionRows ?? []) as PushSubscriptionRow[];
      if (!subscriptions.length) continue;
      totals.usersChecked += 1;
      const timeZone = reminderZone(cloud.data,subscriptions[0].timezone);
      if(!timeZone){totals.skipped+=records.length;continue;}

      for (const record of records) {
        const reminder = reminderTime(record.reminderAt, timeZone);
        if (!reminder){totals.skipped+=1;continue;}
        const timestamp = reminder.getTime();
        if (timestamp > now.getTime() || timestamp < cutoff) continue;
        totals.dueReminders += 1;
        const taskId = String(record.task.id);
        const { data: claimed, error: claimError } = await admin.rpc("weekwise_claim_push_delivery", {
          p_user_id: cloud.user_id,
          p_task_id: taskId,
          p_reminder_at: record.reminderAt,
        });
        if (claimError) throw new Error("Could not safely claim a reminder delivery.");
        if (claimed !== true) {
          totals.skipped += 1;
          continue;
        }

        const payload = JSON.stringify({
          title: "Weekwise · " + getTaskName(record.task),
          body: "Your task reminder is due now.",
          tag: "weekwise-task-" + taskId + "-" + record.reminderAt,
          url: APP_URL,
          taskId,
          reminderAt: record.reminderAt,
        });
        let delivered = 0;
        const errors: string[] = [];

        for (const item of subscriptions) {
          try {
            await webpush.sendNotification(item.subscription as never, payload, { TTL: 3600, urgency: "high" });
            delivered += 1;
          } catch (error) {
            const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
            if (statusCode === 404 || statusCode === 410) {
              const { error: deleteError } = await admin.from("weekwise_push_subscriptions").delete().eq("endpoint", item.endpoint);
              if (!deleteError) totals.removedSubscriptions += 1;
            } else {
              errors.push(statusCode ? "Push provider returned HTTP " + statusCode : "Push provider request failed");
            }
          }
        }

        const status = delivered > 0 ? "sent" : "failed";
        const lastError = errors.slice(0, 3).join("; ").slice(0, 400) || (delivered ? null : "No active push subscription accepted the reminder.");
        const { error: updateError } = await admin.from("weekwise_push_delivery_log")
          .update({ status, sent_at: delivered ? new Date().toISOString() : null, last_error: lastError })
          .eq("user_id", cloud.user_id)
          .eq("task_id", taskId)
          .eq("reminder_at", record.reminderAt);
        if (updateError) console.error("Could not finalize a Weekwise push delivery claim.");
        if (delivered) totals.sent += 1;
        else totals.failed += 1;
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return totals;
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) return jsonResponse({ error: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Use POST for this endpoint." }, 405);

  try {
    runtime = await pushConfiguration(adminClient(), (name:string)=>Deno.env.get(name), ()=>webpush.generateVAPIDKeys());
    const body = await request.json().catch(() => ({} as Json)) as Json;
    const action = String(body.action ?? "");

    if (action === "dispatch") {
      const expectedSecret = requiredEnv("WEEKWISE_PUSH_CRON_SECRET");
      const receivedSecret = request.headers.get("x-weekwise-cron-secret") ?? "";
      if (!constantTimeEqual(receivedSecret, expectedSecret)) return jsonResponse({ error: "Unauthorized dispatcher." }, 401);
      const totals = await dispatchDueReminders(adminClient());
      return jsonResponse({ ok: true, ...totals });
    }

    if (action === "public-key") {
      return jsonResponse({ publicKey: requiredEnv("VAPID_PUBLIC_KEY") });
    }

    const auth = await authenticateUser(request);
    if (!auth.user) return jsonResponse({ error: auth.error ?? "Sign in required." }, 401);
    const admin = adminClient();

    if (action === "subscribe") {
      const subscription = body.subscription as BrowserPushSubscription | undefined;
      const endpoint = String(subscription?.endpoint ?? "");
      const keys = subscription?.keys;
      if (!isTrustedPushEndpoint(endpoint) || endpoint.length > 4096 ||
          !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" ||
          keys.p256dh.length > 512 || keys.auth.length > 512) {
        return jsonResponse({ error: "The browser returned an invalid push subscription." }, 400);
      }
      const timeZone = validTimeZone(body.timezone);
      const { error } = await admin.from("weekwise_push_subscriptions").upsert({
        endpoint,
        user_id: auth.user.id,
        subscription,
        timezone: timeZone,
        user_agent: (request.headers.get("User-Agent") ?? "").slice(0, 300),
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw new Error("Could not save this device's push subscription.");
      return jsonResponse({ ok: true, enabled: true, timezone: timeZone });
    }

    if (action === "unsubscribe") {
      const endpoint = String(body.endpoint ?? "");
      if (!isTrustedPushEndpoint(endpoint) || endpoint.length > 4096) return jsonResponse({ error: "Invalid push endpoint." }, 400);
      const { error } = await admin.from("weekwise_push_subscriptions").delete()
        .eq("endpoint", endpoint)
        .eq("user_id", auth.user.id);
      if (error) throw new Error("Could not remove this device's push subscription.");
      return jsonResponse({ ok: true, enabled: false });
    }

    if (action === "status") {
      const endpoint = String(body.endpoint ?? "");
      const { data, error } = await admin.from("weekwise_push_subscriptions")
        .select("endpoint,timezone,updated_at").eq("user_id", auth.user.id);
      if (error) throw new Error("Could not read background reminder status.");
      const devices = data ?? [];
      const current = devices.find((item: { endpoint: string }) => item.endpoint === endpoint);
      return jsonResponse({
        ok: true,
        enabled: Boolean(current),
        deviceCount: devices.length,
        timezone: current?.timezone ?? null,
        updatedAt: current?.updated_at ?? null,
      });
    }

    return jsonResponse({ error: "Unknown Weekwise push action." }, 400);
  } catch (error) {
    console.error("Weekwise push handler failed:", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: error instanceof Error ? error.message : "The push request failed." }, 500);
  }
});
