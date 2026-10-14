# Mobile weekly calendar

Week view uses a seven-day schedule at widths up to 650 CSS pixels. All seven dates remain visible at the top of its vertical scroll area. Date buttons jump to the day's heading; event cards show readable times and titles, completion controls and optional note disclosures. Each day has a labelled add button. Desktop Week and the Day, Month, Agenda and Year layouts retain their existing renderers.

The schedule uses the existing date/timezone projection and original week/task references. Sunday/Monday preferences, overnight and all-day continuation, fixed blocks, completed records, clock-change warnings and time-review states remain represented. Opening, jumping, expanding notes, paginating or resizing changes presentation only. Editing and completion use the existing guarded actions. Week navigation and Today retain their current meaning. Busy days start with 100 records and expose the next batch explicitly; original records remain saved.

Mobile-specific CSS keeps titles and note text within the available width. Action buttons have 44-pixel targets; seven date buttons fit even at 320 pixels and exceed the 24-pixel WCAG minimum. Keyboard jumps focus the destination heading. Completion retains focus in the same day, open notes survive refresh for the same account/view, and crossing the phone breakpoint retains each layout's scroll position for the same account/week/zone.

## Research and choice

- [Outlook mobile views](https://support.microsoft.com/en-us/outlook/how-do-i-switch-to-month-view) documents Agenda, Day, 3-Day and Month options. This supports giving phones a focused presentation rather than requiring the desktop grid.
- [Google Calendar Android views](https://support.google.com/calendar/answer/6110849?co=GENIE.Platform%3DAndroid&hl=en) supports selecting a suitable view on mobile.
- [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) permits necessary two-dimensional grids but encourages reducing scrolling and retaining readable text within cells and controls.
- [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) informs reachable, separated controls at narrow widths.

This phone Week design shows the complete week through date navigation and chronological day groups. Day view remains available when the hourly timeline is useful. There are no swipe-only actions and no sample planner records are added to the app.

## Verification

The release PR records the exact checked head, CI runs and independent published identity. Five added engine cases cover 320/390/650-pixel widths, settled light/dark audits, date navigation, edit/completion/add actions, escaped notes, Monday/timezone/overnight/all-day/source-week handling, desktop markup and scroll restoration, other views, and bounded pagination. The existing overnight regression now checks both carried phone cards and desktop time-axis visibility before retaining its metadata-edit and saved-instant assertions. Node/static/build checks and existing Chromium/device/auth/PostgreSQL/Deno regressions remain required. Screenshot inspection and automated audits complement physical-device and human screen-reader acceptance; they do not certify those checks.
