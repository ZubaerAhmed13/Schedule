# Data compatibility, backup and rollback

## What changes

No production SQL or storage-key migration. Planner key `weekwise-planner-v2`, cloud envelope version 1 and JSON backup version 6 remain. Optional schedulingMode and settings.planning fields are additive. Existing unknown planner/task/week fields are preserved; export includes extension fields.

Startup no longer deletes records by title or filters out records without custom:true. Saved recurring occurrences retain notes, reminders, completion/subtasks and edited schedules on reload. Existing v1 Monday-to-Sunday migration retains top-level fields, task IDs, week metadata and the original v1 key. Validate/migrate on an isolated copy before deploying to legacy users.

## Backups

Use More → Export backup before a production upgrade, clearing browser data or account migration. JSON backups contain personal task details and histories; keep them private. ICS transfer remains a separate calendar format.

Restore accepts supported legacy versions through 6 (or the older settings/weeks envelope without version), limits input to 10 MB, validates dates/IDs/task primitives and collection shapes, rejects unsafe object keys and unsupported future versions, then asks for explicit replacement confirmation. Missing optional collections in older backups retain the device's current collections.

Before writes, `weekwise-pre-restore-v1` stores previous raw values of every key that will be replaced. If checkpoint creation fails, no data is replaced. If later writes fail, restore rolls back saved raw values; an incomplete rollback is reported. The checkpoint contains private data and is local-only. It is not a substitute for a downloadable backup and is not synchronized.

## Corrupt planner recovery

Unreadable/malformed primary planner data leaves its original bytes intact. Planner saving and cloud upload are paused. A persistent notice offers Download original local data. Keep that file, then restore a known valid backup. Do not export the empty fallback view as though it were the damaged original. Other independent collections have not received equivalent corruption guards yet; audit and protect them in the next reliability increment.

## Plan checkpoints

`weekwise-pre-plan-v1` retains the raw planner before the last accepted plan. In-memory Undo works while the planner/account remains unchanged. After newer edits, Undo refuses to erase them. Reload does not retain the Undo button; the checkpoint remains for manual recovery.

A developer can recover a checkpoint in an isolated profile: parse checkpoint JSON, find the planner-key raw value in entries, validate it with WeekwiseData.parseStore, construct a version-6 backup envelope using that settings/weeks snapshot and compatible auxiliary collections, then use the normal confirmed restore. Do not clear storage or directly overwrite a live account during diagnosis.

## Rollback

Keep main unchanged until PR review and release gates pass. Revert code with a normal new commit; do not force-push. Export current data before downgrading. The baseline has automatic-deletion heuristics, so an older build must be tested against an isolated copy before use. Version-6 backups preserve additive fields but an older restore implementation may ignore unknown top-level extensions.

## Remaining tests

Real legacy fixtures from all historical formats, full valid-restore E2E including collection rollback, quota exhaustion in a browser, independent-store corruption, simultaneous-device sync and account switching are required before production readiness. New unit and browser regressions establish a bounded foundation, not complete certification.
