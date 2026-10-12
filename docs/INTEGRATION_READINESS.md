# Weekwise integration readiness and production verification

This document separates code that exists from services that must be configured in external dashboards. Passing the repository's Node tests does **not** prove a production Supabase project, OAuth provider, or push delivery is working.

## Current verified scope

- The public app is hosted at https://zubaerahmed13.github.io/Schedule/.
- The app uses Supabase Auth and calls `public.weekwise_save(jsonb,bigint)` for revision-aware cloud saves.
- The app supports local/offline planning and JSON backup. Calendar transfer is through `.ics` import/export, not live two-way calendar sync.
- Current task notifications are browser notifications while Weekwise is running. The service worker caches the app shell; it does **not** by itself implement Web Push.
- Google/Microsoft calendar OAuth and server-delivered background push are not implemented merely by configuring Supabase Auth. Do not advertise either as available until an end-to-end test passes.

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

## 3. OAuth status and requirements

There is currently no verified Google or Microsoft calendar OAuth flow in the app. Enabling a provider in Supabase Auth alone would authenticate users; it would not create a Google Calendar or Microsoft Graph integration.

A complete calendar integration requires:
1. A user-facing **Connect calendar** flow and provider-specific scopes.
2. Google Cloud OAuth consent screen/client and authorized redirect URI, or a Microsoft Entra app registration and redirect URI.
3. OAuth callback/state validation and secure token handling. Refresh tokens must stay server-side; never commit them or expose client secrets in `index.html`.
4. Backend endpoints/Edge Functions to exchange/refresh tokens and read/write events with least-privilege scopes.
5. Clear disconnect/revoke handling, error recovery, duplicate prevention, time-zone handling, and conflict resolution.
6. A real end-to-end test against a dedicated test calendar/tenant, including create/update/delete and expired-token cases.

Do not mark calendar OAuth as complete until a test event can be created and then observed in both systems, and edits/deletes are correctly synchronized according to the product's documented directionality.

## 4. Background push status and requirements

The current reminder loop runs in the page. Browser notifications may appear while the app is running, but this is not reliable background delivery when the tab/browser is closed.

Real Web Push requires:
1. A service worker `push` event handler and notification-click handler.
2. User permission plus subscription creation via `PushManager.subscribe()`.
3. VAPID public/private keys; the private key must be stored only in backend secrets.
4. A secure subscription registry associated with the authenticated user, with RLS and a delete/unsubscribe path.
5. A scheduled backend job/Edge Function to find due reminders and send Web Push messages, including expired-subscription cleanup and retries.
6. End-to-end tests on supported desktop and mobile browsers with the app closed, permission denied, subscription revoked, and time-zone/DST boundaries.

A service-worker fetch/cache handler is not proof of push support. Do not store VAPID private keys or service-role credentials in the static app.

## 5. Release checklist

- [ ] Latest `main` commit has successful release-check workflow.
- [ ] Latest Pages deployment workflow succeeded for that same commit.
- [ ] Published app serves the expected commit and opens on mobile.
- [ ] Supabase diagnostic SQL reports expected statuses.
- [ ] Signup policy, email confirmation, redirect and password recovery tested with test accounts.
- [ ] Local-only use and JSON backup/restore tested before any account migration.
- [ ] Two-device cloud sync tested in both directions, including offline edits and revision conflicts.
- [ ] Google/Microsoft OAuth only marked complete after provider-specific round-trip tests.
- [ ] Web Push only marked complete after closed-app delivery tests.
- [ ] No service-role key, OAuth client secret, or VAPID private key appears in public repository files.

## Data safety

Before testing account switching, restore, or conflict resolution, export a JSON backup. Keep the planner empty by default: do not seed sample tasks or overwrite an existing local/cloud store during verification.
