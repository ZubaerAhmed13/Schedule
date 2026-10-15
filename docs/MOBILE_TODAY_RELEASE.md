# Phone and daily execution release — 15 October 2026

Release 2 follows the market review and core usability release. It shortens the phone calendar controls and puts decisions before secondary totals on Today. Google and Outlook activation remain excluded.

## Result

- At widths up to 650 CSS pixels, Calendar uses three compact control rows: heading with labelled creation actions, all five view choices, and date navigation. The existing button IDs and view handlers remain. Frequent controls retain 44-pixel targets. The Reminder action has a bell icon; its text remains accessible when visually compacted on phones. Desktop calendar renderers and controls retain their layout.
- Folder badges use the palette's text and surface colours for readable contrast in Today's task list.
- Today presents the next timed commitment and chosen highlights before the timeline and scheduled-completion summary. Phone spacing and decorative height are reduced. Highlighted tasks show their actual scheduled date or explicit unscheduled state; highlighting does not book time. Quick capture, highlight selection, focus, the timeline and scheduled totals remain available.
- A collapsed unfinished-work review contains past commitments and deadlines through the saved planner's current date. Completed, skipped, archived, deleted and non-completion activities are excluded. An active time block is not treated as past merely because its clock label repeats during a DST fold. All-day commitments enter the review after their complete date span. Unresolved legacy clock times stay in the existing clock-review flow, unless a deadline independently makes them due.
- The review opens the original task editor for completion, date changes or an unchanged return. It displays five records at a time with explicit expansion. Expansion and review-button focus survive clock refreshes. Closing an edited review restores its current button, the remaining review summary, or capture when no review remains. Owner/date changes reset this temporary presentation state.
- “Preview flexible recovery” opens the existing recovery planner on the current week in the saved planner zone, even if a different planning week was previously selected. It is offered for past flexible time blocks; due-only unscheduled work instead links to regular planning. It builds a preview and focuses its status. It does not apply the proposals. Existing selection, protected commitments, conflict checks and Undo remain in force.

## Preservation and validation

This release adds no data migration, new persisted task fields, schema, provider setup or paid dependency. Stable task/week references, unknown metadata, attachments, week notes, historical instants, recurrence, drafts, offline access and backups use their existing paths. JSON/.ics transfers remain in Settings; no top-bar sync badge is added.

Local static checks, 265 Node tests, build and whitespace checks pass. New cross-engine cases cover narrow control geometry and all five modes; Today hierarchy and scheduled counts; light/dark accessibility; escaped task text; editing an earlier week's original task; bounded review expansion, clock-refresh focus, owner isolation and read-only recovery preview. Existing desktop/phone resize, keyboard geometry, dates, authentication, offline and persistence regressions remain required. The release PR records exact tested source, CI and reviewed screenshots.

The layout follows [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [focus-not-obscured guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), alongside the existing market research. Automated engines and controlled keyboard/text-size checks do not establish physical iPhone/Android or human VoiceOver/TalkBack acceptance. Those confirmations remain explicit in Device, speed & recovery.
