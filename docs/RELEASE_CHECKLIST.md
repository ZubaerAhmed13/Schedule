# Weekwise 2.0 release gates

Review branch only. A passing source/test suite is not a production deployment or external-integration verification.

## Implemented checks

- [x] Audit exact baseline and retain a separate development branch.
- [x] Preserve canonical keys, stable IDs, completed history, legacy/non-custom data, recurring exceptions and unknown fields.
- [x] Protect damaged planner/auxiliary data and checked restore/checkpoint behavior.
- [x] Planning/recovery/splitting require explicit acceptance; stale, conflicting and infeasible changes are rejected.
- [x] Persist focus timestamps, pause semantics and partial records; separate account caches and device-only mode.
- [x] Dependency-free tests, syntax/release checks and deterministic frontend build pass locally.
- [x] Existing browser/calendar/editor and added offline/account tests passed on the intermediate candidate.
- [x] Expanded remote browser workflow exercises valid restore, recurring recovery, two-device conflict, stale local tabs and responsive dark views; inspect latest PR status before release.
- [x] Both Supabase Edge Functions type-checked on intermediate candidates; inspect final PR check.
- [x] Light/dark desktop/tablet/phone screenshots generated and visually reviewed.
- [x] Frontend-only deployment output with matching versioned JS/CSS and service-worker shell.
- [x] Optional RPC hardening/privilege diagnostic prepared without production execution.

## Required before claiming production readiness

- [x] All 55 Node tests, 22 browser tests and both Edge checks pass at 92b2d14; inspect the final follow-up/released commit separately.
- [ ] Human keyboard/screen-reader, contrast, 200% zoom and actual phone-keyboard review.
- [ ] Installed-PWA upgrade, standalone layout and interrupted install review.
- [ ] Actual historical user/backup upgrade in an isolated profile.
- [ ] Private test-account RLS/invite/token-expiry/reconnect and real device verification.
- [ ] Stage and authorize optional RPC hardening; ensure direct authenticated writes are revoked and legacy clients still save.
- [ ] Provider OAuth round trip and configured Google/Outlook integration, if enabled.
- [ ] Closed-app Web Push delivery/expiry/unsubscribe tests, if enabled.
- [ ] Measured browser performance for large visible lists; no unsupported Core Web Vitals claims.
- [ ] Fixed-zone/week-start migration design if those preferences are introduced.
- [ ] Review and authorize merge/Pages release.
- [ ] After release, verify `build-info.json` matches the exact commit/run and review installed-client updates.

Never expose OAuth/VAPID/service-role/AI secrets in browser code. Never run production SQL, merge or deploy merely because a source check passes.

## Additional privacy-export gate

- [x] Editor-history export preserves current/archived and malformed drafts while excluding other owners. Node/release CI passed: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38307144930; 26 built-client browser tests passed: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38307145282.
- [x] UI and README warn that exported JSON contains sensitive plaintext; export leaves local archives unchanged (browser assertion). No automatic deletion is implemented.

## Calendar display safety

- [x] Month/Year Sunday-vs-Monday display order tested with Node/Chromium on PR #19 and deployed at dd372f38; 27/27 browser tests passed.
- [x] Switching grid preference leaves task week bytes unchanged in browser regression; weekly planning remains Sunday-canonical.
- [ ] Keep arbitrary fixed IANA zone conversion and full Monday-canonical week migration blocked pending a separate, tested migration design.

## 13 October 2026 — TZID and atomic import review branch

- [x] Unit conversion tests cover Europe/Berlin, New York, Kolkata, DST folds/gaps, leap years and invalid zones. PR #20 Node suite passed.
- [x] Built-client import test covers preview cancellation, confirmed atomic save, correct timezone conversion, ambiguous DST rejection and duplicate UID. PR #20 browser suite passed 28/28.
- [x] Versioned Pages shell includes timezone module; offline browser regression passed with PR #20.
- [x] PR #20 reviewed head passed Node/browser/Edge checks; post-merge main Pages and Chromium workflow succeeded at 96d0dbc3.
- [ ] Real provider OAuth, full app timezone selection and recurrence ICS ingestion remain separate release gates.

## Safe bulk recurring edit review

- [x] Recurring bulk unit tests protect customized/completed tasks, immutable previews, stale originals and time/reminder/history fields; Node suite passed 74/74.
- [x] Browser tested opt-in preview, future propagation, stable identity and unchanged time/alert fields; 29/29 on post-merge main at ea6573c0.
- [x] Browser regression/isolated cloud/offline fixtures passed, 29/29 on deployed main ea6573c0.
- [ ] Changes of dates, recurrence cadence, deadlines or scheduled times on previously materialized activities remain outside bulk metadata scope.

## Release evidence — 13 October 2026

The latest merged feature set is at `ea6573c08433ec6995feb6740968b7944ea4cb21`, PRs #16–#21 merged. Deployment smoke-test: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38354337641. Post-merge Chromium: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38354337738 (29 passed, 0 failed). Release/unit suite: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38354337745 (74 passed, 0 failed). Public Auth probe: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38354337747. Edge Function type checks: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38354337801.

**Not certified:** No verified private Supabase RLS/invite test accounts; no external OAuth/Web Push round trip; no real installed-PWA upgrade, screen-reader/zoom, historical private-data migration or field Core Web Vitals measurement. These gates are tracked in [issue #22](https://github.com/ZubaerAhmed13/Schedule/issues/22).
