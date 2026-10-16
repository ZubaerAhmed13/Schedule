# Release 5 — useful, recoverable weekly reviews

This release improves the existing Insights and weekly reflection flow. Inspection found that changing the selected week discarded unfinished notes and that a save could replace a review changed since editing began. Optional dependencies, energy tags and scheduling windows remain future choices requiring observed need. Google/Outlook activation remains excluded.

## Review and reflection

Insights adds Previous, This week and Next controls, an explicit date range/planner clock, a previous-period comparison of scheduled wall-clock time, current completion checkmarks and recorded focus, and the intention saved in the preceding period. Empty history is labelled as unavailable evidence rather than a productivity judgement. Earlier reviews retain their exact date keys; choosing a date does not silently migrate historical notes. This week uses Monday, while Previous/Next move the selected start date by seven days.

Scheduled time still counts overlaps once and carries overnight time into the next day. Completion checkmarks describe current saved status, not the date work was completed. Skipped/archived/deleted activities and activities not requiring completion are excluded from the completion denominator. Skipped activities retain their originally scheduled duration in the calendar-time comparison. Estimates are entered values for activities dated in the selected period, including unscheduled tasks. No missing actual work is inferred.

Focus totals include valid timer records ended in the selected period in the planner zone. Invalid/nonpositive/over-24-hour amounts are excluded. Task estimate comparisons use task week plus stable ID when available. A legacy session without a saved task week is linked only when its ID is unique among the period's records; ambiguous links remain in total recorded focus and are explicitly excluded from estimate comparisons.

## Private draft recovery

Unfinished notes save after a short pause to `weekwise-review-drafts-v1:<encoded owner>`, separately for each exact period. Navigation flushes a pending draft before changing week; a storage failure retains the text and selected week. Reload restores the local draft, and unfinished periods are available from the review form. Drafts remain on this device until explicitly saved/discarded, account-local erasure or browser storage removal. There is no automatic eviction: a twenty-period limit refuses a new draft rather than deleting an older one.

Draft storage is separate from the canonical planner, cloud snapshots and normal backups. Settings → Download review drafts exports that owner's original stored bytes, including malformed storage, plus the open unfinished copy when present. It never deletes drafts. These are private recovery files and can contain reflection text. Browser storage remains best-effort; this is recovery support, not an offsite backup or encryption.

Same-period writes/removals compare the expected draft before replacing it; different periods merge against the latest stored set. Corruption, quota failure or a newer tab copy pauses replacement while retaining the original bytes and visible text. Owner transitions checkpoint pending changes before isolation, cancel timers, and clear hidden review text, comparisons, dates and draft navigation immediately. Another account's local drafts stay separate. Confirmed account-local erasure includes this new exact owner key after detaching the active account, matching the existing cleanup flow.

## Explicit canonical save

Save review verifies the current planner owner and the exact review originally loaded. A newer saved review refuses the stale save and retains the draft. Load saved review asks before discarding unfinished notes and uses the same guarded draft removal. It never silently replaces a newer tab's draft. Canonical saves preserve unknown review metadata, other periods, settings, task IDs and every other planner collection. Existing storage baseline, cloud revision and recovery guards remain in place. Saving locally is labelled separately from cloud acknowledgement in Account & sync.

## Evidence and boundaries

Unit checks cover draft reload/isolation, stale writes/removal, independent weeks, capacity, malformed bytes, quota failure, canonical stale-save refusal, metadata preservation, historical keys and account cleanup. Browser scenarios cover week navigation/reload/save, remote changes, hidden owner transitions, Settings-only private export, quota refusal, two tabs, escaped intentions, readable phone/desktop controls and light/dark accessibility audits. Full existing release suites remain required; the release PR records exact checked heads, counts, screenshots, deployment identity and published-file verification.

Physical phone use, human screen readers/zoom, OS/mail receipt, private historical backups, server recovery and representative field speed remain observation-based acceptance. No backend schema, provider activation, paid service or remote analytics change is introduced.

## Research basis

Sunsama's current [weekly review guide](https://help.sunsama.com/docs/usage-guides/weekly-objectives/weekly-review/) separates reviewing recorded work/time from a short reflection and access to past reflections. Adapting that structure to existing WeekWise features is a product recommendation, not evidence of comparative user outcomes. The existing roadmap prioritises clear planned/focus/estimate labels and one next-week intention. Current [Supabase auth-event guidance](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) and changelog were reviewed for the account-transition hook; no Auth API/configuration or schema change was needed.
