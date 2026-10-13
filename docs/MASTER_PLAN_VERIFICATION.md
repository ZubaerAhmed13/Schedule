# Weekwise 2.0 — master-plan verification matrix
Original baseline reviewed against the user's original 32-section "MASTER DEVELOPMENT PROMPT" and code on `main` at `b173a18551b3b5c45d0be456632afaedb1a3eea9` (2026-10-13).

Current release/tests and remaining acceptance gates are in [CURRENT_STATUS.md](CURRENT_STATUS.md). The current status page supersedes this historical baseline. PRs #16–#37 are merged; saved-clock Today/Focus/Insights is the current follow-up.

**Status vocabulary:** VERIFIED = scope asserted by automated tests; PARTIAL = exists but lacks specified functionality or independent verification; EXTERNAL = credentials/private environment/real device is required; POLICY = instructions, not a software feature. Historical source descriptions in other docs may predate merges.

| Section | Master-plan area | Actual state | Remaining acceptance evidence / work |
|---|---|---|---|
| 1 | Existing project and preservation | VERIFIED for representative workflows | Continue regression coverage on legacy files/real user data |
| 2 | Reality-aware product vision | PARTIAL | Validate real end-user outcomes/usability |
| 3 | Comprehensive repository audit | VERIFIED baseline | Refresh audit for each release |
| 4 | Data protection | PARTIAL | Private historic backup migrations, account-deletion policy |
| 5 | Premium UI, responsive design, accessibility | PARTIAL | Automated axe and modal keyboard gates delivered; human WCAG 2.2 AA, real phone keyboard/text zoom remain |
| 6 | Five-destination navigation | VERIFIED for core views | Comprehensive deep-link/PWA shortcuts QA |
| 7 | Today | VERIFIED for core task/capacity widgets | Usability study and all edge-state coverage |
| 8 | Smart Week Builder | VERIFIED for deterministic core | Arbitrary time-zone planning and observed usage |
| 9 | Recover My Week | VERIFIED for core | Complex recurring/multi-device production cases |
| 10 | Calendar, DST, midnight, overlapping events | PARTIAL | Date-aware Calendar display and Monday planning delivered; arbitrary planner-zone conversion and arbitrary historical planner-zone migration remains; explicit overnight editing is delivered |
| 11 | Task management and NLP capture | VERIFIED for representative fixtures | Archive, Recently removed, restore and guarded Undo delivered; historic/private-data acceptance remains |
| 12 | Useful Insights | PARTIAL | Daily unioned workload, recorded recovery and task-linked focus/estimate comparison delivered; broader historic actual-work trends and usability remain |
| 13 | Habits | PARTIAL | Flexible 1–7/week targets and legacy-preserving UI delivered; manual real-user QA remains |
| 14 | Focus | VERIFIED for measured focus, pause and reload | Installed-PWA foreground/background platform QA |
| 15 | Optional AI | EXTERNAL | No provider configured; do not generate fake responses or transmit data |
| 16 | Optional onboarding | PARTIAL | Optional account-isolated guide and replay delivered; real-device usability remains |
| 17 | Settings | PARTIAL | Full general locale/zone/account/privacy controls |
| 18 | Incremental architecture | PARTIAL | Main app IIFE remains large; module API and maintainability work |
| 19 | Cloud/offline | VERIFIED for synthetic fixtures | Real two-device reconnect, RLS, invite and expired-token tests |
| 20 | Google Calendar/Outlook | EXTERNAL | Server/tables/encryption deployed; OAuth credentials/consent and real round trips remain |
| 21 | Push | EXTERNAL | Server/tables/VAPID deployed; scheduler approval and closed-app delivery/opt-out/expiry remain |
| 22 | Security and privacy | PARTIAL | Production RLS, optional RPC hardening, CSP threat model, legal review |
| 23 | Performance | PARTIAL | Synthetic browser large-lists tested; field CWV, long recurrence profiling |
| 24 | Errors and polish | PARTIAL | Broader interrupted/suspended/recovery tests |
| 25 | Automated testing | PARTIAL | Existing Node/Chromium/Edge tests; production-specific regression gates |
| 26 | Professional quality | PARTIAL | Human end-to-end product and security review |
| 27 | Six-phase roadmap | PARTIAL | Phases 0–4 substantially implemented, Phase 5/6 gated by external QA |
| 28 | Strict development rules | POLICY | Preserve data, refuse unverified claims, use review branches |
| 29 | Documentation | PARTIAL | Current-status audit refreshed; historical candidate text explicitly labelled; continue recording exact-head release evidence |
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

## Verified additions and evidence at 13 October 2026

