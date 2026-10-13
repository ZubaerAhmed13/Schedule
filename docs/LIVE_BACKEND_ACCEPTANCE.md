# Live backend acceptance

The user requested completion of non-calendar setup; Google and Outlook are deferred. This reviewed candidate adds missing server invitation enforcement and an atomic push-registration ownership check. Apply only to Weekwise project `iajkzlsurghfvsmqkmut` after PostgreSQL and Deno checks pass. Existing users and all six Weekwise tables must match aggregate fingerprints before/after migration in the same transaction. The code does not rewrite existing planner data.

Invitations are verified against private SHA-256 hashes, with atomic use limits, expiry and revocation. User metadata carries an untrusted submitted code, never a role/owner decision. The existing privately distributed code's checked-in hash remains valid. A separate 64-character invitation is generated inside Vault as `weekwise_owner_invite_code`; the owner can read/share it privately through the Supabase Dashboard. Reapplying preserves keys, disabled invitations and counters. The browser cannot read invitations or create check invitations. The trigger applies to new Auth inserts, including admin-created accounts; existing sign-in and password recovery do not require a new invitation.

Push registration uses a service-only conditional upsert. A known endpoint cannot be reassigned to a different account, including two simultaneous registrations. Same-owner updates remain supported; opt-out filters both endpoint and authenticated owner. Endpoint possession alone is not an ownership grant.

`weekwise-backend-check` is a temporary acceptance harness. It requires a 60-second HMAC operator proof and a one-use private flag. It creates two confirmed accounts at the reserved `example.com` domain; no email is sent. It tests missing/wrong/revoked/expired/exhausted invitations; real SDK sign-in; own/cross-account/anonymous reads; direct-write denial; first save, competing revisions, stale-save recovery and fresh-device reload; push registration, cross-owner attempts, duplicate claims and opt-out; refresh/session revocation; generated recovery-token verification, password change and replay refusal; and erasure after recovery. Cloud payloads are empty synthetic planners, so active cron never sends a fixture reminder. Tokens, passwords and codes stay inside Edge; only bounded boolean checks are returned/recorded. Cleanup selects only newly created IDs and a unique test-invitation group. Existing users/planners are not writable fixtures.

Use the reviewed SQL challenge from `supabase/operations/weekwise-activation-check-request.sql`, POST to `weekwise-backend-check` within 60 seconds, inspect boolean receipts, and immediately retire this endpoint to HTTP 410. `account_erasure_enabled` is not toggled by this cloud/recovery check. A failure does not authorize deleting another account or weakening RLS.

These are live backend fixtures, not a real physical two-device test, real notification-provider delivery, mail delivery or a test of waiting for a signed access token to expire. Supabase access tokens can remain valid until their expiry after sign-out; refresh revocation is checked separately. Existing automated browser expiry/offline/reconnect tests remain complementary evidence. Do not change production JWT lifetime or authentication configuration merely to accelerate a test. Legal accessibility/privacy certification and physical device evidence remain separate acceptance work.

## Actual production results — 13 October 2026

Applied only through WeekWise / `iajkzlsurghfvsmqkmut`:

| Migration | Applied ID |
|---|---|
| Atomic push owner registration | `20261013180116` |
| Private invitation enforcement | `20261013180214` |
| Initial invitation metadata minimization | `20261013182224` |
| Auth follow-up metadata update guard | `20261013183111` |

The larger combined guarded request twice returned `Invalid or expired requestState` and did not apply. Smaller reviewed migrations then succeeded. Their DDL adds private configuration/trigger/function behavior; it never updates an existing Auth user or any of the six existing public Weekwise tables. The combined aggregate-preservation transaction is verified in isolated PostgreSQL and retained for future reviewed use; it is not represented as the initial production execution.

Live acceptance first passed 46 checks. A subsequent minimization check exposed Auth writing signup metadata again after the initial insert; all failed-check fixtures were cleaned. The additional update trigger removes only a newly introduced invitation field on future metadata writes and never rewrites historical account metadata during migration. The final persisted-user and subsequent sign-in checks pass, with all **48 boolean checks true**. Zero fresh identities/invite groups remain, the one-use flag is false and erasure is still enabled. Push version 5 is active; backend checker version 4 ran acceptance and is retired as version 5 / HTTP 410. Existing erasure activation checker remains retired.

The automatic review rejected a temporary rollback to the older direct-upsert push handler because it would retain the known ownership flaw. The safer atomic ownership migration succeeded and that rollback was not executed. No approval blocker remains for that operation.

The original bootstrap hash and owner Vault invitation survive cleanup. Future operators must include both metadata migrations when recreating/reapplying invitation setup; reapplying the legacy bootstrap script alone would not preserve current minimization behavior. Read-only postchecks confirm service helpers are denied to browser roles, minute dispatch remains HTTP 200/ok=true, all six owner cascades remain validated and the save-RPC contract is retained.

Security advisors retain intentional owner-checked cloud RPC and pg_net catalog-namespace warnings plus free-plan leaked-password protection. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No policies/browser grants were added to the server-only tables to suppress INFO notices.
