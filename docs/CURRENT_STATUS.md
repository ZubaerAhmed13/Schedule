# Weekwise current status — 13 October 2026

The live checked release is `9ac94cf2473d5932770d9c11a5be038f8b1afd81` (PRs #16–#37 merged), Pages run `38398725212`, asset version `1f7300d8d303209a`. The marker was fetched independently after deployment. Saved-clock Today/Focus/Insights is the current follow-up; no production backend was deployed or activated.

## Current verification

| Check | Verified result |
|---|---|
| Last released client | 142 Node tests and 54 built-client browser tests; release and all three Edge Function type checks passed |
| Recurrence release | Exact head `56884163ce997ac43b8ec48ee1b5cf8f4419f887` passed 142 Node/54 browser tests and release/all three Edge checks; the phone drag regression verifies its visible starting handle |
| Today clock follow-up | 146 Node tests and release/build checks pass locally; final 55-test browser suite is the release gate |
| Pages | Exact commit/run/hash independently matched; frontend-only build |
| Privacy and integrations | Account-erasure controls/source are present but the server operation is disabled pending correct-project staging; no real account deleted |
| Correct Supabase project | `iajkzlsurghfvsmqkmut` is inaccessible through the current connection; its direct project lookup returned a permission denial. No unrelated project was queried or changed |

Tests use synthetic records and mock accounts/provider transport. Offline tests use the real service worker; this does not certify private production RLS, actual OAuth/push delivery or installed-device behavior.

## Delivered source and client behavior

- Today/Inbox/Plan/Calendar/Insights navigation, responsive light/dark interface, optional onboarding, measured Focus sessions, daily unioned workload and flexible weekly habits.
- Checked backup/restore, damaged-data preservation, account-isolated editor drafts/history export, large-list and Focus search/paging.
- Archive, Recently removed, exact/scoped restore and guarded Undo; linked task groups and recurrence exclusions retain history.
- Reviewed recurring date/time/duration/cadence changes, completed/customized occurrence protection and Undo.
- Monday-first weekly Calendar/planning/review over unchanged Sunday-canonical storage; IANA Calendar projection with original editing references, multi-day/overnight carry, atomic reviewed swaps and keyboard/stale-pointer safeguards.
- Explicit overnight editor hours, adjacent-week conflicts, saved-account offline opening/reload/reconnect without pretending to authenticate.
- Saved-zone planning dates/instants, DST review intervals excluded from capacity/suggestions, carried all-day commitments and exact accepted timestamps.
- Lab performance reporting, bounded Intl/projection caches, versioned offline shell and dirty-editor/review update protection.
- Gated password-reauthenticated account-erasure endpoint, typed confirmation, backup acknowledgement, same-owner response validation and scoped local cleanup. Activation guide: [ACCOUNT_ERASURE_SETUP.md](ACCOUNT_ERASURE_SETUP.md).

## Remaining acceptance and design limits

| Area | What remains |
|---|---|
| Private backend | Correct Weekwise project/test identities; real own-row/cross-user RLS, invitation enforcement, refresh/expiry, revision/RPC privileges, account cascades and staging erasure. Prepared SQL was not executed |
| Optional services | Google/Outlook credentials/consent and create/update/delete/conflict/refresh acceptance; VAPID/cron and app-closed push acceptance. No optional AI provider configured |
| Device/human acceptance | Real phone keyboards/rotation, screen readers and 200% zoom; installed-PWA upgrade/interrupted-install, actual two-device reconnect and representative private historical backups |
| Historical planner zones | Calendar projection and source-zone planning are delivered. Full historical source-zone migration and an independent planning-zone transformation remain separate design work. The device-zone review gate remains; no historical zone is silently migrated |
| Architecture/performance | Core/presentation modules and narrow checked bridges are extracted, but the legacy app IIFE remains large. Further maintainability/profiling and real-use field Core Web Vitals require additional work/evidence |
| Scope limits | Recurring bulk scheduling reviews at most 200 saved moves per preview; use a smaller scope for more. No automatic archive purge, exported-backup deletion or external-provider consent erasure |

The 32-section master plan remains partially complete. Existing authorization permits checked GitHub Pages client releases; it does not establish private backend/device certification. No real user data was used as a test fixture.

## Historical implementation notes

The following sections describe how individual changes were implemented. Any pending-check wording is dated candidate history; the current verification table above supersedes it.

## Focus selector implementation

`js/weekwise-focus-picker.js` provides a read-only derivation over all canonical records. It searches unfinished task titles, notes, folders, sections and tags, then returns at most 100 matching records plus one pinned selection. Search and page changes never edit tasks. A completed or removed task associated with a persisted session stays identifiable by its original week/ID/title; no replacement task is created. Search/page/selection and session-length controls lock during active or paused sessions; the restored timer preset displays its persisted duration and reset for a different account.

Six Node behavior tests cover 10,000 records, search outside the first page, pinned selection, completion/removal, empty results and index bounds. Two built-client browser tests exercise narrow-screen paging/search, paused reload/completed association, exact logged session identity, full canonical preservation and account separation. The selector script is included in the versioned offline shell. Browser CI remains the release gate.

The Focus dialog now uses the shared green theme and readable text colors. The existing axe gate also audits the Focus dialog in light and dark mode; its serious/critical findings must be empty before release.

## Task lifecycle continuation

Existing task removal now moves original records to Recently removed; the task editor also offers Archive. Settings exposes both collections with search, 100-entry paging, exact-record restore, optional unscheduled restore when original slots are occupied, and guarded last-removal Undo. Linked task parts move as one group. Recurrence exclusions prevent archived occurrences being regenerated; restoring does not overwrite a subsequently edited rule. History is part of the account-scoped planner store, ordinary JSON backup and cloud snapshot. Fixed settings blocks cannot be removed here. No automatic purge or actual user-account deletion is performed.

Seven new pure tests plus existing shared transaction tests cover retention, linked identity, backup validation, conflicting restore and independent recurrence edits. Two Chromium regressions cover archive/remove/restore/Undo, reload and account isolation. The shared checked commit bridge is reused across planning and task lifecycle to protect stale tabs, account changes, quotas and cloud conflicts. Final branch checks remain mandatory. Archive changes active task totals; recorded focus history remains retained.

## Recurring scheduling continuation

A dedicated future-series review now supports new first date, start, duration, daily/weekly/monthly/yearly cadence, optional end date, all-day or unscheduled placement. It previews saved occurrence moves, protects completed/progress/customized records, shifts original relative deadlines/reminders, checks retained blocks including midnight spill, rejects ambiguous/nonexistent DST times, revalidates the entire preview at commit, and offers guarded Undo. IDs, metadata, source-week notes and prior history are retained. More than 200 saved moves requires a smaller review scope; no blind bulk rewrite occurs. Newly opened dates still use the app's normal recurrence materialization. Node and built-client CI must pass before release.

## Date-based Calendar and Monday planning continuation

Monday-first Calendar Week, Smart Week Builder and weekly review operate over actual dates spanning existing Sunday-canonical week keys. Placements are saved to the Sunday key containing the real target date. Selecting this preference does not migrate original task dates or IDs.

The Calendar can project timed activities into an explicit IANA display zone across Day/Week/Month/Agenda/Year; date-only/all-day events keep their calendar dates. Cards keep original source-week/ID references for editing and completion. Cross-week pointer/keyboard moves check actual occupied instants, retain metadata and record history; fixed/completed records are protected. Calendar-created placements capture exact instants, including distinguishable source-zone DST folds. Ambiguous/nonexistent old wall-clock values remain saved and visible in a review list instead of receiving invented instants. Task-editor fields and planning availability remain in the saved planner zone, explicitly labelled; this is a non-destructive calendar display preference, not a silent historical-zone migration.

Pure tests cover Monday/Sunday/year boundaries, cross-zone date projection, all-day dates, DST ambiguity, exact captured instants, collision/protection and target-week persistence. Built-client tests cover boundary records, Sunday planning/Undo, all five projected views and original-clock editor identity. Date conversion reuses bounded Intl formatter/offset caches; derived Calendar records are cached per snapshot rather than recomputed per cell. Final branch CI and responsive visual review remain required.

## Verified continuation through PR #33

PR #29 lab reporting, #30 Focus selection, #31 task lifecycle, #32 recurring schedules and #33 Calendar/Monday preferences are merged. PR #33's exact head `f26771b65f9996eb41efe74c8f00ad9ef97fe06b` passed 112 Node tests, 43 built-client browser tests, release checks and both prior Edge Function type checks. Browser run: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38372873005 . Desktop screenshots were reviewed. A browser failure caught and fixed the old week-date onchange resetting an unsaved Monday preference; date and preference now save together. Public deployment verification is recorded separately from PR checks.

The account-erasure continuation adds nine handler/device-cleanup Node tests (121 total locally) and three browser fixture regressions for disabled configuration, mismatched identity/scoped cleanup and a newer account during an in-flight request. Final remote browser and new Edge Function type checks are required before its release. Production erasure is not activated.

## Calendar/editor/offline reliability continuation

The follow-on review adds atomic reviewed swaps, retained keyboard focus and pointer account/snapshot/zone checks, carried multi-day all-day collision protection and paging for all-day/unscheduled Calendar items. Ordinary fixed blocks keep their original completion restrictions.

The editor accepts explicitly confirmed next-day end times up to 24 hours and checks adjacent canonical weeks, prior-night spills and exact DST placements before mutation. Existing unchanged clock values retain their schedule during metadata edits. Overnight records automatically use the date-based Calendar so both carried dates are visible. No historic task is migrated or duplicated.

A remembered account copy can be deliberately opened offline while the Auth SDK is unavailable; it retains its owner, edits and draft/focus scope without pretending to be signed in or sending cloud writes. The choice survives offline reload and clears when a real account session returns or the user chooses device-only mode. A real service-worker browser fixture checks this through reconnection. Final remote browser/release checks remain required; private real-device reconnect acceptance remains separate.

The combined local suite currently passes 129 Node tests. New remote browser tests cover phone keyboard/stale-pointer movement, cached-account offline edits/reload/reconnect, explicit overnight editor retention and reviewed pointer swapping. The account-erasure source in PR #34 passed 121 Node/46 built-client browser tests and all three Deno handlers before merge; its production handler remains disabled pending correct-project access.

## Saved planning-clock continuation

Planning previews now derive their current date/minute from the saved planner zone; apply checks actual source-zone instants, rejects DST gaps/folds/discontinuities and captures the exact accepted schedule. Changing the zone invalidates a pure preview. Multi-day all-day commitments reserve every occupied date, including carried blocks from earlier weeks. Planning remains in the saved source zone; the existing cross-device-zone review gate and reminder protections remain. This does not implement arbitrary planner-zone migration.

The older effort dashboard now calls completion totals marked-complete planned time and describes unchecked past plans as review items. Recorded Focus sessions remain separate; completion checkmarks are not presented as measured work or wasted attention.

Five additional Node tests cover date boundaries, exact IANA instants, changed-zone rejection, DST refusal, excluded clock-change capacity and carried commitments. A deterministic browser fixture freezes Sunday UTC/Monday Tokyo and verifies Monday's already-past availability produces no proposals. Final combined CI remains required.

Phone Calendar screenshot review also removed the redundant legacy day strip and pinned the time axis during horizontal week scrolling. The browser scenario checks both behaviors.

## Generated recurring-clock continuation

An indexed read-only occupancy model now generates future occurrences using exact zone-aware slots. Overnight templates retain their expected start and duration; adjacent-day/next-week and future all-day commitments block collisions. Gap/fold/discontinuous template times remain unscheduled with a review reason, instead of being guessed or silently shifted. Existing materialized occurrences, including completed/customized/reminder history, are skipped unchanged. New generated records carry exact instants.

Six pure tests cover midnight, DST, incremental occupancy, future all-day reservations, precise minutes and a 10,000-record canonical fixture. Two built-client scenarios cover daily overnight repetition/reload and a Berlin spring gap followed by a valid next day. The first recurrence head passed 140 Node/53 built-client browser tests and all release/Edge checks. Follow-up anchor/dashboard safeguards pass 142 Node tests locally; final remote checks remain required. The public browser and existing push/calendar source imports are now pinned to the same verified Supabase JS 2.117.3 used by account erasure, avoiding floating minor-version changes. No backend is deployed by this source change.

## Clock preservation follow-up

Captured-instant anchors are matched by field values rather than JSON property order, preserving exact DST instants after reordered cloud/backup objects and retaining unknown anchor fields. The dashboard classifies past/future plans with saved source-zone instants, caches by scheduling coordinates and leaves ambiguous legacy clocks unclassified for review. Two additional Node regressions cover reordered fold anchors, source-zone classification, cache invalidation and unchanged ambiguous records.

The final browser scenario loads a synthetic cloud row with reordered, extended DST-fold anchors, verifies its exact UTC card time and retained anchor on completion, and keeps a deliberate midnight scroll position. New Calendar view initialization uses its display-zone clock; updates in the same view preserve zero scroll. Zero-duration legacy markers remain stored but do not occupy generated recurrence slots.

Pending recurrence-clock review retains its expected date/zone/time in the editor and survives metadata-only edits until a user resolves the schedule. Account erasure names the captured signed-in account and disables credential fields until the operation is confirmed configured, including after deletion. These final UI guards are covered by the existing browser scenarios.

## Saved-clock daily decisions continuation

Today, Tomorrow and Upcoming list selection/counts, next commitment, carried overnight timeline and Focus summaries use the saved planner clock. Daily scheduled totals union elapsed scheduled instants clipped to the source date; this is planned elapsed time, not measured work. Crossed clock changes are labelled. Next commitment compares exact captured instants so retained DST folds remain distinguishable; ambiguous old times stay unchanged and are excluded for review. Focus history counts recorded sessions, including partial ones; it does not label every record a completed session. Recorded focus and rescheduling timestamps belong to their saved-zone week, and Settings labels the source clock separately from Calendar display. Daily derivation is extracted into `weekwise-today.js` and cached by the matching versioned offline shell. Four Node regressions and a narrow-screen synthetic cloud scenario cover the date boundary, carry, exact fold, completion and timestamp grouping. Final remote browser/release checks remain mandatory; no historical record migration or production backend operation occurs.
