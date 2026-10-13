# Weekwise 2.0 — master-plan verification matrix
Reviewed against the user's original 32-section "MASTER DEVELOPMENT PROMPT" and code on `main` at `dd372f38d8c0aed858cdf161ef783bd72801e108` (2026-10-13).

**Status vocabulary:** VERIFIED = scope asserted by automated tests; PARTIAL = exists but lacks specified functionality or independent verification; EXTERNAL = credentials/private environment/real device is required; POLICY = instructions, not a software feature. Historical source descriptions in other docs may predate merges.

| Section | Master-plan area | Actual state | Remaining acceptance evidence / work |
|---|---|---|---|
| 1 | Existing project and preservation | VERIFIED for representative workflows | Continue regression coverage on legacy files/real user data |
| 2 | Reality-aware product vision | PARTIAL | Validate real end-user outcomes/usability |
| 3 | Comprehensive repository audit | VERIFIED baseline | Refresh audit for each release |
| 4 | Data protection | PARTIAL | Private historic backup migrations, account-deletion policy |
| 5 | Premium UI, responsive design, accessibility | PARTIAL | Human WCAG 2.2 AA, real phone keyboard/text zoom |
| 6 | Five-destination navigation | VERIFIED for core views | Comprehensive deep-link/PWA shortcuts QA |
| 7 | Today | VERIFIED for core task/capacity widgets | Usability study and all edge-state coverage |
| 8 | Smart Week Builder | VERIFIED for deterministic core | Arbitrary time-zone planning and observed usage |
| 9 | Recover My Week | VERIFIED for core | Complex recurring/multi-device production cases |
| 10 | Calendar, DST, midnight, overlapping events | PARTIAL | Full IANA-zone planner view and cross-midnight recurrence validation |
| 11 | Task management and NLP capture | PARTIAL | Complete undo/archive/deletion UX |
| 12 | Useful Insights | PARTIAL | Verified full schedule-stability/plan-vs-actual trends for historical data |
| 13 | Habits | PARTIAL | Frequency targets beyond weekdays and manual real-user QA |
| 14 | Focus | VERIFIED for measured focus, pause and reload | Installed-PWA foreground/background platform QA |
| 15 | Optional AI | EXTERNAL | No provider configured; do not generate fake responses or transmit data |
| 16 | Optional onboarding | PARTIAL | Progressive, accessible first-run steps and real-device testing |
| 17 | Settings | PARTIAL | Full general locale/zone/account/privacy controls |
| 18 | Incremental architecture | PARTIAL | Main app IIFE remains large; module API and maintainability work |
| 19 | Cloud/offline | VERIFIED for synthetic fixtures | Real two-device reconnect, RLS, invite and expired-token tests |
| 20 | Google Calendar/Outlook | EXTERNAL | OAuth secrets/provider consent/Edge Function/staging round trips |
| 21 | Push | EXTERNAL | VAPID/cron/backend delivery with app closed, opt-out/expiry |
| 22 | Security and privacy | PARTIAL | Production RLS, optional RPC hardening, CSP threat model, legal review |
| 23 | Performance | PARTIAL | Synthetic browser large-lists tested; field CWV, long recurrence profiling |
| 24 | Errors and polish | PARTIAL | Broader interrupted/suspended/recovery tests |
| 25 | Automated testing | PARTIAL | Existing Node/Chromium/Edge tests; production-specific regression gates |
| 26 | Professional quality | PARTIAL | Human end-to-end product and security review |
| 27 | Six-phase roadmap | PARTIAL | Phases 0–4 substantially implemented, Phase 5/6 gated by external QA |
| 28 | Strict development rules | POLICY | Preserve data, refuse unverified claims, use review branches |
| 29 | Documentation | PARTIAL | Existing documents; keep evidence current and remove stale candidate text |
| 30 | Progress reporting | POLICY | Report implementation, changed files, tests, blockers, limitations |
| 31 | Final acceptance criteria | PARTIAL | Real RLS, installed PWA, accessibility, integrations, historical migration |
| 32 | Instructions to implement | PARTIAL | Continue verified improvements, never claim full completion prematurely |

## This iteration: iCalendar timezone/data-import hardening

- New `WeekwiseTimeZones` helper validates strict iCalendar date/time fields; supports named IANA TZID values using `Intl.DateTimeFormat`; rejects invalid time zones, nonexistent local times and ambiguous DST-fold instants rather than guessing.
- Exact UTC values and date-only events retain distinct semantics. Normal floating times remain in device-local wall time.
- The importer stages changes to a cloned planner, deduplicates with a Set, rejects unsupported recurring items instead of importing misleading partial series, warns about unsupported entries, requires user confirmation, and makes one checked local storage commit. It no longer truncates oversized durations silently.
- The existing rule that live calendar providers need real configuration and calendar import is **not** two-way sync remains unchanged.
- This does **not** implement arbitrary IANA-zone week-view rendering, universal TZ conversion of historical planner entries, timezone migration, a recurring `.ics` importer, or server-timezone push guarantees.

## External release gates (cannot be inferred from repository code)

1. With **staging** Supabase project and dedicated test identities: inspect RLS, row isolation, invite enforcement, token expiry and revision locks. Apply any RPC privilege migration only after production-specific approval and backup.
2. For optional calendars: provider registrations, OAuth consent, secure keys, backend migration/Edge deployment; verify create/update/delete, conflicts and token rotation with actual providers.
3. For optional push: configure server-side VAPID and scheduler with scoped credentials, verify closed-app delivery, unsubscribe and expired-subscription behavior.
4. For release certification: test 200% zoom, TalkBack/VoiceOver, real mobile keyboard/rotation, PWA installs and upgrades; test copies of real historical backups in isolated profiles.
5. Never put private API keys into GitHub commits or a public browser bundle. The only currently authorized production writes in this thread have been GitHub merges/Pages deployments, not Supabase migrations or user-data deletions.

This checklist prevents claims of master-plan completion until the corresponding evidence is actually available.
