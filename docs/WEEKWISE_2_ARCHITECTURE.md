# Weekwise 2.0 architecture

Weekwise retains the existing HTML/CSS/JavaScript application and Supabase endpoints. Canonical data remains compatible with the baseline; no production database migration has been executed. Main and the public website remain unchanged while draft PR #16 is reviewed.

## Client modules

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic markup, public Supabase configuration and relative asset references |
| `js/weekwise-app.js` | Canonical state, preserved editors/views/utilities, recurrence, integration bridges and cloud orchestration |
| `js/weekwise-data.js` | Validation, recovery guards, checked local transactions and sync labels |
| `js/weekwise-planning.js` | Pure availability/capacity engine, deterministic proposals, recovery, selected application and linked splitting |
| `js/weekwise-plan-ui.js` | Preferences, custom windows, placement review, selected approval, checkpoints and guarded Undo |
| `js/weekwise-focus.js` | Timestamp-based elapsed time, pause/resume and session records |
| `js/weekwise-cloud-transport.js` | Capture and validate the session identity/token for one RPC write |
| `js/weekwise-habits.js` | Scheduled days, skipped/rest days, paused habits and streak semantics |
| `js/weekwise-experience.js` | Read-only Today/Insights derivation and weekly-review interface |
| `js/weekwise-accessibility.js` | Modal focus containment, restoration and inert background |
| `js/weekwise-pwa.js` | Service-worker registration and explicit waiting-update prompt |
| `css/weekwise-legacy.css` | Extracted existing styles for preserved feature compatibility |
| `css/weekwise-plan.css`, `css/weekwise.css` | Planning components and shared green design tokens/responsive overrides |

The main module is still large. Further separation should follow measured behavior, with pure state APIs replacing individual legacy functions incrementally. This refactor removes executable app logic and legacy styles from HTML without replacing working features.

## State and transactions

Editors/capture write canonical weekly records. Shared task/calendar views read the same IDs. The planning bridge snapshots in-memory current-week tasks plus stored weeks. Preview is pure. Apply checks account, storage-recovery flags, timezone review, cloud conflict, full snapshot, age and local DST validity, then revalidates the deterministic proposals and persists one cloned store before installing it in memory.

Undo requires the post-apply store and account to remain unchanged. It never overwrites intervening edits. Restore and cloud application use checked multi-key writes with checkpoints/rollback. Normal task/collection save failures restore the previous in-memory records and interrupt the success path. Checked writers refresh per-key baselines after their own writes; newer records from another tab are rejected before replacement or automatic upload.

Account changes checkpoint the previous owner's payload and isolate the next owner's cache. Device-only data is retained separately; adoption into an account with existing local work requires an explicit choice. Unsaved task-editor fields are retained under an owner-specific draft key during account changes. Draft restoration is not yet exposed in the interface.

Cloud saves deep-copy their payload and capture the authenticated token, user ID and session epoch. A late response from an old account cannot update the next account's revision/status. Revision conflicts pause automatic uploads. Provider preparation verifies identity again after awaiting the cloud save.

## Compatibility and time

Storage key remains `weekwise-planner-v2`; cloud payload version is 1; JSON backup version is 6. Existing extension fields, IDs, completed history, reminders, recurring exceptions and week metadata are retained. New fields are additive: scheduling mode, explicit duration estimate, completion requirement, Today highlight, split links/history, planning preferences, weekly reviews, habit schedules and recorded device timezone.

Canonical weeks remain Sunday buckets. Display times use the device's local timezone; changing to another recorded zone requires explicit review before editing/reminder checks. Clock times are retained, not silently converted. Arbitrary fixed-zone rendering, timezone conversion and configurable week start are not implemented. Existing legacy data without timezone metadata uses the current device zone until it is next saved.

## Build and offline behavior

Source remains directly serveable. `node scripts/build-weekwise.mjs` creates a clean `dist/` containing only client assets. It appends a reproducible content version to every JS/CSS reference and the service-worker shell/cache name. SQL, docs, tests and server functions are excluded from Pages uploads. Deployment identity is retained in `build-info.json`.

Service-worker install caches one matching shell. Navigation falls back to that shell when offline; failed network requests do not replace it. Only allowlisted static assets are cached. Auth/API responses are excluded. A waiting update is activated by the user, with reload confirmation when an editor is open. Device-only use works without the Supabase CDN and is covered by an actual offline browser regression.
