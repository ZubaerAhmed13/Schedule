# Weekwise — calm navigation and notification research (30 October 2026)

Scope: **only** progressive everyday navigation and notification controls. No changes to task IDs, scheduling, saved task records, backup envelopes, authentication, or calendar providers.

## Research and feature decisions

| Feature | Existing Weekwise | External comparison | Decision |
| --- | --- | --- | --- |
| Everyday actions visible | Five primary views and Search already visible; other views use collapsible groups and advanced editor details | NN/g recommends progressive disclosure. Todoist supports sidebar customisation, TickTick keeps secondary task controls behind expandable UI | **Preserve this working navigation model.** Restore the visible Add task label on desktop only; avoid a costly and disruptive rebuild |
| Quiet hours | Off/5/15/60-minute lead times; no quiet-hour suppression | Google Calendar supports per-calendar alerts and desktop snooze; browsers leave some notification behavior up to the OS | **Add opt-in quiet hours** in saved planner time zone. Suppress alerts originating during quiet hours, with no silent later replay. Explicit reminders are included; custom times and identifiers are not mutated |
| 10-minute snooze | No snooze from an in-app alert | Google Calendar desktop has snooze; Todoist mobile has snooze, but not its web/desktop app. Notification actions vary by browser | **Add only a truthful foreground snooze.** Keep Weekwise open; do not promise app-closed re-alerts. Never snooze an automatic notification past its activity start |
| Grouping | Per-event tags; different times on one task can stack multiple system cards | Browser notification tags can replace prior cards without changing task data | **Group repeated notification cards for the same activity by default**, with an opt-out. Separate activities remain separate. This is card grouping, not bundling unrelated events |
| Category defaults | One global lead time and task-specific explicit overrides | Google Calendar allows default alerts per calendar and per-event override | **Offer advanced optional category defaults** in a closed section. Exact task reminders always win; categories inherit global timing by default |

Research sources:
- Nielsen Norman Group, progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Todoist sidebar: https://www.todoist.com/de/help/todoist/features/customize-the-sidebar-and-navigation-menu-in-todoist-S9JLTYqZV
- TickTick quick entry: https://help.ticktick.com/articles/7055782422935240704
- Google Calendar notification settings: https://support.google.com/calendar/answer/37242
- Todoist reminder snooze: https://www.todoist.com/help/todoist/features/introduction-to-reminders-9PezfU
- MDN notification tags, actions and browser differences: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification

## Explicit contracts

- Existing settings remain valid; new preferences are optional and default to existing behavior, except that repeated alerts for the same activity can now replace previous notification cards.
- Custom manual task reminders override both global and category defaults.
- Quiet hours use the saved planner zone, not the device clock. Start and end are inclusive/exclusive, including midnight-spanning windows. Equal/invalid enabled quiet times are rejected.
- Quiet hours suppress both foreground and background task alerts before receipt/delivery claims. Alerts originally scheduled within quiet hours are not replayed later; an overdue alert scheduled before quiet hours can still catch up afterwards. Tasks themselves remain unchanged.
- Snooze entries are local to the current planner owner, bounded to 50, never included in canonical task records, and acted on only while Weekwise runs. Closed-app push snooze is **not** implemented because a system action without server rescheduling would mislead users.
- Grouping uses owner+task notification tags for successive alerts; it does not fuse separate task reminders or alter delivery log entries.
- Account changes and blocked planners prevent emitting snoozed reminders for the prior owner.
- The updated frontend **and** weekwise-push Edge Function must both be deployed for quiet hours and category rules to apply to background push. Do not publish frontend only.

## Verification

Run Node reminder policy/delivery regressions, browser notification settings and accessibility suites, full release/build checks, PostgreSQL contracts, Deno edge checks, and cross-browser device tests. Review light/dark screenshots. After merge and paired backend deployment, perform real-device permission and app-closed tests; those cannot be inferred from CI. Do not claim native snooze or OS delivery guarantees.
