# Weekwise 2.0 repository audit

Audit date: 2026-10-12. Baseline: `dc5167a299fc1f9cd00fe889619dd8a6ef335b4c` (main). Initial working tree clean. Development branch: `codex/weekwise-2-foundation`. No production database or deployment changes authorized or made.

## Evidence and limits

- `node scripts/validate-weekwise.mjs`: all baseline sanity checks passed.
- `node --test tests/*.test.mjs`: 14/14 baseline tests passed.
- Existing browser suite attempted: first could not resolve Playwright; after linking the preinstalled runtime, Chromium executable was absent. No local browser assertions or baseline screenshots completed. Do not mistake the browser launch errors for application assertions.
- GitHub Actions fetched on audit date: release, browser regression, Supabase function checks, public Auth diagnostics and Pages deployment all succeeded for the exact baseline commit. Pages workflow checks build commit/run identity. This is remote baseline evidence, not verification of new changes or private backend operations.
- No Deno executable in this environment. The baseline function type checks passed remotely; they have not been rerun locally.
- No user storage, account, production SQL, provider secret, or push subscription inspected or changed.

## Feature inventory

“Working and verified” below means the named regression passed, not exhaustive certification. Browser baseline evidence refers to the GitHub run at the audited commit.

| Capability | Status | Evidence / qualification |
|---|---|---|
| Task create/edit, unsaved-change protection, persistence | Working and verified | Baseline browser lifecycle regression in GitHub CI |
| Day/Week/Month/Agenda/Year linked records | Working and verified | Cross-view browser regression in baseline CI |
| Mobile calendar width | Working and verified | Existing narrow-screen test in baseline CI; no tablet/landscape screenshots |
| Today/Tomorrow/Inbox/Upcoming, projects/folders/tags | Implemented but not fully tested | Shared workspaceRecords and rendering; Today has summary cards |
| Custom lists, Kanban, filters, priority matrix | Implemented but not fully tested | Existing shared-record UI paths; limited runtime coverage |
| Subtasks, due dates, multiple reminders, attachments/templates | Implemented but not fully tested | Editor fields and persistence exist |
| Recurrence and exceptions | Partially implemented | Materialization currently overwrites existing occurrences on reload |
| Habits and check-ins | Implemented but not fully tested | Separate history store; weekly targets, streaks, editing |
| Focus sessions | Partially implemented | Timestamp deadline while open; active session state not persisted through reload |
| Countdowns and statistics | Implemented but not fully tested | Existing utility panels; duration metrics do not establish actual work |
| Natural-language capture | Partially implemented | Rule parser supports dates/times/recurrence; interpretation confirmation incomplete |
| JSON backup | Partially implemented | Version 6 export; restore lacks size/schema safeguards, confirmation, rollback |
| ICS import/export and list transfer | Implemented but not fully tested | Distinct file paths, bounded list import; comprehensive fixtures missing |
| Local/offline app | Partially implemented | Shell cache; startup filtering and corrupted-store fallback risk data loss |
| Auth, invite policy, cloud sync | Requires external configuration | Public Auth diagnostics passed; private RLS/live account round trips not verified |
| Revision-aware cloud saves | Working and verified | Four behavioral Node race/conflict/failure regressions; not real two-device testing |
| Account isolation | Partially implemented | Same shared local keys and async account transitions need dedicated testing |
| Google/Outlook calendar | Requires external configuration | Contract checks pass; OAuth/token storage code and setup docs; no real provider round trip |
| Browser foreground reminders | Implemented but not fully tested | Permission and delivery loop exist |
| Background Web Push | Requires external configuration | Contract checks pass; no closed-app delivery evidence |
| Light/dark/reduced motion | Implemented but not fully tested | Several accumulated CSS layers; full contrast audit missing |
| Smart Week Builder / recovery planner | Missing | Existing findSlot is a per-day helper, not capacity-aware weekly planning |
| Planned vs recorded actual review | Partially implemented | Focus history exists; general actual work not measured |
| Accessible dialogs / keyboard calendar parity | Partially implemented | Labels and ARIA present; focus containment and full keyboard QA incomplete |

## Architecture

Buildless GitHub Pages app. `index.html` is 447,595 bytes, 4,094 lines with about 1,065 lines of layered CSS and a large IIFE that owns task views, editor, persistence, recurrence, auth, import/export and utilities. `weekwise-calendar.js` and `weekwise-push.js` use bridges into that IIFE. No application build system or package manifest. Node tests are dependency-free except browser tests; CI installs pinned Playwright.

Canonical store: `weekwise-planner-v2`, settings, Sunday-keyed weeks, recurringTemplates and customLists. Tasks are stored per week with stable id/day/start/duration. Independent local keys hold reminders, habits, focus, countdowns, filters, templates and sync metadata. Cloud payload version 1 groups these stores in one revisioned JSON record. Backup version 6 is a different envelope. Preserve both.