- **Calendar import** (section 10): PR #20 implements strict named IANA TZID/UTC/floating event handling with DST fold/gap refusal, review and one checked storage transaction. This is limited to `.ics` import, not a general planner time-zone migration.
- **Recurring metadata** (sections 10–11): PR #21 offers an unchecked-by-default bulk choice with preview. Only eligible, unmodified future occurrences receive descriptive metadata updates. It explicitly does **not** reschedule tasks, change rule cadence/alarms, or replace completion history.
- **Testing/release** (sections 23, 25 and 31): Node 74/74, built Chromium 29/29, Edge checks and exact Pages deployment passed at `ea6573c0`. Synthetic browser list navigation-to-paint at 1,000/5,000/10,000 items is measured but is not a real-world Core Web Vitals percentile.
- **Remaining work**: [issue #22](https://github.com/ZubaerAhmed13/Schedule/issues/22) tracks the external, human, infrastructure and high-risk migration work needed before the entire 32-section plan can be certified.

## Continuation through PR #33 and account-erasure source

PRs #29–#33 deliver lab performance metrics, full Focus search/paging, reversible task lifecycle, reviewed recurring date/time/cadence changes and Monday-first Calendar/planning with IANA Calendar projection. See CURRENT_STATUS.md for exact-head evidence and limits. Account-erasure implementation is disabled by default pending correct-project access, cascade/RLS staging tests and deployment; see ACCOUNT_ERASURE_SETUP.md. None of these automated fixtures establishes production deletion, provider readiness or human accessibility certification.

## Continuation through PR #35 and saved-clock review

PR #34 supplies gated account-erasure source and controls; it is disabled in production pending staging/project access. PR #35's final head `368c38356ca8f00e08ff8541971becb0b5c4d595` passed 129 Node/50 built-client browser tests and all release/Edge gates, adding overnight editing, reviewed swaps, stale-pointer/focus guards and cached-account offline/reconnect fixtures. Phone screenshots were reviewed.

Saved planning-clock review adds source-zone date/instant checks, conservative DST review intervals, carried all-day planning capacity and clear planned-completion labels. Further cross-zone historical migration, private-backend tests, optional providers, field measurements and human accessibility/PWA certification remain external or separate design work; the 32-section plan is still partially complete.

## Generated recurring-clock and preservation review

PR #37 indexes actual source-zone occupancy, preserves generated overnight hours, reserves future all-day commitments and leaves DST gap/fold occurrences unscheduled for review. Retained materialized records are not rewritten. Exact-instant anchors survive reordered object keys; dashboard past/future classification uses captured/source-zone time. The first code head passed 140 Node/53 browser tests and release/Edge checks; final follow-up adds two Node regressions and requires fresh remote checks. SDK imports are pinned to the verified current bundle, with no backend deployment.

## Latest master brief and daily-clock continuation

The later `Pasted text(4).txt` master brief was read in full on 13 October 2026 and retains the same 32-section scope. PR #37 is released with 142 Node/54 browser checks and independently matched Pages marker. The daily-clock follow-up addresses sections 7, 12, 14, 17 and 18 by reusing saved-zone dates and exact instants in read views, extracting pure daily derivation and correcting recorded-history week grouping. Four new Node scenarios and one browser scenario are added; final remote checks remain the release gate. External/device/historical migration gates above still apply.

## Approved cloud-save production update

After correct WeekWise connection, read-only catalog/RLS/grant/cascade inspection and isolated PostgreSQL contract/rollback CI, the user explicitly approved the scoped cloud-save validation update. Migration `20261013132923` was applied only to Weekwise `iajkzlsurghfvsmqkmut`; an atomic aggregate content/row-count assertion preserved every stored row/revision/timestamp. Live read-only checks confirmed malformed/oversized rejection and unrelated-identity read isolation; grants/output order remain compatible. [BACKEND_ACCESS_AUDIT.md](BACKEND_ACCESS_AUDIT.md) records exact SQL/fingerprints and limits. Earlier statements that no production SQL had run describe their historical stage. Optional provider/invitation/erasure activation and real test-identity/device acceptance remain pending; this specific approval does not authorize every future production operation.

## Authorized integration setup

PR #41 and [INTEGRATION_ACTIVATION.md](INTEGRATION_ACTIVATION.md) record migration `20261013142457`, actual three-service deployment, stable Vault keys and live health/RLS checks. Automatic approval rejected pg_net enablement; no cron or disposable Auth test ran and erasure remains disabled. Provider registrations/credentials/consent and actual device notifications remain external. Earlier no-production-operation/undeployed statements describe historical stages.

## Scoped signed account activation

PR #42 provides an expiring one-use HMAC operator request that avoids pg_net. The actual disposable check passed wrong-password/target/token rejection, six owner cascades, other-account preservation, deleted-identity rejection, refresh revocation and the deployed endpoint. Both disposable accounts were cleaned, erasure is enabled and the harness is retired to HTTP 410. Scheduling remains blocked by its pg_net/pg_cron approval, and provider/device/human acceptance still applies.
