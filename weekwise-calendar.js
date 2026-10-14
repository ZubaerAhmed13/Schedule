/* Calendar operations capture their Weekwise session and discard stale account responses. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const providerNames = { google: "Google Calendar", microsoft: "Microsoft Outlook" };
  let busy = false, owner = null, generation = 0, operation = 0, statusSequence = 0, identityReady = false, feedback = null, pendingOAuthFeedback = null;
  let configured = { google: false, microsoft: false, encryption: false }, providers = { google: null, microsoft: null };
  const client = () => window.weekwiseCloudClient || null;
  const bridgeOwner = () => window.weekwiseCalendarBridge?.owner?.() || null;
  const current = context => context && context.generation === generation && context.owner === owner && context.owner === bridgeOwner();
  function setStatus(message, error = false) {
    const status = $("calendarConnectionsStatus");
    if (status) { status.textContent = message; status.dataset.tone = error ? "error" : ""; }
  }
  function renderProviders() {
    for (const provider of Object.keys(providerNames)) {
      const google = provider === "google", row = providers[provider], ready = configured[provider] && configured.encryption;
      const detail = $(google ? "googleCalendarConnectionDetail" : "microsoftCalendarConnectionDetail");
      const connect = $(google ? "connectGoogleCalendarBtn" : "connectMicrosoftCalendarBtn");
      const sync = $(google ? "syncGoogleCalendarBtn" : "syncMicrosoftCalendarBtn");
      const disconnect = $(google ? "disconnectGoogleCalendarBtn" : "disconnectMicrosoftCalendarBtn");
      if (detail) detail.textContent = !identityReady ? "Sign in and check this account’s calendar connections." : row ? "Connected" + (row.provider_account_email ? " · " + row.provider_account_email : "") + "." : ready ? "Ready to connect. Choose the calendar account you want to use." : "Not enabled yet. The Weekwise owner needs to finish provider setup.";
      if (connect) { connect.textContent = row ? "Reconnect" : google ? "Connect Google Calendar" : "Connect Outlook"; connect.disabled = busy || !identityReady || !ready; connect.title = ready ? "" : "Provider setup is required before connecting."; }
      if (sync) { sync.hidden = !row; sync.disabled = busy || !identityReady || !row || !ready; }
      if (disconnect) { disconnect.hidden = !row; disconnect.disabled = busy || !identityReady || !row; }
    }
    if ($("calendarRefreshStatus")) $("calendarRefreshStatus").disabled = busy;
  }
  function changed(next) {
    if (next === owner) return;
    owner = next; generation++; operation++; statusSequence++; busy = false; identityReady = false; feedback = null;
    configured = { google: false, microsoft: false, encryption: false }; providers = { google: null, microsoft: null };
    setStatus("Checking calendar connections for this account…"); renderProviders();
  }
  async function session(expectedGeneration) {
    const supabase = client();
    if (!supabase?.auth?.getSession) throw new Error("Cloud sign-in is unavailable. Reload Weekwise while online.");
    const { data, error } = await supabase.auth.getSession();
    if (expectedGeneration !== generation) return null;
    const value = data?.session;
    if (error || !value?.user?.id || !value.access_token || value.user.id !== bridgeOwner()) throw new Error("Sign in to Weekwise before connecting an external calendar.");
    return { generation, owner: value.user.id, token: value.access_token, supabase };
  }
  async function invoke(action, payload, context) {
    if (!current(context)) return null;
    if (!context.supabase.functions?.invoke) throw new Error("The calendar service is unavailable. Reload Weekwise and try again.");
    const { data, error } = await context.supabase.functions.invoke("weekwise-calendar", {
      body: { action, ...payload }, headers: { Authorization: "Bearer " + context.token }
    });
    if (!current(context)) return null;
    let details = data;
    if (error?.context?.json) try { details = await error.context.json(); } catch (_) {}
    if (!current(context)) return null;
    if (error || details?.error) { const wrapped = new Error(details?.error || error?.message || "Calendar request failed."); wrapped.details = details; throw wrapped; }
    return data || {};
  }
  async function refreshStatus(preserve = !!feedback) {
    if (busy) return;
    const sequence = ++statusSequence, stamp = generation;
    try {
      const context = await session(stamp);
      if (!context || sequence !== statusSequence) return;
      if (owner !== context.owner) owner = context.owner;
      if (!current(context)) return;
      const status = await invoke("status", {}, context);
      if (!status || !current(context) || sequence !== statusSequence || busy) return;
      identityReady = true;
      configured = { google: status.configured?.google === true, microsoft: status.configured?.microsoft === true, encryption: status.configured?.encryption === true };
      providers = { google: status.providers?.google || null, microsoft: status.providers?.microsoft || null }; renderProviders();
      if (preserve && feedback) { setStatus(feedback.message, feedback.error); return; }
      feedback = null;
      if (!configured.encryption) setStatus("Calendar connections are unavailable until the Weekwise owner completes secure setup.", true);
      else if (!configured.google && !configured.microsoft) setStatus("Google and Outlook are waiting for provider setup. Calendar file import and export remain available.");
      else if (!providers.google && !providers.microsoft) setStatus("Choose a ready provider to connect your calendar.");
      else setStatus(Object.keys(providerNames).filter(p => providers[p]).map(p => providerNames[p]).join(" and ") + " connected. Sync checks the primary calendar from 30 days back through 90 days ahead.");
    } catch (error) {
      if (sequence !== statusSequence || stamp !== generation) return;
      identityReady = false; providers = { google: null, microsoft: null }; renderProviders();
      if (preserve && feedback) setStatus(feedback.message, feedback.error);
      else setStatus(error.message || "Could not check this account’s calendar connections.", true);
    }
  }
  async function run(provider, label, work) {
    if (busy || !providerNames[provider]) return;
    const stamp = generation, id = ++operation; statusSequence++; busy = true; feedback = null; renderProviders(); setStatus(label);
    try {
      const context = await session(stamp);
      if (!current(context) || operation !== id) return;
      const result = await work(context);
      if (!current(context) || operation !== id || !result) return;
      feedback = { message: result.message, error: !!result.error }; setStatus(feedback.message, feedback.error);
      if (result.toast) window.weekwiseCalendarBridge?.toast?.(result.toast);
    } catch (error) {
      if (stamp !== generation || operation !== id) return;
      feedback = { message: error.message || "Calendar operation could not be confirmed. Try again.", error: true }; setStatus(feedback.message, true);
    } finally {
      if (stamp === generation && operation === id) { busy = false; await refreshStatus(true); renderProviders(); }
    }
  }
  async function connect(provider) {
    return run(provider, "Preparing secure " + providerNames[provider] + " authorization…", async context => {
      const response = await invoke("connect", { provider }, context); if (!current(context) || !response) return;
      if (typeof response.authorizationUrl !== "string") throw new Error("The calendar service did not return an authorization link.");
      const url = new URL(response.authorizationUrl), allowed = provider === "google" ? url.hostname === "accounts.google.com" : url.hostname === "login.microsoftonline.com";
      if (url.protocol !== "https:" || !allowed || url.username || url.password) throw new Error("The calendar service returned an unexpected authorization link.");
      window.location.assign(url.href);
      return { message: "Continue in " + providerNames[provider] + " to approve calendar access." };
    });
  }
  async function sync(provider) {
    return run(provider, "Checking cloud data before syncing " + providerNames[provider] + "…", async context => {
      const bridge = window.weekwiseCalendarBridge;
      if (!bridge?.prepareSync || !bridge?.reloadAfterSync) throw new Error("Save and sync your Weekwise planner before calendar synchronization.");
      await bridge.prepareSync(); if (!current(context)) return;
      const response = await invoke("sync", { provider, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }, context);
      if (!current(context) || !response) return;
      await bridge.reloadAfterSync(); if (!current(context)) return;
      const conflicts = Array.isArray(response.conflicts) ? response.conflicts : [], count = name => Number.isSafeInteger(response[name]) && response[name] >= 0 ? response[name] : 0;
      const summary = count("imported") + " imported · " + count("exported") + " created in calendar · " + count("updatedInWeekwise") + " updated in Weekwise · " + count("updatedInCalendar") + " updated in calendar · " + conflicts.length + " conflicts";
      const details = conflicts.slice(0, 3).map(item => String(item.title || "Activity") + ": " + String(item.reason || "Review both copies")).join(" | ");
      return { message: providerNames[provider] + " sync finished: " + summary + (details ? ". " + details : "."), error: conflicts.length > 0, toast: conflicts.length ? "Calendar sync preserved conflicting copies. Review Calendar connections." : providerNames[provider] + " synced with Weekwise." };
    });
  }
  async function disconnect(provider) {
    if (busy || !providerNames[provider]) return;
    if (!window.confirm("Remove Weekwise’s stored " + providerNames[provider] + " connection and event links? Existing calendar events remain. Revoke provider consent separately in that account’s security settings.")) return;
    return run(provider, "Disconnecting " + providerNames[provider] + "…", async context => {
      const response = await invoke("disconnect", { provider }, context); if (!current(context) || !response) return;
      return { message: providerNames[provider] + " disconnected. Existing calendar events remain; provider consent can be revoked in that account’s settings.", toast: providerNames[provider] + " disconnected." };
    });
  }
  function handleOAuthReturn() {
    const url = new URL(window.location.href), status = url.searchParams.get("calendar_oauth_status"); if (!status) return false;
    const name = providerNames[url.searchParams.get("calendar_provider")] || "Calendar", reason = url.searchParams.get("calendar_reason");
    for (const key of ["calendar_oauth_status", "calendar_provider", "calendar_reason"]) url.searchParams.delete(key);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    const hints = { invalid_state: "The connection link was invalid. Start again.", invalid_or_expired_state: "The connection expired or was already used. Start again.", provider_cancelled: "Authorization was cancelled.", refresh_token_missing: "Offline access was not granted. Reconnect and approve calendar access.", server_setup: "The Weekwise owner needs to complete provider setup.", token_exchange_failed: "Authorization could not be completed. Reconnect or contact the Weekwise owner." };
    feedback = { message: status === "connected" ? name + " connected. Sync to import events and reconcile changes." : name + ": " + (hints[reason] || "The connection could not be completed."), error: status !== "connected" };
    pendingOAuthFeedback = feedback; setStatus(feedback.message, feedback.error); return true;
  }
  function init() {
    renderProviders();
    $("calendarConnectionsMenuBtn")?.addEventListener("click", () => { window.weekwiseCalendarBridge?.openPanel?.(); refreshStatus(); });
    $("calendarRefreshStatus")?.addEventListener("click", () => refreshStatus(false));
    for (const [id, action, provider] of [["connectGoogleCalendarBtn", connect, "google"], ["connectMicrosoftCalendarBtn", connect, "microsoft"], ["syncGoogleCalendarBtn", sync, "google"], ["syncMicrosoftCalendarBtn", sync, "microsoft"], ["disconnectGoogleCalendarBtn", disconnect, "google"], ["disconnectMicrosoftCalendarBtn", disconnect, "microsoft"]]) $(id)?.addEventListener("click", () => action(provider));
    client()?.auth?.onAuthStateChange?.((event, value) => {
      const returned = event === "INITIAL_SESSION" && value?.user?.id ? pendingOAuthFeedback : null;
      pendingOAuthFeedback = null; changed(value?.user?.id || null);
      if (returned) { feedback = returned; setStatus(returned.message, returned.error); }
      window.setTimeout(() => refreshStatus(), 0);
    });
    window.addEventListener("focus", () => refreshStatus()); handleOAuthReturn(); refreshStatus();
  }
  window.WeekwiseCalendarUI = Object.freeze({ refreshStatus, connect, sync, disconnect });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
