# Weekwise

Current release, completed upgrades and the precise remaining master-plan work: [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md).

Weekwise is a personal productivity workspace inspired by the connected workflow in TickTick’s product research: **capture → organize → schedule → execute → review**.

It keeps one set of task records across Today, Inbox, Upcoming, project lists and folders, a Kanban board, Saved Filters, Priority Matrix, and the Day/Week/Month/Agenda/Year calendar. It also includes recurring tasks and natural-language quick capture, all-day events, due dates, task reminders, subtasks, habits and check-ins, voice capture where supported, focus sessions, countdowns, statistics, PWA launch shortcuts, and calendar import/export.

## Live app

https://zubaerahmed13.github.io/Schedule/

## Run, test and publish

Serve the repository root with a static HTTP server, or build with `node scripts/build-weekwise.mjs` and serve `dist/`. Run `node scripts/validate-weekwise.mjs` and `node --test tests/*.test.mjs`. GitHub Actions runs pinned Playwright/axe browser checks, isolated PostgreSQL and Deno checks. Pages uses **Settings → Pages → GitHub Actions**, with `.github/workflows/deploy-pages.yml`; the output is frontend-only and publishes an exact commit/run/asset marker.

## Current cloud, invitations and erasure

The production Weekwise Supabase project is configured. Authentication, owner-isolated revision RPC saves, private invitation enforcement and password-reauthenticated account erasure passed live disposable-account checks. Do not rerun an old bootstrap against production as a repair. [LIVE_BACKEND_ACCEPTANCE.md](docs/LIVE_BACKEND_ACCEPTANCE.md) records reviewed migration order, exact applied IDs, cleanup and source/operator limitations. The private additional owner invitation is stored in Supabase Vault under `weekwise_owner_invite_code`; never put it or service credentials into public source.

For a separate new environment, review the baseline schema and ordered migrations with the setup documentation, set correct Auth redirect URLs and verify its own permissions before connecting a client. Device-only mode remains available without an account.

## Background reminders

VAPID configuration, authenticated subscription service and one active minute scheduler are live. Live checks verify account ownership, duplicate claims and opt-out. Enable each device explicitly and grant its browser permission. **App-closed provider/OS delivery is unverified on a device until tested there**; the UI distinguishes subscription status from delivery evidence. See [BACKGROUND_PUSH_SETUP.md](docs/BACKGROUND_PUSH_SETUP.md) and [LIVE_BACKEND_ACCEPTANCE.md](docs/LIVE_BACKEND_ACCEPTANCE.md). Server/VAPID private keys stay server-only.

## Google Calendar and Outlook

These account connections are **deferred by the user**. OAuth/PKCE/state/encryption/conflict-aware source and secure server configuration are retained, but provider credentials/consent and actual round trips are not configured or claimed. Local `.ics` import/export remains available. See [CALENDAR_OAUTH_SETUP.md](docs/CALENDAR_OAUTH_SETUP.md) when this work resumes.

## Data, privacy and backups

