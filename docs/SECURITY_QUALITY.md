# Focused security quality review — 14 October 2026

This is a scoped engineering review mapped to [OWASP ASVS 5.0](https://owasp.org/projects/asvs), not an independent penetration test or certification. The existing backend acceptance and owner-isolation suites remain mandatory. Production checks in this upgrade are read-only and do not use an existing account as a writable fixture.

| Control area | Existing implementation and checks | Further evidence |
| --- | --- | --- |
| Identity and ownership | Verified sessions, owner-checked save RPC, compare-and-swap revision, denied anonymous reads/writes and denied authenticated direct writes; private invitation hashes | Real confirmation/reset email delivery and expired-token waiting; administrator MFA |
| Sensitive operations | Account erasure reauthenticates the same password account, revokes sessions before deletion, validates cascades and refuses deleted-owner writes | Independent review and actual owner recovery/administration procedure |
| Client and API boundaries | Publishable/anon key only in client; provider/VAPID/private service credentials stay server-side; origin checks, bounded request bodies and trusted push hosts | Provider-specific configuration when integrations are eventually enabled |
| Privileged database code | Restricted RPC search path, server-only push/calendar helpers and private invitation/configuration tables | Re-review any grants or function changes; do not broaden access to silence advisors |
| Local storage and recovery | Guarded bytes, account/epoch checks, safe transactions and isolated backup rehearsal; no silent discard of malformed entries | Historical backup restore on isolated physical browser profiles and offsite server backup setup |
| Diagnostics | Explicit opt-in, owner-scoped bounded journal; fixed operation/outcome codes, date/build and numeric duration only; optional export and erasure cleanup | Privacy-conscious remote monitoring only after a collector/consent/retention decision |
| Dependencies and release | Pinned client/test versions, isolated checks, versioned offline cache, expected-head publication and build identity verification | Continue dependency review; no claim of a complete supply-chain audit |

## Actual read-only backend findings

WeekWise reports ACTIVE_HEALTHY on PostgreSQL 17.11. All Weekwise public tables have RLS. Anonymous cloud SELECT, direct writes and save-RPC execution are denied; authenticated cloud SELECT and the intended save RPC are allowed while authenticated direct cloud writes are denied. Exactly one active push scheduler had 30 successful runs and zero failures in the recent 30-minute observation window. These facts do not measure phone delivery or ongoing uptime.

The current advisor findings were reviewed rather than suppressed:

- Server-only/private tables have RLS and no browser policies. Their no-policy INFO finding is deliberate deny-by-default behavior. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `weekwise_save` is intentionally callable by signed-in users as a restricted owner-checked SECURITY DEFINER RPC so direct table writes remain denied. Removing that boundary or granting broad writes would change the security model. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- The existing `pg_net` catalog-namespace warning remains documented. No extension relocation or browser grant is made merely to remove the warning. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
- Leaked-password protection is disabled on the current Free organization and requires an eligible plan. No paid upgrade is made. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The calendar OAuth expiry index has an unused-index INFO finding while calendar integrations are deferred. It is retained for that expiry path. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

No schema, Auth settings, existing user rows or provider configuration is changed in this release. Arbitrary legal/privacy or accessibility compliance is not inferred from this review.
