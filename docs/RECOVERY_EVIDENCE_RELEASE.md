# Release 4 — recovery evidence

Settings → Device, speed & recovery now compares an original JSON backup with an export taken after a full restore. Rehearsal still runs separately in memory. Comparing either file never imports data, writes a planner, contacts the cloud or creates a checkpoint.

## File comparison contract

Each file must pass the existing supported legacy/version 1–6 validation and 10 MB limit. The comparison checks every original stored value: settings, weeks/tasks, recurrence rules, custom lists, archive/trash, unknown planner fields, and each auxiliary collection included in the original. Object key order, whitespace, export time and backup envelope version do not change the result. Array order remains meaningful. Missing or changed original values identify the affected fixed-name section; added fields/entries are reported separately and need review. Defaults or generated occurrences may produce additions even when all original values survive. Collections absent from the original are excluded, matching the importer's preservation of omitted collections.

Reports contain SHA-256 and byte counts for both files, original/restored collection counts and section outcomes. They exclude filenames, task text, task IDs, notes, arbitrary property paths, identity and credentials. A report proves only what the two selected files contain. Selecting the same file twice cannot prove that a restore occurred. Full restore time, physical storage behavior, cloud restoration and server disaster recovery require separate observations.

Changing either selection invalidates its comparison. Clearing files or switching owners cancels pending reads and clears both selections, visible results and downloadable reports. The existing JSON actions remain in Settings for account and device planners. Existing restore ownership, revision, storage baseline and checkpoint protections remain unchanged.

## Build-specific human evidence

The panel shows the number of real-device checks confirmed for the current build. Earlier-build confirmations stay stored and dated, appear unchecked, and count only as checks to repeat. Capabilities and CI never check these boxes. A person must repeat the action before confirming the new build.

## Verification

New automated cases run the production import → reload → export path in fresh, isolated device-only browser contexts for unversioned backups and versions 1–6. Generated fixtures include historical week notes, completed task IDs/metadata, reminder IDs, expired recurrence rules/exceptions, archive entries, habits, focus and saved filters. The test checks the original checkpoint, restored values and the comparison report. Additional cases cover differences, invalid files, light/dark accessibility, file clearing, in-flight owner isolation and stale-build confirmations.

Two independent controlled browser contexts additionally resolve overlapping offline/online edits using each existing explicit choice, then confirm convergence, metadata and notes after reload on both clients. Existing independent-edit reconciliation, upload retry and automatic refresh checks remain required. These are generated isolated fixtures, not physical two-device acceptance or real user data.

Exact checked source, test counts, screenshots, deployment marker and asset verification belong to the release PR. No architecture or asset-loading change is justified solely by raw file size; real phone profiling and representative performance samples remain required before optimization. Existing opt-in web-vitals diagnostics remain available.

## Remaining observations

Physical iOS/Android installation, app-closed notification receipt, phone keyboard/rotation, human screen readers/zoom, same-account physical reconnect, private historical files, SMTP/reset-mail receipt, owner alert receipt, offsite server restore and representative field speed remain unconfirmed until observed. See [device acceptance](DEVICE_ACCEPTANCE.md) and [operations](OPERATIONS.md). Google/Outlook activation is excluded. No provider, paid service, live record, schema, Auth configuration or notification-recipient setting is changed.
