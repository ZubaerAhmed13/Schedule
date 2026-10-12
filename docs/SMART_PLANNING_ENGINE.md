# Smart Week Builder and Recover My Week

Both features consume real canonical records and require explicit approval. They are deterministic feasibility heuristics, not globally optimal schedules or promises that every deadline is achievable.

## Inputs and capacity

Editable preferences include selected weekdays, default hours, up to 28 custom weekday windows, daily buffer, weekly buffer, following breaks, maximum daily planned minutes and an optional preferred focus period. Custom windows replace default hours on that weekday. Overlapping windows and calendar commitments are unioned. Gaps between windows stay unavailable.

Capacity calculation:

1. Include only selected planning windows after the current local minute.
2. Remove the union of scheduled commitments, including overnight spillover from other weeks.
3. Conservatively block the full date for all-day events.
4. Remove configured breaks following existing commitments.
5. Reserve daily buffer, then apply the daily limit after existing committed time.
6. Reserve the weekly buffer from the remaining intervals.
7. Each suggestion consumes its duration plus its following break.

Buffer is reserved from the end of available intervals and may span fragments. Capacity display separates selected hours, committed time, buffer, remaining task capacity and preview remainder. Daily-limit reservation is available in the engine output. Unknown estimates and deadline/continuous-slot problems remain visible; unused capacity does not prove that a task fits.

## Scheduling precedence

Build considers unfinished unscheduled flexible backlog tasks dated no later than the chosen week end. Fixed/workday/all-day/attendance-only/container tasks, recurring tasks and already scheduled tasks stay in place.

Require an explicit positive duration: `estimatedDurationMinutes`, or the older explicit `focusEstimateMinutes`. Recovery may reuse the already planned calendar duration. Automatic capture defaults are never treated as a measured estimate.

Order: earliest deadline, highest priority, flexible before optional when tied, source week, stable ID. Try a feasible preferred-focus slot first; otherwise use the earliest continuous free slot. Starts align to 15-minute boundaries. The entire duration and following break must fit; date-only deadlines mean local end of day. Never extend availability or change deadlines automatically.

Manual date/time edits require **Check placement**, which regenerates and validates the preview. Invalid overrides stay unscheduled with an explanation. Other preferences regenerate from the deterministic rules.

## Recovery

Recover detects unfinished past timed activities and overlapping timed commitments. Fixed, completed, all-day and explicitly completion-free events are protected. Flexible recurring occurrences may be moved as an exception. Existing slots remain blockers while building the preview, so accepting only part of a proposal cannot create a collision with an unselected source task. This deliberately sacrifices some capacity rather than assuming every move will be approved.

The interface explains what changed, what can move, the original slot and what cannot fit. Apply moves the existing ID, keeps original details/reminder timestamps, appends rescheduling history and marks recurring overrides. Global occurrence lookup across all weeks prevents the old occurrence from regenerating after a cross-week move. Original reminder times are retained; users should review them after scheduling.

## Splitting

Only unfinished flexible non-recurring tasks can be split. Users enter 2–12 named parts with explicit 5–1440-minute estimates; the app does not invent personalized estimates. The original parent ID, notes and existing subtasks remain. Its old calendar slot is retained in `planningOriginalSchedule`, while it becomes an unscheduled parent. Each child is a separate schedulable record linked to the parent. Reminders are not duplicated onto children. Linked completion is reconciled across weeks. Splitting is a separate explicitly approved, checkpointed change before placement acceptance.

## Acceptance and Undo

Preview does not write data. All suggestions start selected; individual suggestions can be declined. Apply rejects stale accounts/stores, unresolved conflicts, damaged storage, unreviewed timezone changes, past starts, previews older than five minutes, nonexistent local times and DST duration discontinuities. It regenerates the expected placements before applying all selected moves to a clone and committing one checked local write.

Guarded Undo reverses the last accepted plan only while the store/account is unchanged. Pre-plan/pre-split raw checkpoints remain on the device after reload. Undo does not rewind habit, reminder or focus collections. Local success is not equivalent to confirmed cloud sync.

## Tests and limits

Tests cover capacity union, multiple windows, buffers/limits, focus preference, deadlines, unknown/impossible work, fixed protection, selected acceptance, tampered slots, immutable failure, split links, overnight boundaries, DST calendar ordinals, recovery history and recurring cross-week identity. Browser tests exercise actual preview/apply/reload/Undo, splitting and recurring recovery.

Device-local scheduling, Sunday canonical buckets and date-only deadlines remain explicit limits. There is no arbitrary IANA-zone conversion, auto deadline adjustment, recurring-series rescheduler or automatic semantic AI task breakdown.
