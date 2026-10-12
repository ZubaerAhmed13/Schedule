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

- [ ] Final PR checks green on the released commit.
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
