# Account erasure: deployed, activation pending

The password-account endpoint is deployed in the correct Weekwise project and reports `configured=false`. Existing users were not deleted. [INTEGRATION_ACTIVATION.md](INTEGRATION_ACTIVATION.md) records the actual results and automatic approval blocker.

## Activation gate

All six Weekwise owner-cascade tables are installed. The private server flag starts false and can be enabled only after reviewing every Auth-dependent table and completing the disposable-identity check. The one-time harness source authenticates an operator secret generated in Vault, claims a single private flag, creates only fresh disposable identities, tests rejection/cascades/other-account preservation/session revocation, and cleans its own identities. It contains no real-user target IDs. The deployed harness currently returns 410.

Supabase injects `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`. The endpoint reads `WEEKWISE_ACCOUNT_ERASURE_ENABLED` from its environment or the service-only runtime RPC/private flag. An explicit environment false wins. Origin defaults to `https://zubaerahmed13.github.io`. Custom bearer/password authentication is implemented in the handler with `verify_jwt=false`; SDK 2.117.3 is pinned. Never put service credentials in the client.

## Guarantees and boundaries

The endpoint rejects client-supplied target IDs, untrusted browser origins, requests over 16 KiB, missing confirmation/backup acknowledgement, and failed password reauthentication. The fresh password session must identify the original verified caller. Global refresh-session revocation completes before hard deletion. An erasure failure never produces a confirmed deletion response. An isolate-local rate limit supplements Supabase Auth's password rate limits; it is not a distributed abuse-control guarantee.

Previously issued access JWTs can remain cryptographically valid until their configured expiry despite refresh revocation/deletion. Verified Auth-user lookups reject the deleted identity; correctly validated cascade foreign keys prevent recreating its cloud rows. Do not claim immediate invalidation of every access token or unverified production RLS. Hard deletion should cascade the planner/history, push subscription/delivery records, OAuth states/connections and event links defined in this repository. Actual production cascades remain unverified until the disposable-identity activation check succeeds.

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
