# Weekwise integration readiness and production verification

This document separates code that exists from services that must be configured in external dashboards. Passing the repository's Node tests does **not** prove a production Supabase project, OAuth provider, or push delivery is working.

## Current verified scope

- The public app is hosted at https://zubaerahmed13.github.io/Schedule/.
- The app uses Supabase Auth and calls `public.weekwise_save(jsonb,bigint)` for revision-aware cloud saves.
- The app supports local/offline planning and JSON backup. The repository now contains Google Calendar/Microsoft Outlook OAuth and conflict-aware event-sync code, but live calendar connection is not activated until the migration, provider credentials, encryption secret and Edge Function are deployed.
- The current live configuration has browser notifications while Weekwise is running. The repository now contains a Web Push service worker, client control, protected subscription/delivery SQL, Edge Function and scheduler setup, but these are **not live until the optional backend setup and a closed-app delivery test succeed**.
- Google/Microsoft calendar OAuth is still not implemented; enabling a Supabase sign-in provider would not provide Calendar/Graph access or a secure calendar sync flow. Do not advertise calendar integration until a provider round-trip is proven.

## 1. Verify Supabase schema safely

1. Open the Supabase project configured in `index.html`.
2. In **SQL Editor**, run `weekwise_supabase_setup.sql`.
3. If account creation must be invite-only, run `supabase_invite_code_setup.sql` too.
4. Run `supabase_verify_setup.sql` and inspect every row. Resolve each `FAIL`; investigate `NOT CONFIGURED` based on whether invite-only signup is intended.
5. This diagnostic is read-only and does not prove credentials, redirects, email delivery, or client-side sync. It never selects planner rows or displays invite hashes.

### Important: invite trigger

The application sends the submitted invite code in auth user metadata. A database trigger is the enforcement boundary; client-side validation alone is not security. Test signup with (a) missing code, (b) invalid code, and (c) valid code using a controlled test account. Only the valid code should create an account. Do not paste a service-role key into the repository or browser.

## 2A. Check the live Supabase Auth service

A read-only GitHub Actions workflow, **Weekwise Supabase live diagnostics**, runs on pushes to `main` and can be started manually from **Actions → Weekwise Supabase live diagnostics → Run workflow**. It reads only the public project URL and publishable client key already used by the app, then checks the public Auth health/settings endpoints and reports whether Email, Google, and Microsoft/Azure providers are flagged as enabled.

This is a live backend probe, but it is deliberately limited:

- It does not prove a valid OAuth client secret, redirect URI, provider consent, or a complete login round trip.
- Provider flags are for Supabase sign-in providers. They do not grant calendar access to Google Calendar or Microsoft Graph.
- It does not test the database schema/RLS; use the read-only SQL diagnostic above in the Supabase SQL Editor for that.
- It does not create accounts, send test emails, change settings, or touch user planner data.

## 2. Configure and verify Supabase Auth

In **Authentication → URL Configuration**:

- Site URL: `https://zubaerahmed13.github.io/Schedule/`
- Redirect URL: `https://zubaerahmed13.github.io/Schedule/**`

Choose the email-confirmation policy deliberately. Then perform a real registration/sign-in/sign-out/password-recovery test using a test account and the published site. Confirm the email's link returns to the published app. A SQL schema check cannot validate these flows.

## 3. Calendar OAuth: code ready, provider setup required

The repository now includes the calendar connection UI, server-side PKCE OAuth callback, encrypted access/refresh-token storage, Google Calendar and Microsoft Graph handlers, per-event links, a revision-checked cloud-save RPC, and sync conflict detection. Live connection is not verified yet because provider app registrations/client secrets and the Supabase migration have not been configured from this environment.

Follow docs/CALENDAR_OAUTH_SETUP.md. The remaining production steps are:

1. Run supabase_calendar_setup.sql in the intended Supabase project.
2. Register a Google OAuth web client and/or Microsoft Entra app and set the exact Supabase Edge Function callback URI.
3. Store both provider client IDs/secrets and a stable 32-byte AES encryption key in Supabase Edge Function secrets.
4. Deploy the weekwise-calendar Edge Function.
5. Connect a dedicated test account and verify a Weekwise→provider create/update, a provider→Weekwise update/import, a simultaneous-edit conflict, deletion handling and token refresh.

The live Auth workflow previously found Google and Microsoft/Azure Supabase sign-in providers disabled. Those are separate from the calendar OAuth clients described here; toggling a Supabase sign-in provider alone does not grant Calendar/Graph access. Do not mark calendar sync live until the external setup and round-trip tests pass.

## 4. Background push: code ready, external activation required

The repository includes the service-worker `push` and notification-click handlers, opt-in browser control, authenticated `weekwise-push` Edge Function, server-only subscription and delivery tables, an atomic deduplication claim, timezone conversion, stale-subscription cleanup, and an optional one-minute Cron setup. The UI does not report background reminders enabled until the current device subscription is registered with the signed-in account.

It is **not yet verified as live** because the production Supabase database has not been migrated, VAPID/private dispatcher secrets are not configured from this environment, and the Cron job has not been installed. Follow [docs/BACKGROUND_PUSH_SETUP.md](BACKGROUND_PUSH_SETUP.md), then test a future reminder with the app closed. The service worker caching the app shell alone never proved push delivery.

The dispatcher only reads the latest synced cloud snapshot, skips reminders more than 24 hours late, rejects untrusted push endpoint hostnames, and keeps subscription/delivery records unavailable to browser roles. This still needs real delivery tests with the app closed and with revoked/expired subscriptions and timezone changes.

## 5. Release checklist

- [ ] Latest `main` commit has successful release-check workflow.
- [ ] Latest Pages deployment workflow succeeded for that same commit.
- [ ] Published app serves the expected commit and opens on mobile.
- [ ] Supabase diagnostic SQL reports expected statuses.
- [ ] Signup policy, email confirmation, redirect and password recovery tested with test accounts.
- [ ] Local-only use and JSON backup/restore tested before any account migration.
- [ ] Two-device cloud sync tested in both directions, including offline edits and revision conflicts.
- [ ] Calendar OAuth secrets and SQL migration configured; Google/Outlook round-trip tests passed.
- [ ] Web Push secrets, SQL migration and scheduler configured; closed-app delivery tests passed.
- [ ] No service-role key, OAuth client secret, or VAPID private key appears in public repository files.

## Data safety

Before testing account switching, restore, or conflict resolution, export a JSON backup. Keep the planner empty by default: do not seed sample tasks or overwrite an existing local/cloud store during verification.
