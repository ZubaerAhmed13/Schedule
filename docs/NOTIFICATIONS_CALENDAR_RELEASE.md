# Notification timing and clearer calendar blocks

Settings → Notifications now offers **Off, 5 minutes before, 15 minutes before, or 1 hour before** for all upcoming timed activities, including existing activities, recurring occurrences, and fixed commitments. Automatic reminders start Off. Valid custom reminders on an activity take precedence and retain their original identifiers. All-day, completed, archived, unscheduled and uncertain-clock activities do not receive automatic start alerts.

Timing follows the saved planner zone and captured occurrence instant, including DST protection. Rescheduling derives a new alert time; automatic catch-up stops when the activity starts. Permission is requested only by the browser-alert button. Device-only planners can receive alerts while open. Signed-in, synced planners can use the existing background subscription service.

Foreground delivery uses bounded owner-scoped local receipts and browser Locks when available. It never writes task acknowledgement markers or planner records. Failed system notifications fall back to an in-app alert; hidden tabs defer that fallback until visible. Receipts expire logically after 24 hours and each owner retains at most 512 entries; account erasure includes their removal. Platforms without browser Locks use best-effort local-storage coordination; simultaneous delivery cannot be guaranteed there. Foreground and background system alerts share notification tags.

Notification permission and background controls now live directly in Settings. Account changes invalidate old pending status operations; requests time out after 15 seconds; failed operations retain an actionable error. Tapping a notification focuses an existing planner without reloading unsaved work.

Consecutive timed events receive deterministic contrasting automatic accents across day/week/mobile/month/agenda renderings. Manually chosen colours remain intact. Isolated activities retain category appearance. Derived accents never modify task metadata, times, recurrence, or history.

## Deployment and verification limits

Deploy the updated **weekwise-push** function together with the frontend to enable the new global timing preference for app-closed reminders. No database migration is needed. The previously deployed dispatcher only understands explicit reminders. This implementation does not deploy functions, publish Pages, alter production configuration, create accounts, or verify physical phone/OS delivery.

Local verification uses Node 22, the repository's pinned Playwright/axe packages, and the image's Chromium. The new suite covers timing persistence and unchanged activity data, quota failure recovery, denied permission/in-app fallback, narrow/wide light/dark accessibility, and day/week colour consistency. Existing browser suites, Node tests, release validation, and all five Deno checks remain required. Browser screenshots and synthetic fixtures do not certify native notification delivery or a comprehensive accessibility audit.
