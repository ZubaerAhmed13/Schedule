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

## Remaining work, in priority order

| Work | Concrete missing behavior or evidence |
|---|---|
| Large Focus task selection | This branch adds all-record search, 100-task pages, pinned selected/session tasks and owner-reset UI state. Local tests pass; built-client/browser release evidence must be recorded separately. |
| Calendar and planning zones | General fixed-IANA planner rendering/conversion, historical wall-time interpretation, cross-midnight recurrence cases and DST-safe planning migration. The import helper does not finish this requirement. |
| Monday-first weekly planning | A safe cross-week lookup/storage strategy and migration/compatibility tests. Rotating Month/Year headings is already delivered. |
| Recurring schedules | Preview/revalidation for date, time, duration and cadence changes to materialized future occurrences, including customized/completed protection and Undo. Metadata propagation is already delivered. |
| Task and account lifecycle | Full archive/recover/undo-deletion UX and deliberately designed authenticated data/account erasure. No automatic deletion or archive retention sweep is implemented. |
| Architecture and performance | Reduce the remaining large app IIFE and repeated derivations; profile calendars/long recurrence/history; field CWV require real-use evidence. Open PR #29 already covers laboratory metric reporting and is left intact. |
| Private cloud/security acceptance | Access to the correct Weekwise staging project/test identities; own-row/cross-user RLS, invitation enforcement, token expiry and real-device offline reconnect. Optional RPC hardening requires reviewed database authorization. |
| Optional integrations | Real OAuth/provider consent, calendar create/update/delete/conflict/refresh, VAPID/scheduler and closed-app push acceptance; optional AI needs an explicitly configured provider and privacy decisions. |
| Human/release certification | Real phone keyboard/rotation, 200% zoom, screen readers, installed-PWA updates/interrupted installation and representative historic private backups in isolated profiles. |

No production Supabase migration, user-data deletion or provider activation is part of this change. Existing GitHub release authorization permits checked frontend releases. The 32-section master plan remains **partially complete**, with the exact limitations above.

## Focus selector implementation

`js/weekwise-focus-picker.js` provides a read-only derivation over all canonical records. It searches unfinished task titles, notes, folders, sections and tags, then returns at most 100 matching records plus one pinned selection. Search and page changes never edit tasks. A completed or removed task associated with a persisted session stays identifiable by its original week/ID/title; no replacement task is created. Search/page/selection controls lock during active or paused sessions and reset for a different account.

Six Node behavior tests cover 10,000 records, search outside the first page, pinned selection, completion/removal, empty results and index bounds. Two built-client browser tests exercise narrow-screen paging/search, paused reload/completed association, exact logged session identity, full canonical preservation and account separation. The selector script is included in the versioned offline shell. Browser CI remains the release gate.
