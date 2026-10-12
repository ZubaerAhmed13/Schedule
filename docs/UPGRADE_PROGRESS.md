# Weekwise 2.0 upgrade progress

## Phase completed

Phase 0 repository audit and protection planning completed. Phase 1 first engineering increment implemented. An initial Phase 3 Smart Week Builder beta is integrated; the complete Phase 1 refactor and Phases 2–6 are not finished.

## What improved

- Removed title-based startup deletion and custom-only week filtering; retain every validated record and week field.
- Corrupt planner data pauses saving/cloud upload and offers original-byte recovery.
- Existing recurring occurrences retain edited fields/history on reload.
- JSON restore validates input before mutation, requires confirmation, retains a checkpoint and rolls back local writes on failure.
- Sync badges distinguish failed, pending, review and confirmed success states.
- New Plan screen previews capacity/placements using real records, selected approval, single-key checked persistence and guarded Undo.
- Scheduling behaviors added to the editor; existing explicit focus estimate is reused rather than inventing a duration.
- New modules, scoped responsive styles, release checks and regressions preserve the buildless GitHub Pages architecture.

## Important files

`index.html`: bounded data safety fixes, additive Plan markup/editor fields and bridge.
`js/weekwise-data.js`: validation/storage/checkpoint/status.
`js/weekwise-planning.js`: pure deterministic capacity and schedule engine.
`js/weekwise-plan-ui.js`: preview, selection, apply and guarded Undo.
`css/weekwise-plan.css`: green responsive Plan components and dark theme.
`sw.js`: v76 shell additions and failed-HTTP cache protection.
`tests/*`, browser CI and release validator: behavior/regression checks and screenshots.
All seven requested architecture/audit/planning/design/data/release/progress documents are present; README includes running/testing guidance.

## Existing features preserved

No removal of task views, projects/folders/tags, board/filters/matrix, calendars, recurrence rules/exclusions, reminders, habits, focus, countdowns, file imports/exports, integration code or invite enforcement. Node cloud race/conflict and calendar/push contracts pass. Existing browser tests remain; new branch CI must verify calendar/editor/mobile regressions. Production source and database are unchanged until review.

## Tests performed

Baseline: sanity checks passed and 14/14 Node tests. Baseline GitHub release/browser/Edge type-check/Auth-diagnostic/Pages runs succeeded at dc5167a.
After implementation: sanity checks, 36/36 Node tests, browser test syntax check and git whitespace check pass locally. Local Playwright launch blocked: Chromium binary absent. No local visual screenshots or Deno run. New browser tests cover preview purity/selected acceptance/Undo/reload, 1440/820/390px layout, unknown estimates, legacy and occurrence history, corrupt storage and invalid backup. Browser screenshots are retained in CI artifacts when generated.

## External setup required

No new backend setup for the Plan beta. Real Supabase/test-account, provider and push verification remain separate work; follow existing INTEGRATION_READINESS, CALENDAR_OAUTH_SETUP and BACKGROUND_PUSH_SETUP docs. Do not change production SQL/provider settings or deploy without authorization.

## Known limitations

Beta uses one daily availability window/device local time, date-only deadlines and focus estimates. Existing scheduled/recurring/all-day tasks are never moved. Recovery, splitting, focus preferences, manually adjusted previews, separate estimated calendar duration and arbitrary timezone preference are unfinished. Auxiliary-store corruption, cloud account races/atomic remote restoration, full PWA update behavior, auth-gated offline UX, full-app visual redesign/accessibility and measured browser performance remain open. A shared recovery checkpoint is local-only and not encrypted.

## Next priorities / continuation checklist

1. Read CI results and fix any actual regression; inspect desktop/tablet/mobile screenshots.
2. Add browser coverage for valid restore, stale preview/Undo and storage-quota refusal; exercise offline PWA and light/dark keyboard flows.
3. Protect auxiliary stores and account switching/in-flight auth saves; strengthen cloud application atomicity and status events.
4. Extract legacy CSS/view modules in small tested increments; redesign main navigation and Today with existing features retained.
5. Complete planner constraints: user availability windows/focus periods, separate estimated calendar duration, recurrence-safe move semantics and Recover My Week.
6. Implement persisted active focus timing and measured insights, then conduct private backend verification, security/a11y/performance/release work.

This is a concrete incremental upgrade, not a finished premium-product release.

## Publishing blocker

The source is committed on the local development branch. Automatic approval review rejected the attempted GitHub push because uploading changed source to the public repository requires explicit authorization. The remote branch and PR were not created; no new remote CI ran. Main, GitHub Pages and production databases remain unchanged. The downloadable review package contains a Git patch series and the documentation so the work remains reviewable while authorization is pending.
