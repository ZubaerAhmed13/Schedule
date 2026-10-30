(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const buttonId = "toggleBackgroundPushBtn";
  const statusId = "backgroundPushStatus";
  let busy = false;
  let refreshBusy = false;
  let statusEpoch = 0;

  function writeStatus(message, error = false) {
    const status = $(statusId);
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = error ? "error" : "";
  }

  function writeButton(text, disabled = false) {
    const button = $(buttonId);
    if (!button) return;
    button.textContent = text;
    button.disabled = disabled || busy;
  }

  function client() {
    return window.weekwiseCloudClient || null;
  }

  function bounded(operation) {
    let timer;
    return Promise.race([operation, new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error("The reminder service timed out. Check your connection and try again.")), 15000);
    })]).finally(() => window.clearTimeout(timer));
  }

  async function getSignedInSession() {
    const supabase = client();
    if (!supabase?.auth?.getSession) throw new Error("Weekwise cloud sign-in is unavailable. Reload the app while online.");
    const { data, error } = await bounded(supabase.auth.getSession());
    if (error) throw new Error("Could not verify the Weekwise session.");
    if (!data?.session?.user) throw new Error("Sign in to Weekwise before enabling background reminders.");
    return data.session;
  }

  async function invoke(action, payload = {}) {
    const supabase = client();
    if (!supabase?.functions?.invoke) {
      throw new Error("The Weekwise push service is not deployed yet. Complete the background-push setup first.");
    }
    const { data, error } = await bounded(supabase.functions.invoke("weekwise-push", {
      body: { action, ...payload }
    }));
    if (error) {
      let detail = error.message || "Background reminder request failed.";
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          if (body?.error) detail = String(body.error);
        }
      } catch (_) {}
      throw new Error(detail);
    }
    if (data?.error) throw new Error(String(data.error));
    return data || {};
  }

  function encodeApplicationServerKey(base64Url) {
    const normalized = String(base64Url).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const raw = atob(padded);
    return Uint8Array.from(raw, character => character.charCodeAt(0));
  }

  function currentTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch (_) { return "UTC"; }
  }

  async function getRegistration() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support background Web Push notifications.");
    }
    const registration = await bounded(navigator.serviceWorker.getRegistration("./"));
    if (!registration) throw new Error("Weekwise's service worker is not ready. Open the app online once, then reload.");
    if (!registration.pushManager) throw new Error("Background push is not available in this browser.");
    return registration;
  }

  async function readDeviceState(session) {
    const registration = await getRegistration();
    const subscription = await bounded(registration.pushManager.getSubscription());
    if (!subscription) return { registration, subscription: null, enabledForUser: false };
    const status = await invoke("status", { endpoint: subscription.endpoint });
    return {
      registration,
      subscription,
      enabledForUser: status.enabled === true
    };
  }

  async function refreshState() {
    if (refreshBusy || busy) return;
    refreshBusy = true;
    const epoch = ++statusEpoch;
    const current = () => epoch === statusEpoch;
    const setStatus = (...args) => { if (current()) writeStatus(...args); };
    const setButton = (...args) => { if (current()) writeButton(...args); };

    try {
      const supabase = client();
      if (!supabase?.auth?.getSession) {
        setButton("Background reminders unavailable", true);
        setStatus("The Weekwise cloud client is not available. Reload the app while online.", true);
        return;
      }

      const { data, error } = await bounded(supabase.auth.getSession());
      if (error || !data?.session?.user) {
        setButton("Sign in to enable", true);
        setStatus("Sign in to Weekwise before enabling background reminders.");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setButton("Not supported in this browser", true);
        setStatus("This browser does not support service-worker push notifications. Ordinary reminders still work while Weekwise is open.");
        return;
      }
      if (Notification.permission === "denied") {
        setButton("Notifications blocked", true);
        setStatus("Notifications are blocked for Weekwise. Change this site's notification permission in browser settings before enabling background reminders.", true);
        return;
      }

      const registration = await bounded(navigator.serviceWorker.getRegistration("./"));
      if (!registration?.pushManager) {
        setButton("Service worker not ready", true);
        setStatus("Open Weekwise online once and reload so its service worker can be installed.", true);
        return;
      }
      const subscription = await bounded(registration.pushManager.getSubscription());
      // Probe the authenticated backend even when no local subscription exists, so the
      // UI does not imply setup is ready when the Edge Function is still undeployed.
      let state;
      try {
        state = await invoke("status", { endpoint: subscription?.endpoint || "" });
      } catch (error) {
        setButton("Configure background reminders");
        setStatus(error.message || "Background push setup is not complete yet.", true);
        return;
      }

      if (!subscription) {
        setButton("Enable background reminders");
        setStatus("The push service is reachable. Enable this device to request reminders while Weekwise is closed. Delivery on this device is unverified.");
        return;
      }

      if (state.enabled === true) {
        setButton("Disable background reminders");
        setStatus("Background reminder subscription is enabled for this device (" + (state.timezone || currentTimeZone()) + "). Delivery with Weekwise closed is unverified on this device.");
      } else {
        setButton("Enable background reminders");
        setStatus("A browser subscription exists but is not linked to this Weekwise account yet. Enable it to link this device.");
      }
    } catch (error) {
      setButton("Configure background reminders");
      setStatus(error.message || "Could not check background reminder support.", true);
    } finally {
      if (current()) refreshBusy = false;
    }
  }

  async function toggleBackgroundPush() {
    if (busy) return;
    busy = true;
    const epoch = ++statusEpoch;
    const current = () => epoch === statusEpoch;
    const setStatus = (...args) => { if (current()) writeStatus(...args); };
    const setButton = (...args) => { if (current()) writeButton(...args); };

    setButton("Working…", true);
    let failure = null;
    try {
      await getSignedInSession();
      if (!current()) return;
      const registration = await getRegistration();
      if (!current()) return;
      const existing = await bounded(registration.pushManager.getSubscription());
      if (!current()) return;

      if (existing) {
        let state = { enabled: false };
        try { state = await invoke("status", { endpoint: existing.endpoint }); }
        catch (error) {
          // A local subscription is safe to keep; do not delete it when the server is unavailable.
          throw new Error("Could not verify the device subscription: " + (error.message || "push service unavailable"));
        }
        if (!current()) return;
        if (state.enabled === true) {
          await invoke("unsubscribe", { endpoint: existing.endpoint });
          await existing.unsubscribe();
          setStatus("Background reminders are disabled for this device.");
          return;
        }
        // A browser profile may still hold a subscription from a different Weekwise account.
        // The server enforces ownership; a cross-account endpoint cannot be transferred.
        await invoke("subscribe", { subscription: existing.toJSON(), timezone: currentTimeZone() });
        setStatus("Background reminder subscription is enabled for this device (" + currentTimeZone() + "). Delivery with Weekwise closed is unverified on this device.");
        return;
      }

      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error(permission === "denied"
            ? "Notifications were blocked. Allow notifications for Weekwise in browser settings and retry."
            : "Notification permission was not granted.");
        }
      }

      const { publicKey } = await invoke("public-key");
      if (!current()) return;
      if (!publicKey || typeof publicKey !== "string") throw new Error("The push service did not provide its public VAPID key.");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: encodeApplicationServerKey(publicKey)
      });

      if (!current()) { await subscription.unsubscribe(); return; }
      try {
        await invoke("subscribe", {
          subscription: subscription.toJSON(),
          timezone: currentTimeZone()
        });
      } catch (error) {
        try { await subscription.unsubscribe(); } catch (_) {}
        throw error;
      }
      setStatus("Background reminder subscription is enabled for this device (" + currentTimeZone() + "). Delivery with Weekwise closed is unverified on this device.");
    } catch (error) {
      failure = error.message || "Could not enable background reminders.";
    } finally {
      if (current()) { busy = false; await refreshState(); if (failure) writeStatus(failure, true); }
    }
  }

  function init() {
    const button = $(buttonId);
    if (!button) return;
    button.addEventListener("click", toggleBackgroundPush);
    const supabase = client();
    if (supabase?.auth?.onAuthStateChange) {
      supabase.auth.onAuthStateChange(() => {
        statusEpoch += 1; busy = false; refreshBusy = false;
        writeButton("Checking background reminders…", true);
        writeStatus("Checking the current account’s reminder settings…");
        window.setTimeout(() => { refreshState(); }, 0);
      });
    }
    window.addEventListener("focus", refreshState);
    refreshState();

    // The main application registers its service worker on the window "load" event.
    // Re-check after the registration becomes active; the earlier DOM-ready probe may
    // run before that registration exists and would otherwise leave the button disabled.
    const refreshAfterServiceWorkerReady = () => {
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.ready.then(() => refreshState()).catch(() => {});
    };
    if (document.readyState === "complete") refreshAfterServiceWorkerReady();
    else window.addEventListener("load", refreshAfterServiceWorkerReady, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
