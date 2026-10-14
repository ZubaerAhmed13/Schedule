# Cross-device schedule sync — 14 October 2026

The live Weekwise Supabase project was ACTIVE_HEALTHY. Read-only diagnostics confirmed owner-scoped SELECT access, authenticated revision-checked saves, anonymous denial, successful planner reads and successful saves. No user rows were changed during diagnosis.

Confirmed client gaps:

- After a failed upload, the old periodic check returned immediately when the remote revision was unchanged. A local edit could remain unsent until another edit, manual sync, or reload.
- Sync now attempted an upload before checking for newer remote changes, creating a conflict even for a clean, stale device.
- Whole-snapshot conflicts stopped independent edits, such as adding different tasks on two devices.
- A downloaded snapshot could generate local defaults and upcoming recurring records, then incorrectly record those generated records as already acknowledged by the server.
- Object property order could affect the fingerprint, although JSONB responses can reorder properties.

The client now retries unsent edits during successful periodic checks and on focus, visibility and network reconnection. Visible clients check every 15 seconds; hidden clients do not poll. Initialization and reads are shared within the same account and session epoch. Stale account responses and reads racing with an upload cannot apply data. Sync now checks the cloud first. Applying updates keeps the viewed week/day/month and retains checked local transactions and recovery checkpoints.

Fingerprints use sorted object keys, preserving array order. Existing fingerprint snapshots are normalized on read, retaining their full payload as the three-way base. Independent identified records, additions, deletions and settings changes can reconcile using the last acknowledged payload. A task or other identified record is atomic: two different edits to that same record require review. Delete-versus-edit, incompatible moves, duplicate tasks/recurring occurrences, conflicting array order, arrays without stable identifiers, missing shared history and validation failures also require review. Unknown fields are retained. Saves still use the backend's existing compare-and-swap revision RPC; reconciliation never bypasses account ownership or revision checks.

Regression coverage includes unchanged-revision retries, download-first manual sync, account switches, concurrent reads, reads racing with writes, acknowledged versus generated records, merge preservation and true conflicts. Browser scenarios exercise independent contexts, schedule retiming, reconnect recovery, automatic reconciliation and timer downloads in Chromium, Firefox and WebKit. These are controlled backend fixtures, not a claim that the user's physical devices were inspected.

After this release, close editors and use **Reload to update** on each installed device (or refresh the browser). Sign in with the same email. A **Synced** badge confirms the upload. Returning to the second device requests updates immediately; an already-open device checks within 15 seconds. If **Needs review** appears, export a backup before choosing a complete copy. Never clear browser storage to troubleshoot an unsent schedule.
