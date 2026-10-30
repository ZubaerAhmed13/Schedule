# Reminder timing, consecutive-event colours, and reliability

## Intent and agreed scope

Make Weekwise easier to use as a daily schedule: remind the user before activities, make consecutive blocks distinguishable, and give accurate feedback when notification delivery or saving is unavailable.

The user requested notifications, automatic colour changes for back-to-back activities in a day, and improved reliability/experience. They specifically requested Settings choices of 5 minutes, 15 minutes, and 1 hour before, and chose application to **all upcoming activities** rather than newly created activities only.

## Approaches

1. **One planner-wide lead-time setting applied to all upcoming activities — selected by the user.** Existing and new scheduled activities respond immediately to the chosen lead time without bulk editing their saved records. Rescheduling automatically changes the derived reminder.
2. **Copy the current default into new activities only — not selected.** This would preserve earlier defaults per activity but require editing older activities individually and would not meet the user's chosen scope.

Extend the existing static JavaScript frontend, guarded planner settings transaction, service worker, and Supabase push function. A replacement notification service or frontend framework would duplicate working infrastructure and is unnecessary.

## Proposed user experience

### Notification settings

- A clearly named **Notifications** section in Settings exposes **Automatic event reminders: Off / 5 minutes before / 15 minutes before / 1 hour before**.
- Choosing a lead time applies to all upcoming timed activities in this planner, including generated recurring occurrences and fixed calendar commitments. Completed, archived, all-day, unscheduled, invalid, and uncertain-clock activities do not receive automatic start alerts.
- **Builder proposal:** default to Off until explicitly selected. This preserves existing notification preferences and avoids surprise alerts. Existing custom task reminders continue to work.
- **Builder proposal:** an activity with valid custom reminders uses those instead of an additional automatic reminder. The UI explains this precedence. No custom reminder is rewritten or deleted.
- Save timing through the existing owner-aware, stale-snapshot-protected settings transaction. Confirm only successful persistence; keep the previous setting and show an actionable message when saving is blocked.
- Keep explicit buttons for browser notification permission and background reminder subscription. Do not trigger permission requests simply by visiting Settings or changing timing.
- Show distinct states for allowed/blocked/unsupported browser notifications, background subscription readiness, sign-in requirement, and pending sync. Explain that app-closed reminders require a signed-in, synced planner, an enabled device subscription, and browser/OS permission. Device-only mode supports alerts while the app is open.
- Scheduled reminders use the saved planner time zone and exact saved occurrence instant where available, including DST handling. Changing the calendar display zone does not move alerts.
- **Builder proposal:** automatic alerts catch up only while the activity is still upcoming; do not send a burst for activities that have already started. Existing explicit-reminder catch-up behavior remains compatible.
- A visible alert identifies the activity and its start time. In-app fallback remains available when browser permission is absent. Permission and delivery failures must not claim successful system delivery.

### Back-to-back event colours

- Derive contrasting automatic accents for timed activities where one ends exactly when another starts on the same displayed day. A positive gap does not form a consecutive chain; overlap alone does not form a chain.
- Keep manually selected task colours. Where an automatic event touches a manually coloured event, choose a different automatic accent when possible. Two identical manual choices remain the user's choices.
- Use a deterministic palette and ordering so reloads and view changes do not randomly recolour unchanged schedules. Recompute after schedule changes.
- Apply consistently to relevant day/week and range-calendar event renderings; preserve existing isolated-event category colours, overlap lanes, completion state, labels, and light/dark readability.
- This is presentation only: never save the derived accent into task metadata or change times, categories, recurrence, IDs, or history. Do not rely on colour alone for activity identity.

### Focused reliability and UX improvements

- Share the automatic-reminder calculation between frontend and push dispatch to prevent timing differences.
- Deduplicate automatic/custom alerts at the same instant and repeated foreground checks. Use consistent stable notification tags across foreground and background paths. Prevent accidental duplicate foreground delivery from multiple tabs using an appropriate browser coordination mechanism with a safe fallback.
- Do not mark a system notification as delivered before an accepted notification API call. Preserve usable in-app fallback when the browser API fails.
- Protect notification settings and asynchronous push status from late responses belonging to a previous account or a superseded request. Pending state must not leave controls permanently disabled.
- Do not overwrite unsaved edits or cloud conflicts as a side effect of checking reminders. Reuse existing recovery, conflict and save guards.
- Keep changes focused on reminder delivery, notification settings, and calendar legibility; this is not a general rewrite or an unbounded reliability claim.

## Data and implementation constraints

- Store one allowlisted lead-time preference in planner settings. Missing or invalid values behave as Off. Persist through existing cloud snapshots and backups without changing task records or requiring a database schema migration.
- Share a pure reminder policy module with the existing Deno push function; do not use runtime evaluation, add a framework, or include server secrets in frontend output.
- Preserve legacy manual reminder identifiers and saved time anchors. Use stable, bounded automatic reminder identities compatible with existing push claim/delivery contracts.
- Changing lead time must affect future eligible deliveries, including after rescheduling. Background dispatch sees the latest synced cloud snapshot; describe pending sync accurately.
- Include any new frontend module in the explicit offline shell and versioned build. Preserve the frontend-only publication boundary.
- Use the existing isolated checkout; no new Git worktree is needed. Preserve any unrelated user changes.

## Verification and acceptance

1. Pure tests cover Off/5/15/60, allowlisting, past/started activities, recurrence/fixed commitments, custom-reminder precedence, deduplication, rescheduling, midnight boundaries, saved zones and DST ambiguity.
2. Calendar tests cover consecutive chains, real gaps, overlaps, manual accents, deterministic ordering, isolated days, and unchanged input records.
3. Browser tests cover setting persistence/reload, account isolation and late status responses, save failures, permission refusal/unsupported browsers, fallback alerts, repeat checks/multiple tabs, and consecutive-event colours in narrow/wide light/dark layouts.
4. Run release validation, the existing Node suite, frontend build, relevant built Chromium suites, and Deno checks for all five existing entrypoints. Inspect screenshots for changed settings and calendar surfaces.
5. Verify fresh service-worker shell inclusion and ensure generated frontend output excludes backend source and secrets. Review the final diff for unintended schedule/data changes.

## Delivery limits and non-goals

- Implement and verify source changes locally. No production database migrations, account creation, provider configuration, production function deployment, or Pages publication is part of this implementation without a later concrete deployment step.
- Background support for the new global setting requires deploying the updated existing push function alongside the frontend. Until then, the existing deployed function only processes explicit task reminders. This dependency must be stated in the implementation report and release notes; do not claim app-closed automatic alerts are live merely because local tests pass.
- Browser/OS permission and real-device delivery require device validation. Existing subscription readiness and controlled browser tests are not proof of phone notification receipt.
- Google/Outlook activation, SMS/email notifications, new services, data cleanup, and unrelated design changes are excluded.

## Builder decisions still delegated

Choose the smallest integration points and precise bounded reminder identity format; settle local tab coordination and request-epoch mechanics; choose accessible automatic palette ordering. Document any material departure from the behavior above before implementing it.
