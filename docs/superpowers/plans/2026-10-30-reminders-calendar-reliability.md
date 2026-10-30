# Reminders and Calendar Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Configurable automatic reminders for all upcoming activities, distinguishable consecutive calendar events, and resilient reminder controls.
**Architecture:** A pure shared reminder policy derives automatic timestamps without changing activities; frontend delivery records stay device/owner scoped. Existing guarded settings transactions save one preference. A pure presentation helper assigns automatic calendar accents without mutating source records.
**Tech Stack:** Dependency-free JavaScript, Node 22 tests, existing Playwright/axe, Deno/Supabase push.
**Spec:** docs/superpowers/specs/2026-10-30-reminders-calendar-reliability-design.md

## Global Constraints
- Off / 5 minutes before / 15 minutes before / 1 hour before; default Off, all upcoming timed activities.
- Custom task reminders take precedence; retain legacy identifiers and saved instant anchors.
- Preserve manual colours, all saved schedules, account boundaries and unsaved editors.
- Use existing isolated checkout, no new worktree; production deployment is a separate step.
- New client files belong in the explicit offline shell and frontend-only build.

## Review Focus
- Lead-time changes and rescheduling should not produce stale alerts: policy tests pin recomputation.
- Multiple tabs and storage failure should not overwrite planner records: delivery tests pin coordination and local receipt behavior.
- Slow requests crossing account switches must not change the new account's controls: push UI tests pin request epochs.
- DST folds/gaps and midnight must use the saved clock anchors: shared policy tests pin these cases.
- Manual colours and short/overlapping blocks must remain readable: palette and browser tests pin those cases.

### Task 1: Shared reminder policy and background integration
**Files:** create js/weekwise-reminder-policy.js, tests/weekwise-reminder-policy.test.mjs; modify supabase/functions/_shared/reminder-clock.mjs and supabase/functions/weekwise-push/index.ts.
**Interfaces:** WeekwiseReminderPolicy.leadMinutes(value) => 0|5|15|60; reminders(record,settings) => [{value,at,automatic,start}]; due(record,settings,now) => eligible reminders. record={week,task}; at/start are epoch milliseconds; automatic values are ISO timestamps, explicit values remain unchanged.
- [x] Write tests for default/invalid settings, supported lead times, manual precedence/dedup, fixed/recurring events, rescheduling, completed/all-day/unscheduled exclusion, midnight and DST anchors. Run with node --test tests/weekwise-reminder-policy.test.mjs; expect failure before implementation.
- [x] Implement the pure policy using existing saved-zone utilities; export it through the project's global module pattern.
- [x] Derive push records through the same policy and preserve explicit delivery identifiers; automatic records carry their own calculated instant and upcoming-start cutoff.
- [x] Run policy and existing push-clock/contract tests and Deno check; expect pass. Commit this task.

### Task 2: Deterministic calendar accents
**Files:** modify js/weekwise-task-options.js, js/weekwise-app-calendar.js, js/weekwise-calendar-range-ui.js; create tests/weekwise-consecutive-colours.test.mjs.
**Interfaces:** WeekwiseTaskOptions.consecutive(records) => Map keyed by record object with colour name; records carry task,date,start,duration. WeekwiseTaskOptions.attributes(task,displayColour?) preserves old calls and allows derived accents.
- [x] Write tests for chains, exact touching vs gaps/overlaps, manual neighbors, order stability, separate days, and input immutability. Run focused test and see missing-function failures.
- [x] Implement deterministic automatic accents and integrate day/week/range renderings without saving derived metadata.
- [x] Run focused and existing task-options/calendar tests; expect pass. Commit this task.

### Task 3: Settings and safe foreground delivery
**Files:** create js/weekwise-notification-settings.js, tests/weekwise-notification-delivery.test.mjs; modify index.html, sw.js, js/weekwise-app.js, js/weekwise-app-notifications.js, weekwise-push.js, css/weekwise-settings-nav.css; add tests/weekwise-push-ui.test.mjs.
**Interfaces:** notification-settings init(bridge) uses planner snapshot/account/commit; render() refreshes saved state. Foreground policy consumes Task 1 reminders; owner-scoped local receipt storage never edits task notification markers or planner records.
- [x] Write failing controller tests for repeated checks, failed Notification fallback, no planner writes, owner changes and signed-out delivery suppression; write push UI race test.
- [x] Add accessible Settings Notifications section with select and explicit Save, permission and background controls, inline status and custom-reminder explanation. Reuse guarded planner transactions and owner resets.
- [x] Integrate shared policy; coordinate foreground tabs with navigator.locks where available and a bounded localStorage receipt fallback. Use service-worker showNotification where needed, retain toast fallback, recheck ownership after async calls, and never navigate away from an open editor.
- [x] Guard asynchronous push status with account/request epochs and preserve actionable error messages.
- [x] Register modules in source HTML/offline shell and render updates via existing app bridge. Run targeted controller/push tests and existing Node suite; expect pass. Commit this task.

### Task 4: Browser verification and delivery notes
**Files:** create tests/browser/weekwise-reminder-settings.test.mjs and docs/NOTIFICATIONS_CALENDAR_RELEASE.md; update .github/workflows/browser-smoke.yml.
- [x] Add browser tests for settings persistence, save failure, owner isolation, permission refusal, automatic reminder fallback, no duplicates, calendar colours and unchanged saved records. Include light/dark narrow/wide screenshots and axe checks. Watch new behavior assertions fail before wiring any missing integration.
- [x] Build and run the new browser suite, then all existing Chromium browser suites sequentially. Run release validation, all Node tests, all five Deno checks and git diff --check; inspect changed-surface screenshots.
- [x] Document configuration, custom precedence, background function deployment prerequisite, and actual verification limits. Commit implementation and documentation.
- [x] Fresh whole-branch review; reproduce and fix material findings with regression tests. Leave changes local for user review; do not publish.
