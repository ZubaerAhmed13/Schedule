# Weekwise background reminders (Web Push)

> Current verified state and remaining limits: [CURRENT_STATUS.md](CURRENT_STATUS.md) and [LIVE_BACKEND_ACCEPTANCE.md](LIVE_BACKEND_ACCEPTANCE.md). Earlier phase wording below is historical; erasure/invitations/push scheduling are active, Google/Outlook are deferred.
The server, stable VAPID keys, server-only tables and one-minute scheduler are active in Weekwise. Two scheduled calls returned HTTP 200 with successful dispatch and no failures. No devices are subscribed yet; actual notification delivery with the app closed still needs a device test. Dispatch is authorized by a server-only Vault secret.

## What it adds

- A signed-in user can register this browser's Push API subscription to their current Weekwise account.
- Subscription records and delivery deduplication live in tables that browser clients cannot read or modify directly. Only the server-side Edge Function role has database access.
- The scheduled dispatcher loads each user's existing Weekwise cloud snapshot, checks up to five reminder timestamps per task, and sends due reminders to active devices.
- Naive datetime-local reminders use the saved planner IANA zone. Only legacy snapshots without a saved zone fall back to the subscription zone. Invalid zones/dates and ambiguous or nonexistent DST times are skipped; explicit-offset instants retain their meaning.
- Reminders older than 24 hours are skipped to prevent a burst of very stale notifications.
- HTTP 404/410 subscriptions are removed. A database claim function prevents concurrent cron runs from sending the same reminder twice.
- The service worker handles push events and notification clicks. The OS notification tag matches the in-app reminder tag, so a duplicate surfaced after reopening should replace the existing tray item instead of stacking another.
- Push endpoints are restricted to known browser push-service hostnames to reduce the risk of server-side requests to arbitrary URLs.

This is reminder delivery only. It does not implement Google Calendar or Microsoft Outlook synchronization.

## Current deployment and remaining setup

The correct Weekwise project has the push tables, version 1 handler and a server-generated stable VAPID pair in Vault. Public-key readiness returns HTTP 200. The cron secret and project URL are provisioned without copying secret values into source. The user explicitly approved pg_net/pg_cron and migration `20261013151217` installed one active minute job. See [INTEGRATION_ACTIVATION.md](INTEGRATION_ACTIVATION.md) for exact evidence and the reviewable next operation.

The first two actual scheduled dispatch responses passed. Do not re-run `supabase_push_cron_setup.sql` casually; it replaces only the named job, but existing configuration should be reviewed first. Keep net outside Data API exposed schemas and trust all direct database LOGIN roles; they can read queued headers. The queue is not isolated from those trusted roles.

Then open Weekwise, sign in, choose Enable background reminders and allow notification permission. Create a test reminder at least two minutes ahead, Sync now, close the app and verify the notification. Also test disable/unsubscribe, permission refusal, expired subscription cleanup and separate test accounts. The server cannot grant device notification permission.

## Operational notes

- The dispatcher scans the latest synced Weekwise cloud row. Unsynced local changes on another device won't be visible to it; tap Sync now before testing a new reminder.
- Browser support varies. On iOS, Web Push normally requires a supported iOS/browser version and adding the web app to the Home Screen.
- The user must explicitly enable reminders and grant browser permission; the server cannot create subscriptions silently.
- If no notification arrives, check Supabase Cron job history, Edge Function logs, VAPID secret values, subscription permissions and the SQL setup. Failure diagnostics deliberately avoid logging push endpoints, keys, reminder titles or authorization values.
