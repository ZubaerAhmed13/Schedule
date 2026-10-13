> Historical initial inspection and cloud-save activation below. Current optional-service deployment and remaining approval are recorded in [INTEGRATION_ACTIVATION.md](INTEGRATION_ACTIVATION.md).

# Weekwise connected-backend audit — 13 October 2026

Project `iajkzlsurghfvsmqkmut`, name Weekwise, is now accessible through the WeekWise connection and reports ACTIVE_HEALTHY. PostgreSQL is 17.11. This audit used catalog queries and aggregate compatibility checks; no task titles, planner JSON, credentials or user identifiers were retrieved. At the initial audit no production changes were made. The user subsequently approved the scoped cloud-save update; its applied result is recorded below. Optional services and stored user records were not changed.

## Verified configuration

| Area | Observed configuration |
|---|---|
| Cloud table | `public.weekwise_cloud_data`; RLS enabled; UUID owner primary key; object JSON check; revision >= 1 |
| Read policy | One authenticated SELECT policy: `(select auth.uid()) = user_id`; custom name `Read own Weekwise cloud data` |
| Browser grants | Authenticated SELECT enabled; direct INSERT/UPDATE/DELETE disabled; anonymous SELECT and RPC execution disabled |
| Save RPC | `weekwise_save(jsonb,bigint)` captures `auth.uid()`, rejects missing identity, serializes by owner advisory lock and row lock, validates expected revisions; first save inserts revision 1 |
| Return contract | `saved, revision, updated_at, data`; different order from the old repository setup, but named JSON fields remain compatible |
| Owner cascade | Validated `user_id -> auth.users.id ON DELETE CASCADE` on the cloud table |
| Optional functions | No Edge Functions deployed; optional calendar/push tables and RPCs absent |
| Invitations | Private invite-code table and Auth enforcement trigger absent; no invitation policy was silently activated or removed |
| Migration history | No recorded migrations; catalog state, not an empty history, determines what exists |
| Staging | No development branches exist; no paid branch was created |
| Payload compatibility | Aggregate query found no current cloud payload outside the proposed store/settings/weeks/object/10 MiB contract |

A read-only transaction impersonating an unrelated synthetic SQL identity checks that existing rows remain invisible under the actual SELECT policy. This is SQL-policy evidence, not a real signed-in two-account or token-expiry acceptance test.

## Advisor triage

- [Authenticated SECURITY DEFINER RPC warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): expected privileged write boundary because browser table writes are revoked. The owner check, restricted empty search path and explicit schema references were inspected. Do not blindly change this RPC to invoker or revoke its authenticated execution; that would break saving. Production end-to-end security verification remains required.
- [Leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): confirmed advisor finding. Enable through the correct Auth dashboard only after checking account/plan availability and signup behavior. No setting changed.
- Performance advisors returned no findings; this is not a field-performance certification.

## Repository fixes and proposed database operation

`supabase_verify_setup.sql` no longer declares valid RPC-only writes broken just because INSERT/UPDATE policy names are absent. It returns REVIEW for owner predicates and exposes all policy expressions for actual inspection; string matching cannot certify security.

`weekwise_rpc_hardening.sql` now preserves either known output-column order and refuses unknown contracts rather than dropping/recreating the RPC. First insert writes revision 1 directly, supporting the live revision>=1 check, and uses an owner advisory lock. It adds bounded object/store/settings/weeks validation and rejects negative expected revisions. Existing rows, constraints, owner IDs and revisions are retained; current browser grants are already restricted. The user-approved function update has now been applied with an atomic precondition and stored-row preservation guard; see the execution record below.

The PostgreSQL 17 CI workflow runs disposable synthetic fixtures for both output orders and revision constraints: first insert, update, stale conflict, missing-row stale attempt, malformed/oversized payload, missing identity, denied direct writes, cross-user reads, anonymous execution and repeat application. It has no Supabase credentials or network connection to production.

### Reviewed production proposal — subsequently approved and applied

After PostgreSQL CI and staging/legacy-client review, apply only the compatible `weekwise_rpc_hardening.sql` to the correct project. Before applying, recheck the live function fingerprint `c59799a0d4ca95cbb628b12c78e6bd46`, output contract, owner/cascade and grants; stop for fresh review if they changed. The exact inspected prior definition is preserved at `supabase/rollback/weekwise-save-20261013.sql`; CI restores it and checks that fixture rows/revisions survive before reapplying. Review intervening changes before rollback. This proposal changes the save-function validation/implementation and retains the existing restricted grants; it does not deploy optional integrations, enable erasure, create invitations or delete any data.

The user's master-plan rule 14 requires explicit authorization before altering production databases. The user explicitly answered “yes” to applying this scoped cloud-save update on 13 October 2026; that authorization was used only for the operation below.

## Remaining acceptance

1. Dedicated disposable real identities and safe staging environment for actual sign-in/reset/expiry, competing devices/revisions and erasure acceptance.
2. Explicit signup/invite policy decision and securely managed codes if invite-only registration is intended.
3. Google/Microsoft app registrations, dashboard secrets, reviewed schema/function deployments and real calendar round trips.
4. VAPID/scheduler setup, reviewed push deployment and app-closed delivery/opt-out/expiry acceptance.
5. Account-erasure function remains undeployed and disabled; cascade metadata alone does not certify real deletion. Storage, Auth-owned SCIM retention, other-device copies, exports and provider consent need their separate checks.

## Approved production execution — 13 October 2026

- Correct project/connection: `iajkzlsurghfvsmqkmut` / WeekWise; preflight confirmed the reviewed fingerprint, return order, owner, RLS and grants.
- Supabase migration `20261013132923`, name `weekwise_save_validated_payload_preserve_rpc_contract`, completed successfully.
- Exact applied SQL is archived at `supabase/operations/weekwise-save-approved-update.sql`. The transaction briefly locks cloud-table writes, rechecks the original function fingerprint, snapshots only aggregate row count/content hashes into a temporary table, installs the approved function and asserts that every stored row/revision/timestamp remains unchanged before commit. No private records or hashes were returned to the client. A failed preservation assertion would roll back the update.
- New function fingerprint: `e39c1609a40b05c83002fb3adecfbb38`. Return order remains `saved, revision, updated_at, data`; owner remains `postgres`; trusted search path is `pg_catalog`.
- Post-apply catalog checks confirm RLS enabled, authenticated SELECT/save granted, and direct INSERT/UPDATE/DELETE plus anonymous read/save blocked. Required store/settings/weeks and 10 MiB checks are installed.
- A **read-only** live transaction under an unrelated synthetic SQL identity confirms malformed and >10 MiB inputs reject before mutation and no existing cloud rows can be read. No real identity, planner or successful production write was used as a fixture.
- Security advisors still report the intentional authenticated SECURITY DEFINER boundary and disabled leaked-password protection described above; the migration does not change Auth settings.
- CI covers actual first/update/stale saves and both contracts with disposable PostgreSQL identities, including captured-definition rollback and unchanged rows. This is not a real Supabase two-device/Auth acceptance certificate.

The source fixes and all six post-merge workflows passed at PR #39; the exact Pages marker matched `b2c83acd2642783bdb57fd0c7ba7a418553aa691`, run `38404349619`, client assets `a0584ca6b702f192`. This execution record changes source/docs only; it does not activate calendar, push, invitation enforcement or account erasure. Further production operations require their own authorized scope.