## Highest-priority risks

1. **Critical — automatic record removal.** `removeAutoPopulatedSampleData` deletes title-matched batches at startup. `loadWeek` filters all records except `custom === true`, dropping legacy/fixed/completed records. These heuristics cannot prove records are unwanted. Disable deletion; preserve metadata and identifiers.
2. **High — corrupt-store overwrite.** Failed JSON parsing silently returns an empty store. Startup then saves it. Preserve original bytes and block planner writes/cloud upload until user-directed recovery.
3. **High — recurrence overwrite.** Materialization Object.assign replaces existing notes, start, subtasks, reminder timing and recurrence exception details. Preserve existing occurrences; editor series changes already use clearFutureOccurrences intentionally.
4. **High — restore validation/atomicity.** loadImport accepts any settings/weeks pair and writes several keys incrementally. Add bounded validation, user confirmation, a pre-restore checkpoint and rollback on failed writes. Reject unsupported future backup versions and malformed records before mutation.
5. **High — sync status truthfulness.** setCloudStatus derives badge from cloudReady, so failures/conflicts may still show Synced. Distinguish actual operation state and verify with behavior tests.
6. **High — private backend verification incomplete.** RLS scripts use auth.uid and revision locking, but direct authenticated table writes are also granted. Run live account isolation and concurrent-device tests before claiming production readiness. Do not alter production SQL in this pass.
7. **Medium — mixed-version PWA shell.** Network-first HTML plus cache-first external JS can combine revisions. Any module extraction must add shell assets and explicit release/cache versioning; stronger upgrade protocol is still required.
8. **Medium — date correctness.** Sunday-based local calendar dates, same-day editor limits, fixed 86,400,000-millisecond countdown differences and timezone/DST imports need boundary tests.
9. **Medium — storage write failures.** Several persistence routines catch errors but callers display success. Do not use them for new plan transactions without checked durable writes.

## UX / performance / security

- Navigation exposes many features at equal prominence; add Plan incrementally before broader reorganization, keep old views and deep links.
- Today cards and quick capture exist; no availability capacity or realistic feasibility information yet.
- Styling has multiple competing visual generations and branding colors. Extracting CSS unchanged is safer than a bulk rewrite, then converge tokens gradually with screenshot QA.
- Multiple render paths scan all records and recurrence materializes 90 days repeatedly. Preserve data first, then measure large-data behavior before claiming speed improvements.
- Many user strings are escaped; imports and dynamic HTML still require dedicated malicious fixture tests. Supabase CDN @2 floats; no complete CSP or dependency security review yet.
- Provider token/subscription tables are server-only in repository SQL and secret-bearing backend operations are confined to Edge Functions. Contract tests are not a penetration test or verification of deployed RLS.
- Login landing hides local app without a session despite the local/offline capability; optional local-use onboarding needs careful separate design.

## Reuse

Keep canonical weekly task records, existing editor and lists, cloud revision mechanism, recurrence rules/exclusions, reminder/focus/habit stores, JSON/ICS formats, integration bridges, SQL and Edge Functions, manifest shortcuts, existing CI tests. No framework migration is justified yet.

## Prioritized implementation sequence

1. Phase 1: independent tested data-validation module; stop automatic deletion; protect corrupt data; preserve saved occurrences; safe legacy-compatible restore; honest sync badge; add missing local module validation to release checks.
2. Planning foundation: independent deterministic interval/capacity engine with overlap union, planning hours, breaks/buffer, deadlines, missing estimates, no overlaps and impossible-workload tests. No data mutation in recommendation generation.
3. First Plan workflow: editable availability, real task preview, selected acceptance, stale/account guards, checked persistence and guarded undo. Exclude recurring, all-day and externally owned tasks until their move semantics are explicitly implemented.
4. Phase 2: navigation / Today / editor redesign, style consolidation, mobile screenshots, keyboard/accessibility audit; no working features removed.
5. Phase 3 completion: recovery, preference windows, multi-window availability, splits, recurring occurrence rescheduling, timezone/DST UX.
6. Phases 4–6: measured insights, persisted focus state, full offline/account isolation/restore E2E, private backend and provider verification, performance measurements and release gate.

## Rollback

Keep main at the baseline until reviewed. Review this branch via PR; never force-push or merge automatically. Revert the upgrade commit before deployment if needed. No storage key rename or SQL migration is required by the initial work. Export a version-6 backup before manual restore or production upgrade. Keep the recovery checkpoint and raw corrupted bytes when present. Older builds contain destructive startup heuristics, so downgrade only after exporting data and verifying a copy in an isolated browser.
