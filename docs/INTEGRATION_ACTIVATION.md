# Weekwise integration activation — 13 October 2026

The user authorized calendar, background push and account-erasure setup. Applied migration `20261013142457` only to project `iajkzlsurghfvsmqkmut`; the atomic transaction locked the cloud table and asserted identical aggregate content and row counts before/after. The reviewed cloud-save definition remains fingerprint `e39c1609a40b05c83002fb3adecfbb38`. No existing planner row, revision or timestamp was changed, and no existing Auth identity was altered. A subsequent scoped check created two disposable password identities, verified deletion and cleaned both.

## Actual live results

| Component | Verified result | Remaining activation |
|---|---|---|
| Calendar | Version 1 deployed; HTTP health 200; encryption true; Google/Microsoft false; three token/state/link tables installed | Provider registrations, secure client credentials, consent and real round-trip tests |
| Push | Version 1 deployed; public-key HTTP 200, valid 87-character key; paired VAPID keys generated in the server and preserved in Vault; subscription/delivery tables and minute scheduler installed; two scheduled HTTP 200 dispatches verified | Device notification permission and app-closed delivery |
| Account erasure | Version 1 deployed; erasure flag enabled after successful disposable test; health configured=true; unauthenticated POST 401 | Human/device acceptance of frontend/other-device retention boundaries |
| Test harness | Signed-proof version 6 passed the actual disposable check; retired version 7 returns 410 | No active privileged test harness |
| Configuration | Four initial secrets generated inside the backend; browser roles denied the configuration RPC and Vault; no secret values copied into code, chat or logs | Provider credential values entered directly in secure Dashboard Vault |

All six public Weekwise tables have RLS. The five optional tables and two private tables intentionally have no browser policies and explicit privilege denial; only the server role/internal functions use them. The calendar encryption key and VAPID pair must not be rotated casually.

## Checked source

Activation code head `b01ed4224e50e3164e2b779a68d3632b10e0aac8` passed 155 Node tests, 55 built-client browser tests, isolated PostgreSQL 17 contracts and all four Deno function checks. Workflow runs: release `38413019924`, browser `38413019455`, database `38413019954`, functions `38413019384`. Push naive reminder times now use the saved planner zone; device subscription zone is only a legacy fallback. Invalid dates, unknown zones and DST gaps/folds are skipped instead of guessed. Explicit-offset instants are preserved.

## Approved scheduler and scoped account activation

Initial automatic approval review rejected `pg_net` enablement. The user then explicitly approved `pg_net` and `pg_cron` for one-minute push scheduling. Migration `20261013151217` (`weekwise_push_scheduler_activation`) applied only to Weekwise. The guarded SQL is archived in [20261013151131_weekwise_push_scheduler_activation.sql](../supabase/migrations/20261013151131_weekwise_push_scheduler_activation.sql).

Exactly one active `weekwise-push-dispatch` job runs at `* * * * *`, reads the project URL/shared secret from Vault, and invokes only the deployed Weekwise push endpoint with a 10-second timeout. The first scheduled run began `2026-10-13T15:13:00.099065Z` and completed successfully. Its asynchronous HTTP response was 200, dispatch `ok=true`, sent/failed/skipped=0, timeout=false and no transport error. A second scheduled response also succeeded; failed responses=0. There were zero device subscriptions, so no push notification was sent and app-closed delivery is not yet certified.

The exposed-schema probe after enabling extensions again returned 406/PGRST106 for `Accept-Profile: net`. The saved cloud-save fingerprint is unchanged, erasure remains enabled, no existing planner/user record was mutated, and no secret values were copied out of Vault. Direct database LOGIN roles were reviewed; only the project's standard Supabase-managed roles were present. Keep net unexposed and direct database credentials restricted to trusted services.

Account activation used a materially safer alternative: management SQL derives a one-minute HMAC proof from the existing Vault operator key, and the checker verifies the exact nonce/time before claiming its single-use private flag. The secret stays in Vault; no database outbound HTTP extension is needed. PostgreSQL HMAC and Web Crypto matched with a public synthetic test key. [Signed operation](../supabase/operations/weekwise-activation-check-request.sql).

Initial fixture creation was rejected with Auth validation_failed. Corrected disposable credentials used a reserved example.com address and a strong 40-character password; `email_confirm=true` avoided sending any email. The final real check returned HTTP 200/passed=true. It verified wrong-password/target-ID/invalid-token rejection, own-account deletion and all six cascades, preservation of the other disposable account's data/revision/timestamp, rejected deleted-identity lookup, refresh revocation and the actual deployed account endpoint. Cleanup=true, zero disposable identities remain, account_erasure_enabled=true and activation_check_enabled=false. The harness was then retired (version 7, HTTP 410). No existing account was selected for mutation or deletion. These production backend results complement the mocked frontend checks; they do not certify every installed-device/privacy/legal boundary.

Supabase's pg_net default grants let database LOGIN roles read queued decrypted HTTP headers. Vault protects secrets at rest but does not hide them from those trusted database roles in the queue. The live anonymous Data API request using `Accept-Profile: net` returned 406/PGRST106: only `public` and `graphql_public` are exposed. Keep net unexposed and review every direct database LOGIN role. Do not attempt ineffective grant revocations or claim queue ACL isolation.

References: [pg_net queue-header access](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357) and [platform grants and exposed-schema limits](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

## Security advisor results

The seven no-policy INFO entries are intentional server-only tables, with browser grants revoked. The existing authenticated SECURITY DEFINER cloud-save warning remains the owner-checked RPC boundary. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; no Auth setting was changed. These results do not certify real device delivery, provider consent, other-device erasure or the whole master plan.

Performance review found one missing calendar OAuth-state owner index. Follow-up migration `20261013143107` added it without changing records. Catalog verification passed and the missing-FK-index finding disappeared. Remaining unused-index INFO notices are expected for newly installed, unused services; the indexes are retained for owner cleanup and bounded queries. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

Post-scheduler security advisors additionally report [extension_in_public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) for pg_net's extension catalog namespace. This extension is non-relocatable on this project (`extrelocatable=false`). Catalog inspection confirmed all pg_net functions are in `net`, with zero public-schema functions. The live Data API denies the net schema. The metadata warning is recorded, rather than dropping/recreating a working extension and losing its queue/history. The approved direct-LOGIN-role queued-header boundary above still applies.
