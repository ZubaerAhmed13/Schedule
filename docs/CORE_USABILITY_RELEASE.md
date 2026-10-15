# Core usability release — 15 October 2026

This release follows the current product review: make everyday actions clearer and keep existing records and workflows intact. Google and Outlook activation is outside this work.

## Result

- The task editor presents explicit dated choices in Monday–Sunday order. Its calendar button reveals a native date field for another week. A date choice is a draft until Save; cross-week changes retain the task ID, metadata, reminders and source-week notes. Single recurring occurrence moves retain their original occurrence identity, preventing regeneration of the old occurrence. Series timing still uses the existing reviewed series interface.
- Habit weekly counts, flexible targets, streak derivation and displayed check-in rows now use Monday–Sunday. All dated check-ins, skip dates and stored records are preserved. Weekly derived totals can differ from the previous Sunday grouping, particularly for Sunday check-ins; this is a corrected display/count convention, not a history migration.
- Insights no longer describes its Monday-based default range as Sunday-based. Existing saved review keys are retained.
- Today keeps the personal greeting visible before a compact optional guide. One next action follows actual saved progress; all three steps remain available in a disclosure. Dismiss/replay stays owner-scoped and never creates tasks.
- Existing whole-workspace Search is visible outside Tools, with a Ctrl/Command + Shift + F shortcut when focus is outside an editor or form. Ctrl/Command + K keeps its capture behaviour.
- Settings has one Help & getting started card containing help and guide replay. Focus uses one session-length selector rather than a repeated set of identical preset controls.

## Data and compatibility

Sunday-keyed storage buckets remain unchanged. Date projection translates visible dates into the correct existing bucket/day, including the Sunday at the end of a displayed week. Selecting a date never changes records; Save uses the existing checked persistence and cloud queue. Metadata-only edits preserve retained schedule instants. The editor refuses stale record/account sessions and duplicate destination identities. Existing attachment links are loaded into the full editor instead of being replaced by an empty field. The editor body scrolls separately from its footer so actions cannot cover the fields. Draft recovery retains an explicitly chosen date and accepts older drafts without the new field.

No production backend schema, credentials, provider configuration, account settings or paid plan are changed. JSON/.ics management remains in Settings, offline access and conflict handling remain, and no permanent top-bar sync badge is added.

## Validation

Local release/static checks and the Node suite pass (263 tests). Targeted cases cover Monday/Sunday/year-boundary choices, cross-week preservation and duplicate destination refusal, and Monday habit boundaries without record mutation. Browser cases exercise full-editor date moves, new Sunday all-day events, and recurring occurrence identity across reload. Existing guide checks now exercise the compact next action and explicit expanded checklist. The release PR owns current CI results and reviewed screenshots.

Physical phones, assistive technologies, real two-device sync and closed-app push receipt remain separate acceptance evidence. The following release will address mobile toolbar density and daily execution hierarchy.
