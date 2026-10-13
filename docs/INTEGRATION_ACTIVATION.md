# Weekwise integration activation — 13 October 2026

The user authorized calendar, background push and account-erasure setup. Applied migration `20261013142457` only to project `iajkzlsurghfvsmqkmut`; the atomic transaction locked the cloud table and asserted identical aggregate content and row counts before/after. The reviewed cloud-save definition remains fingerprint `e39c1609a40b05c83002fb3adecfbb38`. No existing planner row, revision or timestamp was changed, and no existing Auth identity was altered. A subsequent scoped check created two disposable password identities, verified deletion and cleaned both.

## Actual live results

| Component | Verified result | Remaining activation |
|---|---|---|
| Calendar | Version 1 deployed; HTTP health 200; encryption true; Google/Microsoft false; three token/state/link tables installed | Provider registrations, secure client credentials, consent and real round-trip tests |
| Push | Version 1 deployed; public-key HTTP 200, valid 87-character key; paired VAPID keys generated in the server and preserved in Vault; subscription/delivery tables installed | Approved pg_net/pg_cron scheduler, device notification permission and app-closed delivery |
| Account erasure | Version 1 deployed; erasure flag enabled after successful disposable test; health configured=true; unauthenticated POST 401 | Human/device acceptance of frontend/other-device retention boundaries |
| Test harness | Signed-proof version 6 passed the actual disposable check; retired version 7 returns 410 | No active privileged test harness |
| Configuration | Four initial secrets generated inside the backend; browser roles denied the configuration RPC and Vault; no secret values copied into code, chat or logs | Provider credential values entered directly in secure Dashboard Vault |

All six public Weekwise tables have RLS. The five optional tables and two private tables intentionally have no browser policies and explicit privilege denial; only the server role/internal functions use them. The calendar encryption key and VAPID pair must not be rotated casually.

## Checked source

Activation code head `b01ed4224e50e3164e2b779a68d3632b10e0aac8` passed 155 Node tests, 55 built-client browser tests, isolated PostgreSQL 17 contracts and all four Deno function checks. Workflow runs: release `38413019924`, browser `38413019455`, database `38413019954`, functions `38413019384`. Push naive reminder times now use the saved planner zone; device subscription zone is only a legacy fallback. Invalid dates, unknown zones and DST gaps/folds are skipped instead of guessed. Explicit-offset instants are preserved.

## Scheduler approval blocker and safer account activation

Automatic approval review rejected `create extension if not exists pg_net` because it adds outbound HTTP capabilities to database roles. No pg_net/pg_cron extension or push job was installed. This block still applies to scheduling; the reviewable scheduler is [supabase_push_cron_setup.sql](../supabase_push_cron_setup.sql).

Account activation used a materially safer alternative: management SQL derives a one-minute HMAC proof from the existing Vault operator key, and the checker verifies the exact nonce/time before claiming its single-use private flag. The secret stays in Vault; no database outbound HTTP extension is needed. PostgreSQL HMAC and Web Crypto matched with a public synthetic test key. [Signed operation](../supabase/operations/weekwise-activation-check-request.sql).

Initial fixture creation was rejected with Auth validation_failed. Corrected disposable credentials used a reserved example.com address and a strong 40-character password; `email_confirm=true` avoided sending any email. The final real check returned HTTP 200/passed=true. It verified wrong-password/target-ID/invalid-token rejection, own-account deletion and all six cascades, preservation of the other disposable account's data/revision/timestamp, rejected deleted-identity lookup, refresh revocation and the actual deployed account endpoint. Cleanup=true, zero disposable identities remain, account_erasure_enabled=true and activation_check_enabled=false. The harness was then retired (version 7, HTTP 410). No existing account was selected for mutation or deletion. These production backend results complement the mocked frontend checks; they do not certify every installed-device/privacy/legal boundary.

Supabase's pg_net default grants let database LOGIN roles read queued decrypted HTTP headers. Vault protects secrets at rest but does not hide them from those trusted database roles in the queue. The live anonymous Data API request using `Accept-Profile: net` returned 406/PGRST106: only `public` and `graphql_public` are exposed. Keep net unexposed and review every direct database LOGIN role. Do not attempt ineffective grant revocations or claim queue ACL isolation.

References: [pg_net queue-header access](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357) and [platform grants and exposed-schema limits](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

## Security advisor results

The seven no-policy INFO entries are intentional server-only tables, with browser grants revoked. The existing authenticated SECURITY DEFINER cloud-save warning remains the owner-checked RPC boundary. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; no Auth setting was changed. These results do not certify real device delivery, provider consent, other-device erasure or the whole master plan.

Performance review found one missing calendar OAuth-state owner index. Follow-up migration `20261013143107` added it without changing records. Catalog verification passed and the missing-FK-index finding disappeared. Remaining unused-index INFO notices are expected for newly installed, unused services; the indexes are retained for owner cleanup and bounded queries. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
