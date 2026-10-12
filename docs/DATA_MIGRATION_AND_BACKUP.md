# Data compatibility, backup and rollback

## Compatibility

No production database or destructive storage migration is executed. Planner key `weekwise-planner-v2`, cloud envelope version 1 and backup version 6 remain. New fields are additive and unknown task/week/store extensions are retained. Baseline IDs, completed records, non-custom tasks, reminders and recurring exceptions survive reload.

The existing v1 Monday-to-Sunday conversion retains the original v1 key, IDs and metadata. Canonical weeks remain Sunday buckets; configurable week start and fixed-zone conversion require a separately tested migration/design. Do not reinterpret historical calendar data to implement a preference superficially.

Recurring reload uses a global occurrence lookup. Editing one occurrence marks an exception; editing a rule affects new occurrences. Stopping a rule sets an end boundary and retains every already materialized occurrence, including completed and edited history. The editor explains these conservative scope semantics.

## Backups and restore

Settings → Data & privacy or More → Export backup downloads canonical tasks, extension fields, rules, collections and history, without authentication tokens. Keep backups private. ICS is a calendar-transfer format, not a complete application backup.

Restore accepts supported envelopes through version 6 and legacy settings/weeks envelopes. It limits files to 10 MB, validates record primitives/IDs/dates/collection shapes, rejects unsafe object keys and future versions, then requires replacement confirmation. Missing optional collections retain the current device collection.

Before writing, `weekwise-pre-restore-v1` stores previous raw values for included keys. Checkpoint failure aborts before replacement. Later failure rolls back prior raw values; an incomplete rollback is explicitly reported. Normal task/collection saves also interrupt success reporting on failure and restore prior in-memory records.

## Damaged data

Primary planner and auxiliary collection parse failures retain their original bytes. Editing and automatic cloud upload pause. Download original local data from the recovery notice, retain that file, then restore a compatible known-good backup. Never export an empty fallback as though it were the damaged original. A restore clears the recovery guard only for the keys actually restored. If the backup lacks a damaged collection or active-timer key, retain/export that original and use an isolated profile for manual recovery; the app deliberately does not silently reset it.

## Accounts and checkpoints

Account caches use owner-specific keys. A transition preserves the previous payload, isolates the next account and retains device-only work separately. Adoption of existing device-only work into a signed-in account requires a choice. Unsaved task editor fields are checkpointed by owner during a transition; a draft-restoration UI remains pending. Checkpoints may contain private data, are not encrypted and are not synced automatically.

`weekwise-pre-plan-v1` and `weekwise-pre-split-v1` retain prior raw planners. Undo is in-memory and refuses to overwrite newer edits. A checkpoint can be turned into a version-6 backup in an isolated profile, validated with `WeekwiseData.parseStore`, then restored through the normal confirmed flow. Never clear storage or overwrite a live account while diagnosing.

## Code rollback

The review branch is `codex/weekwise-2-foundation`, draft PR #16. Main stays unchanged until release authorization. Revert using a normal new commit. Export data before downgrade; the old baseline has deletion heuristics and must not be reintroduced into a real profile without isolated compatibility checks.

Browser coverage includes legacy and recurring history, damaged primary/habit bytes, invalid restore, valid confirmed restore, quota failure, account separation and actual offline reload. Real historical backups and private test-account/backend verification remain release gates.
