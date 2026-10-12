# Weekwise 2.0 validation report — 12 October 2026

Verified implementation commit: `92b2d14373c9081bf0fbc4a5ea2b488ee2e6c779`.
Draft review: https://github.com/ZubaerAhmed13/Schedule/pull/16.

| Check | Result | Evidence |
| --- | --- | --- |
| Dependency-free Node behavior/contract suite | 55 passed | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38302083953 |
| Release sanity, syntax, manifest and build | Passed | Same release run |
| Built-client Chromium regressions | 22 passed | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38302083912 |
| Supabase calendar/push Edge Function Deno checks | Both passed | https://github.com/ZubaerAhmed13/Schedule/actions/runs/38302083901 |
| Light/dark responsive screenshots | Generated and visually reviewed | Browser run artifact at 1440/820/390px |
| Source diff whitespace | Clean against baseline | Local `git diff --check origin/main` |

The final follow-up normalizes editor field layout, adds editor screenshot capture and records this report. Its current check status is available in the PR; do not assume a later source change inherits earlier test results automatically.

## Browser coverage

Calendar Day/Week/Month/Agenda/Year identity; editor save/reload/unsaved-state behavior; mobile overflow; honest unconfigured calendar state; planning preview purity, selected apply, guarded Undo and reload; unknown estimates; legacy/non-custom and recurring exception preservation; corrupt primary/auxiliary bytes; invalid and valid confirmed restore; persisted focus pause/reload/partial finish; account isolation; linked splitting; keyboard containment; weekly-review persistence; actual service-worker offline capture/reload; quota failure; interpreted capture review; two-device revision conflict; recurring cross-week recovery; dark responsive layouts; stale local-tab protection.

Tests use synthetic records and isolated mock Supabase identities/rows. They never write the live project. The offline test blocks external requests and uses a real service worker. No local Chromium is available in this workspace; browser QA runs in GitHub CI.

## Findings resolved

- Startup filtering deleted legacy/non-custom records; canonical records are retained.
- Calendar lane calculation mutated saved records; rendering uses copies.
- Delayed editor focus stole note input; focus is set synchronously.
- Calendar controls leaked into Plan after rendering; visibility is gated by workspace.
- Background timer counters drifted; persisted timestamps now exclude pauses.
- Startup queued clean snapshots and forced a calendar view; no-op writes are skipped and preference is retained.
- A single-listener auth fixture did not match Supabase semantics; independent listeners are retained.
- Same-tab direct writes left checked baselines stale; normal saves use the checked writer.

## Performance evidence

`node scripts/benchmark-planning.mjs` uses dense synthetic commitments/backlog. In this workspace, Node v24 produced median scheduling times around 8, 37 and 56 ms for 1,000, 5,000 and 10,000 records. The conflict sweep avoids quadratic active-pair enumeration. Hidden calendar/board/matrix/filter views are not unnecessarily rendered in the main refresh path. These results do not measure visible-list rendering or browser Core Web Vitals.

## Unverified release requirements

Real private test-account RLS/invite/token-expiry/reconnect behavior; staging execution of optional RPC hardening; production OAuth and closed-app push; actual mobile keyboard/installed-PWA upgrades; human screen-reader/contrast/zoom review; real historical backups; large visible-list browser benchmarks; arbitrary fixed-zone conversion and configurable week start. See RELEASE_CHECKLIST and UPGRADE_PROGRESS. Main, live deployment and production SQL remain unchanged.

## Follow-up browser and privacy export checks — 12 October 2026

- PR #17 head `adcc3cb5bf75069c43814267a9056f1d550fc9b9`: 25 browser checks passed. Large synthetic list measurements: 1,000/5,000/10,000 records navigated to paint in 37/158/240 ms with 100 visible task rows (CI/browser only): https://github.com/ZubaerAhmed13/Schedule/actions/runs/38305283260.
- PR #18 implementation `5c57ccb13c29e226c3ff353bedf6232f10593564`: all 26 browser checks passed, including downloading a private, owner-scoped editor history archive without mutating draft records: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38307145282.
- Release/Node checks: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38307144930. Supabase function type checks: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38307144917.

These checks validate isolated local fixtures and code. They do not verify production database privileges, external OAuth, closed-app push, installed PWA updates, manual accessibility, historical private data or real-device performance.
