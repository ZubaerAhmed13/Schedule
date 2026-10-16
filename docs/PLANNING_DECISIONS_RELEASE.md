# Planning usefulness release — 16 October 2026

Release 3 makes readiness, placement reasons and selective approval understandable. It follows the phone/Today release; Google and Outlook activation remain excluded.

## Decisions before and after preview

- Readiness uses the selected Monday–Sunday range and the same explicit-estimate rules as Build. Later-dated flexible work is counted separately. Completed, skipped, protected and already scheduled tasks are not presented as unplanned work. Missing-estimate review shows at most five originals at a time; adding an estimate opens the existing editor directly at the relevant field. More originals appear as estimates are added.
- Unplaced work distinguishes unknown estimates, invalid/past deadlines, deadlines before the selected week, absent availability, exhausted capacity, insufficient continuous gaps and rejected chosen placements. Gap explanations report the largest remaining task slot after breaks and 15-minute start alignment. These describe this deterministic preview, not a proof that every possible arrangement is impossible. Earlier suggestions remain reserved while later tasks are evaluated.
- Proposed slots explain whether they use preferred focus hours, a user-chosen placement or the earliest fitting free slot. Preferred task finishes remain inside the selected focus period; the following break may end outside that period if availability permits. Fixed, completed and other existing commitments remain protected.
- Your selected plan updates task time, breaks, remaining capacity and the last selected task finish for each available day. Finish labels describe selected tasks in the saved planner zone, not a forecast of the user's entire day or actual focused time. Clearing suggestions leaves other proposed slots where they were. A new preview explicitly reconsiders all placements.
- Checking a chosen placement preserves the remaining checkbox choices. A rejected placement has an explicit Use suggested time action. Restored suggestions must be selected again if their selection was removed while they could not fit. Neither checking nor restoring a placement writes planner records. Apply remains explicit.
- Editing from readiness or an unplaced row restores focus to the replacement launcher, the remaining readiness summary, the visible preview heading or Add a flexible task. Checking placements restores focus to their current check button or preview heading. Native disclosures, labelled controls, narrow layouts and shared theme colours remain in use.

## Preservation and verification

There is no migration, schema/provider configuration, paid service or new persisted task field. Existing stable identities, notes, unknown metadata, recurrence, historical instants, account ownership, offline persistence and Settings-only JSON/.ics transfers remain on their existing paths. Current-source/account/clock checks still gate Apply; guarded Undo still refuses to overwrite newer edits. Recovery continues to reserve original slots until approval and retains original occurrence identity/history.

Local Node/static/build checks and browser CI remain release gates. Added cases cover exact readiness eligibility, failure categories, truthful placement reasons, selected totals/finishes, daily/weekly reserves, missing-estimate editing, metadata retention, partial Apply/Undo, invalid-placement recovery, account isolation, 320/390/1440-pixel reflow and light/dark accessibility. The release PR records exact tree, CI, screenshots and deployment evidence. These controlled checks do not establish physical-phone or human screen-reader acceptance.

## Research basis

Current official [Sunsama daily-planning guidance](https://help.sunsama.com/docs/usage-guides/daily-planning/) describes estimated workload and finish-time review. [Motion's scheduling documentation](https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling/how-auto-scheduling-works-behind-the-scenes) makes duration, constraints and work that cannot fit explicit. Retrieved 16 October 2026. WeekWise applies those explanatory patterns to its existing deterministic, user-approved planner; its own placement and safety rules are defined above.
