# Weekwise 2.0 architecture

Weekwise retains the existing HTML/CSS/JavaScript application and Supabase endpoints. Canonical data remains compatible with the baseline; no production database migration has been executed. PRs #16–#37 are released. [CURRENT_STATUS.md](CURRENT_STATUS.md) records exact-head evidence and remaining acceptance gates.

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
| `js/weekwise-experience.js` | Today/Insights presentation and weekly-review interface |
| `js/weekwise-today.js`, `js/weekwise-insights.js` | Pure source-clock daily decisions, unioned workload and recorded history derivation |
| `js/weekwise-calendar-range.js`, `js/weekwise-timezones.js` | Shared exact instants, IANA wall-clock validation, range projection and checked moves/swaps |
| `js/weekwise-calendar-range-ui.js` | Date-based Calendar, pointer/keyboard movement and visible-record references |
| `js/weekwise-recurring-placement.js`, `js/weekwise-task-schedule.js` | Indexed recurrence occupancy and checked editor placements including overnight/DST |
| `js/weekwise-series-schedule.js`, `js/weekwise-series-schedule-ui.js` | Reviewed recurring date/time/cadence transactions with protection and Undo |
| `js/weekwise-task-history.js`, `js/weekwise-task-history-ui.js` | Preserved task archive/trash, scoped restore and guarded Undo |
| `js/weekwise-account-privacy.js`, `js/weekwise-account-ui.js` | Disabled-by-default account-erasure controls and confirmed-owner cleanup |
| `js/weekwise-focus-picker.js`, `js/weekwise-list-window.js` | Bounded pages with whole-store search and retained selection identity |
| `js/weekwise-drafts.js`, `js/weekwise-onboarding.js`, `js/weekwise-update-safety.js` | Owner-scoped drafts/history, optional guide and unsaved-input update protection |
| `js/weekwise-accessibility.js` | Modal focus containment, restoration and inert background |
| `js/weekwise-pwa.js` | Service-worker registration and explicit waiting-update prompt |
| `css/weekwise-legacy.css` | Extracted existing styles for preserved feature compatibility |
| `css/weekwise-plan.css`, `css/weekwise.css` | Planning components and shared green design tokens/responsive overrides |

The main module is still large. Further separation should follow measured behavior, with pure state APIs replacing individual legacy functions incrementally. This refactor removes executable app logic and legacy styles from HTML without replacing working features.

## State and transactions

Editors/capture write canonical weekly records. Shared task/calendar views read the same IDs. The planning bridge snapshots in-memory current-week tasks plus stored weeks. Preview is pure. Apply checks account, storage-recovery flags, timezone review, cloud conflict, full snapshot, age and local DST validity, then revalidates the deterministic proposals and persists one cloned store before installing it in memory.

Undo requires the post-apply store and account to remain unchanged. It never overwrites intervening edits. Restore and cloud application use checked multi-key writes with checkpoints/rollback. Normal task/collection save failures restore the previous in-memory records and interrupt the success path. Checked writers refresh per-key baselines after their own writes; newer records from another tab are rejected before replacement or automatic upload.

Account changes checkpoint the previous owner's payload and isolate the next owner's cache. Device-only data is retained separately; adoption into an account with existing local work requires an explicit choice. Unsaved task-editor fields are retained under an owner-specific draft key during account changes. A scoped draft restore/download/discard interface and history export are delivered; no automatic purge occurs.

Cloud saves deep-copy their payload and capture the authenticated token, user ID and session epoch. A late response from an old account cannot update the next account's revision/status. Revision conflicts pause automatic uploads. Provider preparation verifies identity again after awaiting the cloud save.

## Compatibility and time

Storage key remains `weekwise-planner-v2`; cloud payload version is 1; JSON backup version is 6. Existing extension fields, IDs, completed history, reminders, recurring exceptions and week metadata are retained. New fields are additive: scheduling mode, explicit duration estimate, completion requirement, Today highlight, split links/history, planning preferences, weekly reviews, habit schedules and recorded device timezone.

Canonical weeks remain Sunday buckets with stable original references. Monday-first Week/planning/review operate over real date ranges spanning those buckets. Calendar can project into a separate IANA display zone; date-only/all-day records keep calendar dates. New checked placements capture `scheduleInstant` with a scalar-matched anchor; unchanged legacy records are not rewritten. Source-zone planning/recurrence and the current Today/Focus/Insights follow-up share these date/instant utilities. Invalid/ambiguous DST wall times require review; no invented instant is assigned. A different device zone still pauses editing/reminder checks until explicit review. Full historical source-zone migration and independent planning-zone conversion remain separate design work. Legacy data without timezone metadata uses the device zone until saved.

## Build and offline behavior

Source remains directly serveable. `node scripts/build-weekwise.mjs` creates a clean `dist/` containing only client assets. It appends a reproducible content version to every JS/CSS reference and the service-worker shell/cache name. SQL, docs, tests and server functions are excluded from Pages uploads. Deployment identity is retained in `build-info.json`.

Service-worker install caches one matching shell. Navigation falls back to that shell when offline; failed network requests do not replace it. Only allowlisted static assets are cached. Auth/API responses are excluded. A waiting update is activated by the user, only when no editor, unfinished capture or dirty weekly review would be interrupted. Device-only use works without the Supabase CDN and is covered by an actual offline browser regression.

## Server boundaries

Push, calendar OAuth/sync and account erasure are separate Supabase Edge Functions. Browser source has public URL/anon configuration only. Erasure is disabled until explicit correct-project configuration and cascade/RLS staging validation; the frontend does not collect password/confirmation fields until the health check confirms configuration. Function type checks and synthetic transport tests do not prove private production policies or provider readiness.
