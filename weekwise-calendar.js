(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const providerNames = {
    google: "Google Calendar",
    microsoft: "Microsoft Outlook"
  };
  let busy = false;
  let configured = { google: false, microsoft: false, encryption: false };

  function setStatus(message, error = false) {
    const status = $("calendarConnectionsStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = error ? "error" : "";
  }

  function client() {
    return window.weekwiseCloudClient || null;
  }

  function setDisabled(ids, disabled) {
    for (const id of ids) {
      const element = $(id);
      if (element) element.disabled = busy || disabled;
    }
  }

  function setProviderState(provider, row) {
    const isGoogle = provider === "google";
    const detail = $(isGoogle ? "googleCalendarConnectionDetail" : "microsoftCalendarConnectionDetail");
    const connect = $(isGoogle ? "connectGoogleCalendarBtn" : "connectMicrosoftCalendarBtn");
    const sync = $(isGoogle ? "syncGoogleCalendarBtn" : "syncMicrosoftCalendarBtn");
    const disconnect = $(isGoogle ? "disconnectGoogleCalendarBtn" : "disconnectMicrosoftCalendarBtn");
    const connected = !!row;
    const isConfigured = configured[provider] === true && configured.encryption === true;

    if (detail) {
      if (connected) {
        const email = row.provider_account_email ? " · " + row.provider_account_email : "";
        const when = row.connected_at ? " · connected " + new Date(row.connected_at).toLocaleDateString() : "";
        detail.textContent = "Connected" + email + when + ".";
      } else if (!isConfigured) {
        detail.textContent = "OAuth credentials or token-encryption setup are missing in Supabase.";
      } else {
        detail.textContent = "Not connected.";
      }
    }
    if (connect) {
      connect.textContent = connected ? "Reconnect" : (isGoogle ? "Connect Google Calendar" : "Connect Outlook");
      connect.disabled = busy || !isConfigured;
      connect.title = isConfigured ? "" : "Complete the calendar OAuth secret setup in Supabase first.";
    }
    if (sync) {
      sync.hidden = !connected;
      sync.disabled = busy || !connected || !isConfigured;
    }
    if (disconnect) {
      disconnect.hidden = !connected;
      disconnect.disabled = busy || !connected;
    }
  }

  async function invoke(action, payload = {}) {
    const supabase = client();
    if (!supabase?.functions?.invoke) {
      throw new Error("The Weekwise calendar service is not deployed yet. Complete the calendar setup first.");
    }
    const { data, error } = await supabase.functions.invoke("weekwise-calendar", {
      body: { action, ...payload }
    });
    if (error) {
      let message = error.message || "Calendar request failed.";
      let details = null;
      try {
        if (error.context && typeof error.context.json === "function") {
          details = await error.context.json();
          if (details?.error) message = String(details.error);
        }
      } catch (_) {}
      const wrapped = new Error(message);
      wrapped.details = details;
      throw wrapped;
    }
    if (data?.error) {
      const wrapped = new Error(String(data.error));
      wrapped.details = data;
      throw wrapped;
    }
    return data || {};
  }

  async function refreshStatus() {
    if (busy) return;
    const supabase = client();
    if (!supabase?.auth?.getSession) {
      setStatus("Weekwise cloud sign-in is unavailable. Reload the app while online.", true);
      setDisabled(["connectGoogleCalendarBtn", "connectMicrosoftCalendarBtn", "syncGoogleCalendarBtn", "syncMicrosoftCalendarBtn", "disconnectGoogleCalendarBtn", "disconnectMicrosoftCalendarBtn"], true);
      return;
    }
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.user) {
        configured = { google: false, microsoft: false, encryption: false };
        setProviderState("google", null);
        setProviderState("microsoft", null);
        setStatus("Sign in to Weekwise before connecting an external calendar.");
        return;
      }

      const status = await invoke("status");
      configured = {
        google: status.configured?.google === true,
        microsoft: status.configured?.microsoft === true,
        encryption: status.configured?.encryption === true
      };
      const google = status.providers?.google || null;
      const microsoft = status.providers?.microsoft || null;
      setProviderState("google", google);
      setProviderState("microsoft", microsoft);

      if (!configured.encryption) {
        setStatus("The calendar backend is reachable, but its token-encryption secret is missing or invalid. Ask the project administrator to finish the secure setup.", true);
      } else if (!configured.google && !configured.microsoft) {
        setStatus("The calendar backend is ready, but Google and Microsoft OAuth client credentials are not configured yet.", true);
      } else if (!google && !microsoft) {
        setStatus("No external calendar is connected yet. Connect a configured provider to begin.");
      } else {
        const connected = [google ? "Google Calendar" : "", microsoft ? "Microsoft Outlook" : ""].filter(Boolean).join(" and ");
        setStatus(connected + " connected. Sync uses the primary calendar and checks 30 days back through 90 days ahead.");
      }
    } catch (error) {
      setStatus(error.message || "Could not check calendar connection status.", true);
      setProviderState("google", null);
      setProviderState("microsoft", null);
    }
  }

  async function connect(provider) {
    if (busy) return;
    busy = true;
    setProviderButtonsDisabled(true);
    setStatus("Preparing secure " + providerNames[provider] + " authorization…");
    try {
      const response = await invoke("connect", { provider });
      if (!response.authorizationUrl || typeof response.authorizationUrl !== "string") {
        throw new Error("The calendar backend did not return an authorization URL.");
      }
      const url = new URL(response.authorizationUrl);
      const allowed = provider === "google"
        ? url.hostname === "accounts.google.com"
        : url.hostname === "login.microsoftonline.com";
      if (url.protocol !== "https:" || !allowed) throw new Error("The calendar backend returned an unexpected provider URL.");
      window.location.assign(url.href);
    } catch (error) {
      busy = false;
      setProviderButtonsDisabled(false);
      setStatus(error.message || "Could not start calendar authorization.", true);
      await refreshStatus();
    }
  }

  function setProviderButtonsDisabled(disabled) {
    for (const id of [
      "connectGoogleCalendarBtn", "connectMicrosoftCalendarBtn",
      "syncGoogleCalendarBtn", "syncMicrosoftCalendarBtn",
      "disconnectGoogleCalendarBtn", "disconnectMicrosoftCalendarBtn"
    ]) {
      const element = $(id);
      if (element) element.disabled = disabled || busy;
    }
  }

  async function sync(provider) {
    if (busy) return;
    busy = true;
    setProviderButtonsDisabled(true);
    setStatus("Checking cloud data before syncing " + providerNames[provider] + "…");
    try {
      const bridge = window.weekwiseCalendarBridge;
      if (!bridge?.prepareSync || !bridge?.reloadAfterSync) {
        throw new Error("Weekwise's safe cloud-sync bridge is unavailable. Reload the app and retry.");
      }
      await bridge.prepareSync();
      const response = await invoke("sync", {
        provider,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      });
      await bridge.reloadAfterSync();

      const conflicts = Array.isArray(response.conflicts) ? response.conflicts : [];
      const summary = [
        (response.imported || 0) + " imported",
        (response.exported || 0) + " created in calendar",
        (response.updatedInWeekwise || 0) + " updated in Weekwise",
        (response.updatedInCalendar || 0) + " updated in calendar",
        conflicts.length + " conflicts"
      ].join(" · ");
      setStatus(providerNames[provider] + " sync finished: " + summary + ". Range: " + (response.range?.from || "") + " to " + (response.range?.to || "") + ".");
      if (conflicts.length) {
        const headline = conflicts.slice(0, 3).map(item => item.title + ": " + item.reason).join(" | ");
        if (bridge.toast) bridge.toast("Calendar sync found " + conflicts.length + " conflict(s). Review Calendar connections for details.");
        const status = $("calendarConnectionsStatus");
        if (status) status.title = headline;
      } else if (bridge.toast) {
        bridge.toast(providerNames[provider] + " synced with Weekwise.");
      }
    } catch (error) {
      setStatus(error.message || "Calendar synchronization failed.", true);
      const details = error.details;
      if (details?.code === "revision_conflict" && window.weekwiseCalendarBridge?.toast) {
        window.weekwiseCalendarBridge.toast("Cloud data changed in another session. Sync Weekwise cloud and retry.");
      }
    } finally {
      busy = false;
      await refreshStatus();
      setProviderButtonsDisabled(false);
    }
  }

  async function disconnect(provider) {
    if (busy) return;
    const confirmText = "Remove Weekwise's stored " + providerNames[provider] + " connection and event links? Existing events in the external calendar will not be deleted. Provider consent must be revoked separately in that account's security settings.";
    if (!window.confirm(confirmText)) return;
    busy = true;
    setProviderButtonsDisabled(true);
    setStatus("Disconnecting " + providerNames[provider] + "…");
    try {
      await invoke("disconnect", { provider });
      if (window.weekwiseCalendarBridge?.toast) window.weekwiseCalendarBridge.toast(providerNames[provider] + " disconnected from Weekwise.");
      setStatus(providerNames[provider] + " disconnected from Weekwise. Events in the provider calendar remain untouched.");
    } catch (error) {
      setStatus(error.message || "Could not disconnect the calendar.", true);
    } finally {
      busy = false;
      await refreshStatus();
      setProviderButtonsDisabled(false);
    }
  }

  function handleOAuthReturn() {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("calendar_oauth_status");
    if (!status) return;
    const provider = url.searchParams.get("calendar_provider");
    const reason = url.searchParams.get("calendar_reason");
    for (const key of ["calendar_oauth_status", "calendar_provider", "calendar_reason"]) url.searchParams.delete(key);
    history.replaceState(null, "", url.pathname + url.search + url.hash);

    const name = providerNames[provider] || "Calendar";
    if (status === "connected") {
      setStatus(name + " connected. Sync to import new events and reconcile changes.");
      if (window.weekwiseCalendarBridge?.toast) window.weekwiseCalendarBridge.toast(name + " connected.");
    } else {
      const hints = {
        invalid_state: "The OAuth state was missing or invalid.",
        invalid_or_expired_state: "The OAuth session expired or was already used. Start the connection again.",
        provider_cancelled: "Authorization was cancelled.",
        refresh_token_missing: "The provider did not return a refresh token. Reconnect and grant offline access.",
        server_setup: "Calendar backend setup is incomplete. Check the Edge Function logs and database migration.",
        token_exchange_failed: "The provider token exchange failed. Verify the client secret and exact callback URL."
      };
      const message = hints[reason] || "The calendar connection could not be completed.";
      setStatus(name + ": " + message, true);
      if (window.weekwiseCalendarBridge?.toast) window.weekwiseCalendarBridge.toast(name + " connection failed. Check Calendar connections.");
    }
  }

  function init() {
    $("calendarConnectionsMenuBtn")?.addEventListener("click", () => {
      openUtilityPanel("calendarConnectionsPanel", "Calendar connections");
      refreshStatus();
    });
    $("connectGoogleCalendarBtn")?.addEventListener("click", () => connect("google"));
    $("connectMicrosoftCalendarBtn")?.addEventListener("click", () => connect("microsoft"));
    $("syncGoogleCalendarBtn")?.addEventListener("click", () => sync("google"));
    $("syncMicrosoftCalendarBtn")?.addEventListener("click", () => sync("microsoft"));
    $("disconnectGoogleCalendarBtn")?.addEventListener("click", () => disconnect("google"));
    $("disconnectMicrosoftCalendarBtn")?.addEventListener("click", () => disconnect("microsoft"));

    const supabase = client();
    if (supabase?.auth?.onAuthStateChange) {
      supabase.auth.onAuthStateChange(() => window.setTimeout(() => refreshStatus(), 0));
    }
    window.addEventListener("focus", refreshStatus);
    handleOAuthReturn();
    refreshStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
