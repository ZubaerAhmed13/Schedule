# Weekwise Google Calendar and Microsoft Outlook integration

The calendar handler and server-only tables are deployed in Weekwise. Its health check confirms encryption is configured, but Google and Microsoft credentials are absent, so provider connections remain unavailable. See [INTEGRATION_ACTIVATION.md](INTEGRATION_ACTIVATION.md). The live Supabase Auth probe previously reported Google/Azure sign-in providers as disabled; these calendar connections use a separate OAuth flow and do not depend on Supabase social sign-in.

## What is implemented in the repository

- OAuth authorization-code flow with PKCE (S256), random state stored only as a hash, ten-minute expiry, and one-time state consumption.
- Google Calendar and Microsoft Graph calendar authorization handled by a Supabase Edge Function. Client secrets and refresh tokens never enter the static HTML or browser JavaScript.
- Access and refresh tokens are encrypted with AES-256-GCM using a server-only environment or Vault key.
- Per-user connection records and event mapping tables are protected from browser roles by RLS and explicit privilege revocation.
- Sync covers 30 days in the past through 90 days ahead on the provider's primary calendar.
- New provider events can be imported into Weekwise, and Weekwise scheduled/all-day tasks can be created or updated in the connected provider calendar. Per-event mapping plus provider metadata helps avoid duplicates after retries.
- A revision-checked SQL function rejects cloud snapshot writes if another device changed Weekwise data during sync.
- If Weekwise and the provider both changed an event, or a linked event was deleted, the sync reports a conflict instead of silently choosing a version.
- Microsoft sync has an explicit IANA-to-Windows timezone mapping for common time zones; it refuses unknown mappings rather than silently guessing.

## 1. Back up first

In Weekwise, choose More → Export backup. Use test accounts and test calendar events while validating OAuth and synchronization. The calendar code does not seed a sample planner or intentionally delete external events.

## 2. Apply the database migration

In the intended Supabase project, open SQL Editor and run supabase_calendar_setup.sql.

The script creates the server-only OAuth transaction, encrypted connection and event-link tables, plus two privileged RPCs. They require the Edge Function to use the service-role credential on the server. Browser roles are explicitly denied access.

After applying it, run supabase_verify_setup.sql as a read-only check of the cloud table/RLS and current optional features. The existing cloud-sync migration (weekwise_supabase_setup.sql) must also already be installed.

## 3. Register Google Calendar OAuth

1. In Google Cloud Console, create or choose a project and enable the Google Calendar API.
2. Configure the OAuth consent screen with the correct app identity and test-user policy.
3. Create an OAuth client whose application type is Web application.
4. Add this exact Authorized redirect URI:

   https://iajkzlsurghfvsmqkmut.supabase.co/functions/v1/weekwise-calendar

5. Copy the client ID and client secret to the secure Supabase secrets step below. Do not put them into GitHub source files or Weekwise's browser code.

The requested delegated scope is https://www.googleapis.com/auth/calendar.events plus userinfo.email; the application uses the user's primary calendar.

## 4. Register Microsoft Outlook OAuth

1. In Microsoft Entra admin center, create an App registration.
2. Choose the account types appropriate for your users. The default tenant path is common; restrict MICROSOFT_CALENDAR_TENANT if your organization requires a tenant-specific setup.
3. Add a Web redirect URI exactly matching:

   https://iajkzlsurghfvsmqkmut.supabase.co/functions/v1/weekwise-calendar

4. Create a client secret, record its value securely, and configure delegated permissions User.Read and Calendars.ReadWrite. offline_access is requested in the OAuth scope for refresh tokens.
5. Follow any administrator-consent policies required by your tenant.

Outlook's API represents time zones using Windows time-zone identifiers. The code maps common IANA time zones (including Europe/Berlin, Europe/London and major North American/Asian zones); it returns an explicit error for an unmapped Microsoft time zone rather than guessing dates.

## 5. Enter provider credentials securely

The stable `WEEKWISE_CALENDAR_ENCRYPTION_KEY` is already generated inside Supabase Vault. Preserve it. In the [correct project's Vault](https://supabase.com/dashboard/project/iajkzlsurghfvsmqkmut/integrations/vault/overview), add secrets with these exact names and the values issued by the provider registrations above:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_CLIENT_ID`
- `MICROSOFT_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_TENANT` (optional; defaults to `common`)

Configure either provider independently. Do not paste secret values into chat or commit them. The deployed server reads these through its service-only runtime configuration RPC; environment settings take precedence. Health returns only readiness booleans.

## 6. Deploy the Edge Function

From the repository root, with the Supabase CLI linked/authenticated to the right project:

    supabase functions deploy weekwise-calendar --project-ref YOUR_PROJECT_REF

The function callback is configured with verify_jwt = false because the provider redirects back without a Supabase user session. It still authenticates every browser POST by validating the user's bearer session with Supabase Auth; its OAuth callback accepts only a short-lived, one-use state created for an authenticated Weekwise user.

## 7. End-to-end verification

1. Open the published Weekwise app and sign in to the existing Weekwise account.
2. Open More → Calendar connections. A provider should show as connectable only after its OAuth credentials and encryption key are configured.
3. Connect a dedicated test Google Calendar or Outlook account and approve the requested access.
4. Add a scheduled Weekwise activity at least five minutes in the future, press Sync now for that provider, and confirm exactly one event appears in the provider's primary calendar.
5. Edit that event in Weekwise and sync again; confirm it updates rather than duplicating. Then edit it in the provider and sync again; confirm Weekwise updates it.
6. Change both copies separately before syncing. Weekwise should report a conflict without silently overwriting either side. Test provider-side deletion similarly.
7. Verify token refresh after the access token expires, disconnect and reconnect, all-day events, DST/time-zone boundaries, and two separate Weekwise users.
8. Confirm an unconfigured/missing provider client secret produces a clear setup error, not a false connected state.

## Limits and safety notes

- Calendar sync uses the connected account's primary calendar, not every calendar in the provider account.
- It covers a rolling 120-day window (30 days backward, 90 days forward). Tasks that are unscheduled or placed in the Inbox are not exported as timed calendar events.
- Provider events deleted outside Weekwise are surfaced as conflicts instead of being silently recreated/deleted.
- Two simultaneous edits are intentionally surfaced as conflicts. The user decides how to resolve them; there is no automatic field-level merge.
- Disconnect removes Weekwise's stored encrypted credentials and event-link records. For full provider-consent revocation, remove Weekwise from the account's security/connected-app settings.
- .ics import/export continues to work separately; it does not establish an OAuth connection.
- Provider synchronization is not verified until the external credentials/consent and real round-trip tests above pass. SQL and server deployment are complete.
