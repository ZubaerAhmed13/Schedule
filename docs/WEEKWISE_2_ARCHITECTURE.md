# Weekwise 2.0 architecture — first increment

The existing app remains buildless HTML/CSS/JavaScript, served from the root under `/Schedule/`. No framework, bundler, backend migration or new runtime dependency is introduced.

## Modules

- `index.html`: existing IIFE owns canonical state, editor, views, integrations, recurrence and utilities. The initial refactor is deliberately bounded; this file still needs gradual decomposition.
- `js/weekwise-data.js`: standalone validation, legacy-compatible backup parsing, checked storage transactions and conservative sync-status labels. Does not filter user records or contact a service.
- `js/weekwise-planning.js`: deterministic pure interval/capacity/scheduling functions and immutable selected-plan application. Shares only the validator dependency; independently exercised in Node.
- `js/weekwise-plan-ui.js`: Plan screen. Depends on a narrow bridge for snapshots, account identity, checked persistence and opening an existing task editor. Recommendations do not modify storage.
- `css/weekwise-plan.css`: additive responsive green design tokens scoped to Plan, including body-based dark theme. Existing styles are retained pending screenshot-led consolidation.
- Existing `weekwise-calendar.js`, `weekwise-push.js`, Supabase functions and SQL remain intact.

## Data flow

Capture/editor → canonical weekly records → shared views / read-only Plan snapshot → scheduling proposal → user-selected acceptance → checked single-key local transaction → existing revision-aware cloud queue.

The planner adapter snapshots the current in-memory task array together with persisted weeks. Before a plan write it checks the full planner snapshot, current account, blocked-storage flag and cloud conflict. All selected task moves are performed on a clone, validated, persisted, then installed in memory. User IDs and full record details remain stable.

Undo keeps the prior planner snapshot in memory and requires the current planner to match the post-plan fingerprint. Any intervening planner edit pauses Undo rather than overwriting newer work. The pre-plan checkpoint persists separately for manual recovery after reload. Reminders/habit/focus collections are not part of a plan transaction and are never rewound by plan Undo.

## Compatibility

Canonical storage remains `weekwise-planner-v2`; cloud payload version remains 1; backup envelope remains version 6. Additive task field `schedulingMode` is flexible/fixed/optional. Planning preferences live under `store.settings.planning`. Existing `focusEstimateMinutes` provides explicit estimates; automatic capture duration is not assumed to be an estimate. Older data can omit both fields.

Existing completed, fixed and non-custom records are retained. Existing recurring occurrences are not re-materialized over their saved fields. Editing a recurring series retains the existing explicit future-occurrence reset path.

## Deployment and limitations

Relative asset paths support GitHub Pages. Cache generation v76 includes new modules/CSS. Service worker does not replace its offline HTML with a failing HTTP response. A comprehensive atomic PWA upgrade protocol and offline auth/local-use UX remain pending. New checks parse each new module and CI retains planning screenshots. Do not claim comprehensive offline reliability from cache code or Node tests.
