# Weekwise operations and recovery

This runbook covers the current GitHub Pages client and WeekWise project `iajkzlsurghfvsmqkmut`. Google/Outlook activation is excluded from the current scope. No paid plan, analytics collector, service-role client key or writable production test fixture is introduced.

## Monitoring and incident response

`Weekwise public service monitor` runs every six hours and can be run manually in GitHub Actions. `node scripts/probe-services.mjs` makes GET-only, bounded, timed requests with retries. It verifies Auth health, public email-provider availability, anonymous planner-read denial, erasure activation, the push route, calendar encryption readiness, and consistency between the public build marker and HTML asset versions. Google/Outlook credential-presence booleans are reported separately; they do not certify consent or real event round trips. Only fixed check names and outcomes appear in its summary. Failures produce a failed workflow; repository owners must configure their GitHub Actions notifications to receive alerts. A successful probe does not certify signed-in sync, cron dispatch, mail delivery, closed-app push or an availability SLA. Scheduled workflows can be delayed by GitHub and do not replace continuous monitoring for a public launch.

For an incident:

1. Save open work. Export the affected device copy before replacing any data. Ask for an optional private device report, never a password, bearer token or full planner in a public issue.
2. Check the public service workflow and Supabase status. Use the read-only readiness SQL below for scheduler/access-control checks. Inspect sanitized outcomes before inspecting private application records.
3. In Settings → Device, speed & recovery, check the planner mode, last confirmed save, pending changes, storage recovery and conflict state. Enable troubleshooting recording only with the device owner's consent. Events are fixed codes and timings, not error messages or content.
4. Retry using Sync now. If there is a conflict, preserve both device exports and review the overlapping record. Never resolve a whole-copy conflict just to make an indicator green.
5. If a client release regressed, revert the reviewed release commit through a PR, run the normal checks, deploy and verify its new build identity. Use the normal update prompt; never clear browser storage or force worker activation with unfinished edits.
6. If backend recovery is needed, use an isolated target project first. Preserve current production records. Schema rollback SQL is specific to its release and is not a generic production restore command.

`supabase/operations/weekwise-quality-readiness.sql` reads only aggregate readiness and catalog privileges. It does not select planner content, emails, Vault secrets, endpoints or tokens. Scheduler success indicates that the scheduled SQL ran; it is not proof of OS notification receipt. A privileged operator must separately review dispatch HTTP outcomes.

## Backups and recovery objectives

The cloud snapshot is the latest revision; local checkpoints and device copies are separate recovery mechanisms. A JSON export is a private user backup, not a complete server disaster-recovery backup. Rehearsal uses isolated memory and is followed by a full import/reload/export in an isolated browser profile with representative historical files. Settings → Device, speed & recovery can compare the original and restored export, including original values and separately reported additions. Preserve both checksums, record observed restore duration and the backup timestamp privately; file comparison alone does not establish an RPO/RTO or prove server recovery.

The organization is currently on Supabase Free. Downloadable managed database backups and PITR are not assumed available. Before claiming server disaster recovery, the owner must choose either private scheduled logical exports with scoped database credentials, or a supported managed-backup plan. Store encrypted backups outside the production account, record retention and recovery objectives, and rehearse restoring schema, ownership/cascades, Auth dependencies, configuration and records to an isolated project. No credentials or private exports belong in this public repository or Pages. This release neither creates an offsite backup service nor claims an RPO/RTO that has not been measured.

Until that setup exists, maintain private JSON exports from the devices in use and keep both copies before conflict resolution. Do not delete history/checkpoints to simulate a retention policy. Current app retention is explicit in the privacy page: task/editor/history/recovery records have no automatic purge; diagnostic events are capped at 80; performance samples at 80 with 50 view measurements each. Exported files, other device copies, hosting logs and provider backups have separate retention controls.

## Authentication and email

The public probe verifies email/password authentication flags, not mailbox delivery. Before broad registration, verify custom SMTP, sender domain, confirmation/reset templates, real receipt, expired links and recovery on a separate device. Supabase's default SMTP is restricted and is not intended as production email. SMTP credentials require an owner-selected provider and stay server-side. The existing invite enforcement, password reauthentication, session revocation, account cascades and owner-checked RPC remain in place.

Admin accounts should use MFA. Optional leaked-password protection currently requires an eligible paid Supabase plan; no upgrade is made. Supported modern clients should remain unaffected by the announced November 2026 retirement of older CBC TLS cipher suites; physical device acceptance should use maintained OS/browser versions.

## Capacity and costs

Use the existing planning benchmark and 10,000-record browser scenarios as controlled regression evidence. They do not establish concurrent backend capacity. Record actual active users, storage, request volume, Edge execution and quota headroom in Supabase's dashboard before selecting load targets or increasing resource tiers. Load tests use an isolated environment and generated data. Review cost and quota consumption before enabling new providers or remote telemetry.

## References

- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase cipher deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
- [Device acceptance](DEVICE_ACCEPTANCE.md), [sync reliability](SYNC_RELIABILITY.md), [security quality review](SECURITY_QUALITY.md)
