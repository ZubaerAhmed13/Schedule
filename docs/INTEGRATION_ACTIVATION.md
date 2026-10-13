# Weekwise integration activation — 13 October 2026

The user authorized calendar, background push and account-erasure setup. Applied migration `20261013142457` only to project `iajkzlsurghfvsmqkmut`; the atomic transaction locked the cloud table and asserted identical aggregate content and row counts before/after. The reviewed cloud-save definition remains fingerprint `e39c1609a40b05c83002fb3adecfbb38`. No existing planner row, revision or timestamp was changed, and no Auth identity was created or deleted during this activation.

## Actual live results

| Component | Verified result | Remaining activation |
|---|---|---|
| Calendar | Version 1 deployed; HTTP health 200; encryption true; Google/Microsoft false; three token/state/link tables installed | Provider registrations, secure client credentials, consent and real round-trip tests |
| Push | Version 1 deployed; public-key HTTP 200, valid 87-character key; paired VAPID keys generated in the server and preserved in Vault; subscription/delivery tables installed | Approved pg_net/pg_cron scheduler, device notification permission and app-closed delivery |
| Account erasure | Version 1 deployed; HTTP health 200 with configured=false; all six owner-cascade tables installed | Disposable-identity real endpoint/cascade/refresh verification before enabling |
| Test harness | Version 1 rejected a public POST with 401; replaced with version 2 returning 410 | Redeploy only for the approved one-time check, then retire again |
| Configuration | Four initial secrets generated inside the backend; browser roles denied the configuration RPC and Vault; no secret values copied into code, chat or logs | Provider credential values entered directly in secure Dashboard Vault |

All six public Weekwise tables have RLS. The five optional tables and two private tables intentionally have no browser policies and explicit privilege denial; only the server role/internal functions use them. The calendar encryption key and VAPID pair must not be rotated casually.

## Checked source

Activation code head `b01ed4224e50e3164e2b779a68d3632b10e0aac8` passed 155 Node tests, 55 built-client browser tests, isolated PostgreSQL 17 contracts and all four Deno function checks. Workflow runs: release `38413019924`, browser `38413019455`, database `38413019954`, functions `38413019384`. Push naive reminder times now use the saved planner zone; device subscription zone is only a legacy fallback. Invalid dates, unknown zones and DST gaps/folds are skipped instead of guessed. Explicit-offset instants are preserved.

## Approval blocker and exact next action

Automatic approval review rejected `create extension if not exists pg_net` because it adds outbound HTTP capabilities to database roles. No pg_net/cron extension or push job was installed, and the disposable Auth test was not run. Both private activation flags remain false. The reviewable next request is [weekwise-activation-check-request.sql](../supabase/operations/weekwise-activation-check-request.sql), followed after a successful receipt by [supabase_push_cron_setup.sql](../supabase_push_cron_setup.sql).

Supabase's pg_net default grants let database LOGIN roles read queued decrypted HTTP headers. Vault protects secrets at rest but does not hide them from those trusted database roles in the queue. The live anonymous Data API request using `Accept-Profile: net` returned 406/PGRST106: only `public` and `graphql_public` are exposed. Keep net unexposed and review every direct database LOGIN role. Do not attempt ineffective grant revocations or claim queue ACL isolation.

References: [pg_net queue-header access](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357) and [platform grants and exposed-schema limits](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

## Security advisor results

The seven no-policy INFO entries are intentional server-only tables, with browser grants revoked. The existing authenticated SECURITY DEFINER cloud-save warning remains the owner-checked RPC boundary. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; no Auth setting was changed. These results do not certify real device delivery, provider consent, other-device erasure or the whole master plan.
