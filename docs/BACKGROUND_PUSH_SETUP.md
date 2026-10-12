# Weekwise background reminders (Web Push)

This repository contains the service-worker Web Push implementation, separate from the existing reminder loop that runs only while the app is open. It is **not verified as live until you confirm the SQL migration, Edge Function secrets, and scheduler are configured in the target Supabase project and a closed-app delivery test succeeds**. The dispatcher is guarded by an application-level cron secret; only server-side secrets authorize dispatch.

## What it adds

- A signed-in user can register this browser's Push API subscription to their current Weekwise account.
- Subscription records and delivery deduplication live in tables that browser clients cannot read or modify directly. Only the server-side Edge Function role has database access.
- The scheduled dispatcher loads each user's existing Weekwise cloud snapshot, checks up to five reminder timestamps per task, and sends due reminders to active devices.
- Naive datetime-local reminder timestamps are interpreted in the IANA time zone captured when the user enables background reminders. Re-enable on a device after changing time zones.
- Reminders older than 24 hours are skipped to prevent a burst of very stale notifications.
- HTTP 404/410 subscriptions are removed. A database claim function prevents concurrent cron runs from sending the same reminder twice.
- The service worker handles push events and notification clicks. The OS notification tag matches the in-app reminder tag, so a duplicate surfaced after reopening should replace the existing tray item instead of stacking another.
- Push endpoints are restricted to known browser push-service hostnames to reduce the risk of server-side requests to arbitrary URLs.

This is reminder delivery only. It does not implement Google Calendar or Microsoft Outlook synchronization.

## Deployment sequence

1. Export a Weekwise JSON backup before testing. This setup does not seed, clear, or overwrite task data.
2. In the target Supabase project's SQL Editor, run the repository file named supabase_push_setup.sql.
3. From a trusted local terminal authenticated to the intended Supabase project, deploy the Edge Function:

   supabase functions deploy weekwise-push --project-ref YOUR_PROJECT_REF

4. Generate a fresh VAPID key pair locally:

   npx web-push generate-vapid-keys

   Keep the private key out of source control and out of this conversation.
5. Configure Edge Function secrets in the correct Supabase project. Use a long random dispatcher secret generated locally (for example, openssl rand -hex 32):

   supabase secrets set VAPID_PUBLIC_KEY="PUBLIC_KEY" VAPID_PRIVATE_KEY="PRIVATE_KEY" VAPID_SUBJECT="mailto:YOUR_MONITORED_CONTACT" WEEKWISE_PUSH_CRON_SECRET="LONG_RANDOM_SECRET" WEEKWISE_ALLOWED_ORIGIN="https://zubaerahmed13.github.io" --project-ref YOUR_PROJECT_REF

   Supabase normally injects SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY into the Edge Function runtime. Confirm they exist in the runtime configuration. Never copy a service-role key into Weekwise HTML, JavaScript, or this repository.
6. In Supabase Dashboard → Vault, create two secrets:
   - Name weekwise_project_url, value the project's https://PROJECT_REF.supabase.co URL.
   - Name weekwise_push_cron_secret, value exactly the same LONG_RANDOM_SECRET used for WEEKWISE_PUSH_CRON_SECRET in the Edge Function.
7. In SQL Editor, run supabase_push_cron_setup.sql. The cron runs every minute and reads the dispatcher secret from Vault; the secret is not embedded literally in the scheduled SQL definition.
8. Open the newly deployed Weekwise app, sign in, and navigate to Work day & weekly settings. Click Enable background reminders and allow notification permission.
9. For an end-to-end test, create a test task with a reminder at least two minutes in the future, tap Sync now under Cloud sync, close the Weekwise tab/app, and wait for the notification. Also test disable/unsubscribe, permission denied, expired subscription cleanup, and two distinct test accounts. Use a test account, not a sensitive reminder.

## Operational notes

- The dispatcher scans the latest synced Weekwise cloud row. Unsynced local changes on another device won't be visible to it; tap Sync now before testing a new reminder.
- Browser support varies. On iOS, Web Push normally requires a supported iOS/browser version and adding the web app to the Home Screen.
- The user must explicitly enable reminders and grant browser permission; the server cannot create subscriptions silently.
- If no notification arrives, check Supabase Cron job history, Edge Function logs, VAPID secret values, subscription permissions and the SQL setup. Failure diagnostics deliberately avoid logging push endpoints, keys, reminder titles or authorization values.
