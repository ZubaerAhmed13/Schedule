# Weekwise 2.0 release gates

Current release checklist. Source/test success alone is not verification of external integrations, private database permissions, real devices or human accessibility. The GitHub Pages build is separately deployed and smoke-tested.

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

## Progressive onboarding and dialog accessibility release gate

- [ ] Node: guide preference remains account-isolated, optional and safe if localStorage fails.
- [ ] Chromium: guide appears for empty planner, dismissal persists, Settings can reopen it, and navigation works without adding tasks.
- [ ] Chromium: task/utility dialog Tab wrap and Shift+Tab, real launcher focus return and no nested dialog role.
- [ ] Verify narrow screens and PWA cache include guide script; no data-model, cloud, invite or session changes.
- [ ] Human WCAG 2.2 AA, 200% text resize, screen-reader/TalkBack/VoiceOver, phone keyboard and installed-PWA reviews remain separately required.

## Scheduled workload / stability insight review

- [ ] Node: overlapping fixed and flexible scheduled intervals are unioned, overnight spill is shown on both relevant days and previous-week spill into Sunday counted; all-day/unscheduled entries excluded.
- [ ] Node: recorded recovery count deduplicates history; only timer-linked focus with explicit task estimates enters comparison, no actual time invented.
- [ ] Built-client browser: 7-day workload is legible on desktop and small phone; legends distinguish scheduled hours, logged focus and estimates.
- [ ] Confirm unrelated completion/habit metrics and weekly reflection persist unchanged.
- [ ] Historical manual edits without reschedulingHistory are deliberately not counted as recorded recovery moves.

## Service-worker update handoff regression

- [ ] Node and Chromium: update initiation blocked while task/template/utility editor, quick capture or unsaved weekly review is active.
- [ ] Once draft/review is saved or closed, update becomes eligible without clearing planner storage.
- [ ] Existing device-only offline create/reload, account isolation, browser and Edge checks remain green.
- [ ] Actual installed-PWA update, interrupted installation and mobile standalone lifecycle are still real-device certification gates.

## Automated accessibility quality gate

- [ ] Run pinned `axe-core` WCAG 2.0/2.1/2.2 A and AA checks on the built Chromium Today, Settings, Plan and task editor views; block serious and critical findings.
- [ ] Save the full violation and inconclusive-check summary as a CI artifact; manually triage moderate and needs-review items.
- [ ] Confirm keyboard focus restoration, text scaling/reflow and actual phone screen readers independently. Automated axe results are not proof of full WCAG 2.2 AA conformance.
