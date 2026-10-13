# Weekwise current status — 13 October 2026

This review checks the actual latest repository and public build, rather than inheriting earlier chat claims. At the start of this review, `main` and the live `build-info.json` both identified **b173a18551b3b5c45d0be456632afaedb1a3eea9**, asset version `a741e3ce38e5372b`. PRs #16–#28 are merged. The older checkout and its uncommitted edits are preserved separately; no obsolete patches have been replayed over the newer app.

## Verified released baseline

| Check | Result | Evidence |
|---|---|---|
| Dependency-free Node suite | 83 passed locally; release CI successful | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38361101971 |
| Built-client Chromium suite | 35 passed, zero failed | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38361102002 |
| Pages deployment and exact-build smoke test | Successful; public marker independently matched | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38361101950 |
| Both Supabase Edge Function type checks | Successful | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38361101982 |
| Public Auth health/provider diagnostic | Successful, limited to public endpoints | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38361101968 |
| Private Weekwise project access | Not available through the connected Supabase account | Its project inventory does not contain the configured Weekwise project `iajkzlsurghfvsmqkmut`; no unrelated project queried or changed |

Automated browser tests use isolated synthetic records/mock cloud accounts. The public Auth probe does not establish private RLS or provider round-trip behavior.

## Work already delivered

- Core data-preserving planning, recovery previews, guarded application and Undo; measured focus and habit history; Today/Inbox/Plan/Calendar/Insights; responsive light/dark UI.
- Owner-scoped editor draft recovery and editor-history export; paged list/board/matrix/filter rendering while keeping full search, counts and exports.
- Sunday/Monday **Month/Year grid** preference. Weekly planning/storage still uses Sunday boundaries.
- Reviewed atomic iCalendar import with IANA TZID conversion and explicit DST ambiguity/gap rejection.
- Opt-in descriptive recurring-series propagation with customized/completed occurrences protected. This does not bulk-change saved occurrence schedules or cadence.
- Optional account-isolated onboarding, modal keyboard containment and launcher focus return.
- Unioned daily scheduled workload, recorded recovery history and task-linked focus-versus-estimate Insights.
- Waiting-PWA update protection for unfinished editors, capture and weekly reviews.
- Automated pinned axe WCAG A/AA checks for serious/critical findings; reports retain inconclusive results for review.
- Flexible 1–7 check-ins/week habit targets with preserved legacy weekday schedules and check-ins.

## Remaining work, in priority order (updated after PR #33)

| Work | Concrete missing behavior or evidence |
|---|---|
| Calendar and planning zones | Date-aware IANA Calendar projection and Monday-first planning are delivered in PR #33. Planner availability/editor fields still use the saved source zone; arbitrary planner-zone conversion remains; explicit overnight editing is included in the follow-on reliability review. |
| Account lifecycle | Task archive/remove/recovery and recurring schedule preview/Undo are delivered in PRs #31/#32. Account-erasure source/UI is now implemented, disabled until correct-project staging and cascade verification. No automatic retention purge. |
| Calendar and offline reliability | Calendar movement focus/stale-pointer handling, swaps and saved-account offline opening are implemented in the follow-on review; final remote checks remain. |
| Architecture and performance | Narrow pure/UI modules and bounded timezone derivations delivered; the app IIFE remains large. PR #29 lab metrics merged. Real-use field CWV and further profiling remain. |
| Private cloud/security acceptance | Access to the correct Weekwise staging project/test identities; own-row/cross-user RLS, invitation enforcement, token expiry and real-device offline reconnect. Optional RPC hardening requires reviewed database authorization. |
| Optional integrations | Real OAuth/provider consent, calendar create/update/delete/conflict/refresh, VAPID/scheduler and closed-app push acceptance; optional AI needs an explicitly configured provider and privacy decisions. |
| Human/release certification | Real phone keyboard/rotation, 200% zoom, screen readers, installed-PWA updates/interrupted installation and representative historic private backups in isolated profiles. |

No production Supabase migration, real user-data deletion or provider activation was performed. Account erasure remains disabled by default and requires the gates in [ACCOUNT_ERASURE_SETUP.md](ACCOUNT_ERASURE_SETUP.md). Existing GitHub release authorization permits checked frontend releases. The 32-section master plan remains **partially complete**, with the exact limitations above.

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

Six pure tests cover midnight, DST, incremental occupancy, future all-day reservations, precise minutes and a 10,000-record canonical fixture. Two built-client scenarios cover daily overnight repetition/reload and a Berlin spring gap followed by a valid next day. Combined Node suite: 140 passed locally; remote browser/Edge/release checks remain required. The public browser and existing push/calendar source imports are now pinned to the same verified Supabase JS 2.117.3 used by account erasure, avoiding floating minor-version changes. No backend is deployed by this source change.
