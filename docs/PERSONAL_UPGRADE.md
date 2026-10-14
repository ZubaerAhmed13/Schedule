# Personal Weekwise upgrade — 14 October 2026

The calendar runs Monday to Sunday while saved Sunday-based week keys, dates,
task IDs and original records remain compatible. Existing calendar activities
are retained. The decorative Saturday city-day badge and General settings form
(city/cooking/shift/default controls) have been removed. Work/class templates,
planner timezone review and calendar display timezone remain in their specific
workflows.

- Activity-name suggestions use this owner's saved and archived activity titles,
  with case-insensitive deduplication, search and a maximum of eight results.
  Empty planners have no fixed name suggestions. Selecting a name keeps the
  chosen destination date and clock fields.
- Appearance offers Forest, Ocean, Lavender, Sunset and Midnight, plus an
  optional device appearance preference. It uses the guarded planner transaction
  and existing account sync and backup format.
- Copy is available on phone Week cards, desktop Week cards and the task editor.
  Choose another date/time. Copies have fresh identities, reset completion and
  independent subtasks; recurring rules, reminders and provider identities are
  excluded. Original records stay unchanged. Overlapping/ambiguous destinations,
  duplicate IDs, account changes and stale planner snapshots are rejected.
- Habit and Focus forms use responsive surfaces, clear fields, rhythm controls,
  selected timer presets and reachable primary actions. Timer/history semantics
  remain unchanged.
- Weekly summary covers the actual Monday range across canonical storage weeks,
  planned/completed durations, occupied time with overlaps counted once, recorded
  focus, previous-week comparison, backlog and actual habit check-ins. Navigation,
  text export and the existing saved weekly reflection are available.
- Saved filters offer live match counts, starting points, title/note search,
  scheduling state, sorting, editing and reset. Existing filter IDs and fields are
  preserved on update; stale edits and account changes are guarded.
- Plan removes the Beta label and adds readiness counts, week navigation, task
  capture and select-all/clear-selection controls. It keeps reviewed placement,
  capacity, breaks, buffers, fixed/recurring protections, deadline handling,
  splitting, stale/expired preview rejection and guarded Undo.

## Verification

Node cases exercise copy identity/metadata, conflicts, clock changes, all-day
spans, title history, cross-week summary accounting and duplicate offline-cache
requests. Browser cases exercise actual forms/actions, filter edit persistence,
summary export, themes, keyboard and mobile layout, in addition to the existing
cloud, offline, timezone, recovery and calendar contracts. Human/device and OS
delivery acceptance remains separate from controlled browser evidence.

## Calendar provider activation

The deployed handler and stable encryption key already exist. A read-only Vault
check on 14 October finds the encryption key but no Google/Microsoft client
credentials. Google Cloud renders “Site Unavailable” in this cloud browser;
Microsoft Entra requires owner sign-in. No OAuth registration, credential,
consent or paid setting has been changed by the frontend upgrade. Follow
[CALENDAR_OAUTH_SETUP.md](CALENDAR_OAUTH_SETUP.md) for the exact callback/scopes and
provider acceptance. Do not claim calendar activation from UI or mocks alone.