[Read the data and privacy page](https://zubaerahmed13.github.io/Schedule/privacy.html) for actual storage, sharing, retention and erasure controls.

Local browser storage keeps the planner responsive and supports offline use after the app shell has been cached. When signed in and configured, Supabase synchronizes the saved task store, reminders, focus history, habits, countdowns and saved filters. If a remote/local conflict is detected, Weekwise pauses sync and asks which copy to keep rather than silently overwriting either copy.

In **Settings → Data & privacy**, both device-only and signed-in planners can export and restore JSON backups. Signed-in restores require explicit confirmation and apply to the account's synced planner; account sync does not replace independent backups. The calendar toolbar and three-dot menu do not provide file transfers. The device-only JSON backup includes task records, recurring rules, reminders, focus history, habits, countdowns and saved filters. **Unsaved or archived editor drafts are separate, device-local recovery material and are not in that backup.** To preserve them, open Settings → Data & privacy → **Export unsaved editor history**. This exports only the current planner owner's draft records, including damaged original bytes, without deleting them. Treat the downloaded JSON as sensitive plaintext and store it privately. Calendar `.ics` export is for transferring events to another calendar; it does not establish a live two-way calendar integration.

## Share lists and use an AI planning tool

Use **Settings → Data & privacy → Task list · JSON** in either mode to export all tasks or import a portable Weekwise JSON task list. The import preserves task details and recurring rules when they are included in the export, and it clears the original reminder alert times so they do not unexpectedly notify the recipient. This is file-based transfer, **not live collaborative editing**.

In the task editor, **Copy planning prompt** copies a prompt containing the current task details and asks an AI tool to suggest actionable subtasks. Weekwise does not send that prompt to an AI service. Paste it into the AI tool you choose, then paste the returned checklist into the task's Subtasks field.

## Offline app

After a successful online sign-in, Weekwise saves an account-scoped offline access record (up to 30 days since verification). Once the PWA shell is cached, an eligible account can reopen and edit its saved planner offline on mobile; edits are stored locally and reconciled with the account on reconnection. Account & sync, under the three-dot menu, shows the saved/connected/syncing/review status rather than adding a redundant badge to the top bar. Explicit **Sign out** immediately revokes offline access on that device and locks account editing until fresh sign-in. Pending changes are retained; sign-out warns when unsynced changes exist. A device that has successfully connected an account does not offer guest bypass after sign-out. Standalone device-only planners on unrelated devices remain supported. See [authenticated mobile offline design](docs/OFFLINE_FIRST_MOBILE.md) for limitations: browser data can be evicted, local data is not encrypted at rest by this feature, and background uploads while a mobile PWA is closed cannot be guaranteed.

## Empty-by-design planner

The planner does not auto-fill a sample routine. Add real tasks and use recurring rules or the reusable work/class templates when you need them. Habit check-ins remain separate from ordinary task completion, and changing a task between views edits the same underlying task record.

## Weekwise 2.0 released core and remaining gates

The merged core upgrade [#16](https://github.com/ZubaerAhmed13/Schedule/pull/16) upgraded the actual app with Today/Insights, green responsive navigation, Smart Week Builder, Recover My Week, linked task splitting, timestamp-based focus, scheduled habits and safer local/cloud persistence. Existing tools remain available. PRs [#17](https://github.com/ZubaerAhmed13/Schedule/pull/17) (draft recovery and bounded task lists), [#18](https://github.com/ZubaerAhmed13/Schedule/pull/18) (editor-history export), [#19](https://github.com/ZubaerAhmed13/Schedule/pull/19) (Monday-first month/year grids), [#20](https://github.com/ZubaerAhmed13/Schedule/pull/20) (timezone-aware calendar imports) and [#21](https://github.com/ZubaerAhmed13/Schedule/pull/21) (opt-in future recurring metadata) have all been merged and deployed. Private Supabase migrations and external provider configurations have **not** been automatically performed.

Plan supports multiple availability windows, explicit duration estimates, preferred focus periods, daily limits, breaks and daily/weekly buffer. Review suggestions, adjust a placement using **Check placement**, and apply selected changes. Undo protects newer edits. Recovery moves existing IDs and retains original details/history. Unknown/impossible work remains visible.

Choose **Continue on this device** without an account. After the shell is cached, local capture/editing works offline. A waiting app update is activated explicitly. Backups/restore and recovery checkpoints preserve history; another tab or account cannot silently replace the current planner.

See [audit](docs/WEEKWISE_2_AUDIT.md), [architecture](docs/WEEKWISE_2_ARCHITECTURE.md), [planning rules](docs/SMART_PLANNING_ENGINE.md), [design system](docs/DESIGN_SYSTEM.md), [backup/rollback](docs/DATA_MIGRATION_AND_BACKUP.md), [release gates](docs/RELEASE_CHECKLIST.md) and [progress/remaining work](docs/UPGRADE_PROGRESS.md). Scheduling is device-local with Sunday canonical weeks; arbitrary fixed-zone conversion/configurable week start remain future work.

### Run, build and test

Source can be served directly with any ordinary static server. Production Pages uses a frontend-only build with matching content versions:

```sh
node scripts/validate-weekwise.mjs
node --test tests/*.test.mjs
node scripts/build-weekwise.mjs
node scripts/benchmark-planning.mjs
```

`dist/` contains only client assets and the deployment marker. Backend SQL/functions, tests and docs are excluded from published Pages files. The benchmark uses synthetic data and is not a browser Core Web Vitals measurement.

Browser CI installs pinned Playwright and uses isolated mock Supabase accounts without touching the live database. One regression blocks all external requests and tests a real service worker offline. To reproduce in a supported browser environment:

```sh
npm install --no-save --no-audit --no-fund playwright@1.56.1
npx playwright install chromium
node scripts/build-weekwise.mjs
WEEKWISE_TEST_SITE_ROOT=dist node --test tests/browser/weekwise-ui-smoke.test.mjs
```

Screenshots go to `test-results/` and a CI artifact. Existing Deno function checks run separately. Passing tests do not prove live OAuth, Web Push, complete accessibility or production readiness.

### Optional database hardening

`weekwise_rpc_hardening.sql` replaces the save RPC with an owner-scoped, revision-locked function and revokes direct authenticated table writes. Stage it and review `supabase_verify_rpc_hardening.sql` before requesting production approval. The migration is prepared only; it has not been executed. Apply it after the original setup script, which otherwise retains its original grants.

### Calendar display preference (released)

Settings → Work day & weekly settings → **Month and year start day** offers Sunday or Monday as the first weekday column. It is a presentation preference only; it **never moves tasks** and Weekwise's underlying weekly planning records remain Sunday–Saturday. Time-zone conversion is not implemented by this setting, and saved wall times are still guarded when the device's zone changes.

## Master-plan completion and exact scope

The original 32-section master upgrade plan is audited in [docs/MASTER_PLAN_VERIFICATION.md](docs/MASTER_PLAN_VERIFICATION.md). Features described as needing live provider, staging backend or real-device verification must not be presented as production-ready until that evidence exists.

### Safe iCalendar imports

Importing an `.ics` file now previews the number of new, duplicate, and unsupported entries before any planner changes. Named IANA `TZID` values are converted to the importing device's time zone. A missing/nonexistent local time or ambiguous DST-fold occurrence is **skipped and reported** rather than assigned a potentially incorrect instant. A regular UTC `Z` timestamp stays absolute; a floating timestamp follows the device's local clock. Date-only events keep their calendar dates. Recurring rules from external files are intentionally not imported as one-off instances; use calendar integration when configured or add those manually. No records are changed if the confirmation is dismissed.

### Previously saved recurring series (opt-in, released)

When editing a recurring task, choose **Rule from this occurrence onward** or **Entire recurring rule**. The new, *unchecked-by-default* “Also update unchanged future occurrences” option lets you review and approve the number of existing future records that will receive descriptive changes. Completed work, separately edited exceptions, times, reminders and saved history are never overwritten by this option. Scheduling-time and recurrence-cadence migrations are not automatically propagated.

### Optional getting-started guide

New, empty planners can choose one of three lightweight starting points in Today: capture a task, set realistic planning time, or explore the calendar. The guide requires no account or sample data, and can be dismissed. Settings → **Getting started** reopens it, including for existing planners. That display preference stays on this device and is separated by planner owner. This guided flow does not automatically schedule or move anything.

The task and utility dialogs trap keyboard focus, make the rest of the interface inert during modal interaction, and return focus to the control that opened the dialog. Keyboard accessibility is covered by targeted Chromium tests; a full real-device/WCAG accessibility review is still required.

### Recorded workload and schedule stability

Insights now visualizes the seven-day workload using booked local wall-clock minutes. Overlapping appointments are counted only once, and cross-midnight bookings carry onto the following day. This is **not** proof of actual time worked. The section separately reports any saved user-approved recovery moves and, when the data exists, linked timer-recorded focus time compared with user-entered estimates. Untracked/manual activity is never described as recorded work.

### Updating the installed app without losing an open edit

If a newer version is waiting in the service worker, Weekwise offers a **Reload to update** action. It stays disabled when the task editor, other configuration dialogs, an unsaved weekly review or unfinished quick-capture text could be disrupted. Finish or dismiss that work first. The update does not clear saved planner records. This safeguards the in-app update handoff; testing an installed phone PWA is a separate release requirement.

### Flexible habit goals

In Habits & routines, choose **On selected weekdays** (the unchanged default) or **Any days — reach weekly target**. Any-day habits can reach a user-set 1–7 check-ins/week without punishing rest days. A completed weekly target ends routine nudges for that week, and a weekly streak counts consecutive successful weeks. Existing habit history and schedules are preserved when changing modes.

### Performance evidence

The Chromium regression workflow archives **synthetic desktop/mobile laboratory** render metrics alongside the existing 1k/5k/10k task-list navigation measurements and accessibility audit. These help detect regressions but are not actual-user Core Web Vitals or proof of phone performance. Browser RUM collection, real networking conditions and INP percentile verification remain separate work.

Quality and support: [quality roadmap](docs/QUALITY_ROADMAP.md), [operations and recovery](docs/OPERATIONS.md), and [focused security review](docs/SECURITY_QUALITY.md). Help is available in Settings; private troubleshooting recording is optional and device-only. Public service checks run through GitHub Actions without account sessions or planner writes.
