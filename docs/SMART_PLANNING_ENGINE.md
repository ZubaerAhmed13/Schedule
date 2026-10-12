# Smart Week Builder — initial beta

This increment builds schedules for unscheduled, unfinished, non-recurring flexible tasks. It does not implement Recover My Week, task splitting, recurring occurrence moves, preferred focus periods, manual preview placement or multiple availability windows. These remain explicit continuation work.

## Inputs and units

Sunday week bucket, canonical weekly records, selected weekdays, one daily start/end availability window, daily buffer and break after each task. Defaults are editable 09:00–17:00 Monday–Friday, 60-minute buffer and 10-minute breaks; the app does not infer that these suit every user.

Dates use validated calendar-day ordinals, avoiding fixed-millisecond local day subtraction across DST. Scheduling coordinates are local calendar minutes. The UI states that it uses the device time zone. On acceptance it rejects nonexistent local start times and placements whose actual elapsed duration differs across a DST clock change. It does not support arbitrary user-selected IANA zones yet.

Past planning time is trimmed using today's local date and next minute. Proposals start on 15-minute boundaries. Single tasks stay within one availability window/day; overnight existing commitments still block subsequent days, including when they begin in the previous week.

## Capacity

1. Include only the user's chosen future planning hours.
2. Union all scheduled commitments; overlapping busy minutes count once.
3. All-day calendar entries conservatively block the full date. This is disclosed in Plan.
4. Remove a break after existing timed commitments; only intersections with available hours consume capacity.
5. Reserve daily buffer from the end of the remaining free intervals (can span fragments).
6. Remaining free minutes are flexible capacity. Each proposed task also consumes its configured following break.

Calendar time outside planning boundaries, sleep and unchosen days never count as capacity. The current beta reserves daily buffer, not a separate weekly-buffer preference. Capacity tiles distinguish available time, committed time, buffer, flexible capacity and preview remainder. Required workload uses only known task estimates; unknown estimates remain explicit. Aggregate surplus is not a guarantee that every deadline/continuous task fits.

## Deterministic precedence

- Preserve every scheduled commitment, completed record, fixed task (`fixed`, `workday`, type fixed or schedulingMode fixed), all-day entry and recurring series/occurrence.
- Consider unscheduled backlog tasks whose original date is no later than the chosen week end. Do not pull future tasks forward from later weeks.
- Require a positive integer `focusEstimateMinutes`; do not infer it from automatic 30-minute capture defaults.
- Sort by earliest due date, highest priority, flexible before optional when otherwise tied, source week, stable ID. Optional activity priority can still be deliberately raised by the user.
- Try the earliest continuous free slot ending by the date-only deadline (local end of day), with room for the following break.
- Keep anything that cannot fit unscheduled and give a reason. Never expand availability, move fixed events or modify deadlines to hide an impossible plan.

This is a feasibility heuristic; it does not claim globally optimal placement. A larger high-priority task may use space a later smaller task could have filled. Users can adjust priorities, durations, availability or selected acceptances and regenerate.

## Preview, acceptance and Undo

Preview is pure and contains proposed slots, unscheduled reasons, unknown-estimate count, existing overlap warnings and capacity. All proposals are initially selected; users may deselect any. Apply only runs after explicit action and only if planner/account matches the snapshot, no cloud conflict/storage recovery is active, starts remain in the future, and the preview is at most five minutes old.

Apply validates all moves on a clone, retains IDs/reminders/subtasks/details and writes the canonical store once. A cross-week task moves; it is not duplicated. Existing reminders retain their exact original timestamps, which may need user review after scheduling. Reminder rescheduling is deliberately not automatic.

Undo reverses the last plan only while the planner is unchanged. It does not rewind newer edits. A pre-plan raw-store checkpoint remains locally after reload for manual recovery. Cloud changes continue through the existing revision-checked RPC; local acceptance does not prove remote synchronization.

## Test coverage

Unit/behavior tests cover overlap union, capacity, deadlines, priorities, estimates, impossible workloads, excluded records, preview purity, selected acceptance, stable details, cross-week moves, previous-week overnight blocking, calendar offsets across DST/year boundaries and no partial mutation on rejection. Browser CI covers real UI preview/select/apply/reload/undo plus desktop/tablet/mobile widths. Full timezone, offline service-worker, simultaneous-device and recovery regressions are still required.
