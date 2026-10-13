# Account erasure: source-ready, disabled by default

The `weekwise-account` Edge Function implements authenticated deletion of the caller's own password account. It is not deployed or enabled by this frontend release. The connected Supabase account cannot access Weekwise project `iajkzlsurghfvsmqkmut`; no real account or production records were deleted.

## Activation gate

Use a dedicated Weekwise staging project and synthetic password identities first. Confirm the project URL/ref, existing schema, backups and every foreign key into `auth.users`. Do not activate against a project containing unrelated applications: deleting an Auth identity can cascade into their tables too. Review Storage ownership and any additional user-data tables introduced outside this repository.

Run `supabase_verify_account_erasure.sql` read-only against that correct project. The core cloud table must exist with a validated `user_id -> auth.users.id ON DELETE CASCADE` foreign key. Every installed optional push/calendar table must satisfy the same condition. Missing optional tables are acceptable only when the corresponding service is unused. Inspect the second result for any other referring table and resolve its retention/deletion policy before enabling.

Server-only settings:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` supplied by the correct project. Never put the service-role key in Pages, browser code, screenshots or logs.
- `WEEKWISE_ALLOWED_ORIGIN=https://zubaerahmed13.github.io` for the current production site; a separate explicit origin for staging.
- `WEEKWISE_ACCOUNT_ERASURE_ENABLED=true` only after staging acceptance. Missing/false leaves POST disabled. Deploy the function with the repository's `verify_jwt=false` setting: the handler verifies the Bearer token with `auth.getUser()` itself before privileged operations.

The new function pins Supabase JS 2.117.3. CI type-checks it with Deno; existing push/calendar handlers are unchanged. Deployment and setting the activation flag require correct-project access and authorization; they are separate from the GitHub Pages client release.

## Guarantees and boundaries

The endpoint rejects client-supplied target IDs, untrusted browser origins, requests over 16 KiB, missing confirmation/backup acknowledgement, and failed password reauthentication. The fresh password session must identify the original verified caller. Global refresh-session revocation completes before hard deletion. An erasure failure never produces a confirmed deletion response. An isolate-local rate limit supplements Supabase Auth's password rate limits; it is not a distributed abuse-control guarantee.

Previously issued access JWTs can remain cryptographically valid until their configured expiry despite refresh revocation/deletion. Verified Auth-user lookups reject the deleted identity; correctly validated cascade foreign keys prevent recreating its cloud rows. Do not claim immediate invalidation of every access token or unverified production RLS. Hard deletion should cascade the planner/history, push subscription/delivery records, OAuth states/connections and event links defined in this repository. Actual production cascades remain unverified until staging acceptance.

The browser requires typed `DELETE MY WEEKWISE ACCOUNT`, current password, backup acknowledgement and final confirmation. It validates the response's captured owner, isolates the shared active planner to the independent local profile, stops delayed saves and removes only that account's named cache/focus/editor/onboarding/offline-owner keys. A delayed response for account A does not sign out newer account B. Passwords are cleared from the form and never persisted by the feature. Local storage removal rolls back if a removal fails.

Exported backups, shared recovery checkpoints, other browsers/devices, Google/Microsoft provider consent, and provider-hosted calendar events remain separate. Users must revoke external consent in provider settings. The UI states these boundaries; it does not advertise total device or provider erasure. Social/passkey-only accounts need a separately designed reauthentication flow before they can use this password endpoint.

## Staging acceptance

1. Seed synthetic A and B planners, optional push/calendar rows, A editor drafts, and an independent local planner. Export the test backup.
2. Verify wrong password, missing phrase, oversized JSON, stale/invalid token, cross-origin request and supplied target ID reject without deleting either account.
3. Delete A through the real browser. Verify A Auth identity and all installed owned rows are gone; B's rows and local planner remain byte-preserved.
4. Confirm A cannot refresh/sign in, and expired/old access tokens cannot recreate cloud rows. Check all RPC/RLS paths, not just the erasure endpoint.
5. Repeat account-switch-in-flight, network loss before/after confirmation, device quota failures, second-device cached copies and failed cascade/Storage ownership cases. A lost deletion response must say unconfirmed rather than automatically clearing local copies.
6. Verify endpoint disable/re-enable, exact allowed origin, deployed SDK/type checks and log redaction. Enable production only after documenting these results.

Automated Node and mocked browser tests cover the handler ordering and frontend isolation. They do not perform the production checks above.
