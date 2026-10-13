# Weekwise background reminders (Web Push)

This repository contains the service-worker Web Push implementation, separate from the existing reminder loop that runs only while the app is open. It is **not verified as live until you confirm the SQL migration, Edge Function secrets, and scheduler are configured in the target Supabase project and a closed-app delivery test succeeds**. The dispatcher is guarded by an application-level cron secret; only server-side secrets authorize dispatch.

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

The correct Weekwise project has the push tables, version 1 handler and a server-generated stable VAPID pair in Vault. Public-key readiness returns HTTP 200. The cron secret and project URL are provisioned without copying secret values into source. The scheduler is not installed: automatic approval review rejected enabling pg_net because direct database roles can read queued HTTP headers. See [INTEGRATION_ACTIVATION.md](INTEGRATION_ACTIVATION.md) for exact evidence and the reviewable next operation.

After explicit pg_net/pg_cron approval and the disposable-account cleanup check, run `supabase_push_cron_setup.sql` to install the minute scheduler using Vault lookups. Verify actual Cron history and the dispatch HTTP response before claiming scheduling works. Keep net outside Data API exposed schemas and trust all direct database LOGIN roles.

Then open Weekwise, sign in, choose Enable background reminders and allow notification permission. Create a test reminder at least two minutes ahead, Sync now, close the app and verify the notification. Also test disable/unsubscribe, permission refusal, expired subscription cleanup and separate test accounts. The server cannot grant device notification permission.

## Operational notes

- The dispatcher scans the latest synced Weekwise cloud row. Unsynced local changes on another device won't be visible to it; tap Sync now before testing a new reminder.
- Browser support varies. On iOS, Web Push normally requires a supported iOS/browser version and adding the web app to the Home Screen.
- The user must explicitly enable reminders and grant browser permission; the server cannot create subscriptions silently.
- If no notification arrives, check Supabase Cron job history, Edge Function logs, VAPID secret values, subscription permissions and the SQL setup. Failure diagnostics deliberately avoid logging push endpoints, keys, reminder titles or authorization values.
