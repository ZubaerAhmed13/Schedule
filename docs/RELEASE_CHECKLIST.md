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

- [ ] Verify the new Month/Year Sunday-vs-Monday display order using Node and built-client browser tests on the final PR commit.
- [ ] Verify task weeks and recurring occurrence IDs are unchanged when switching grid preference; weekly planning remains Sunday-canonical.
- [ ] Keep arbitrary fixed IANA zone conversion and full Monday-canonical week migration blocked pending a separate, tested migration design.

## 13 October 2026 — TZID and atomic import review branch

- [ ] Node conversion tests: Europe/Berlin, America/New_York, Asia/Kolkata, DST fold/gap, leap years and invalid zone.
- [ ] Built-client import test: preview cancellation keeps identical planner bytes, accepted import uses exact local clock, ambiguous DST event skipped, duplicate UID does not create another task.
- [ ] Static build caches the new time-zone module and still passes offline browser regression.
- [ ] Browser and CI checks pass at the exact reviewed head SHA.
- [ ] Real provider OAuth, full app timezone selection and recurrence ICS ingestion remain separate release gates.
