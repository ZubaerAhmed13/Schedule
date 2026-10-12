# Weekwise

Weekwise is a personal productivity workspace inspired by the connected workflow in TickTick’s product research: **capture → organize → schedule → execute → review**.

It keeps one set of task records across Today, Inbox, Upcoming, project lists and folders, a Kanban board, Saved Filters, Priority Matrix, and the Day/Week/Month/Agenda/Year calendar. It also includes recurring tasks and natural-language quick capture, all-day events, due dates, task reminders, subtasks, habits and check-ins, voice capture where supported, focus sessions, countdowns, statistics, PWA launch shortcuts, and calendar import/export.

## Live app

https://zubaerahmed13.github.io/Schedule/

## Publish with GitHub Pages

1. Open **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then save.
4. Wait for GitHub Pages to publish the site.

## Cloud sync setup

Weekwise uses Supabase Auth and a revision-aware save function to sync user data between devices. Cloud sync requires the database setup to be run once:

1. In the Supabase project’s **SQL Editor**, run `weekwise_supabase_setup.sql`.
2. Run `supabase_invite_code_setup.sql` if you want invite-code-only account creation. The current app sign-up flow requires a referral code.
3. In **Authentication → URL Configuration**, set the Site URL to `https://zubaerahmed13.github.io/Schedule/` and add `https://zubaerahmed13.github.io/Schedule/**` as a Redirect URL.
4. In **Authentication → Providers → Email**, configure email confirmation to match how you want people to register.

The app includes only the Supabase publishable client key. Never place a service-role key or database password in `index.html` or another public file. If database setup is missing, Weekwise can still keep changes in the current browser, but those changes will not sync to another device until the SQL setup succeeds.


## Background task reminders (optional)

The repository now includes a service-worker Web Push implementation, authenticated Edge Function, protected subscription/delivery tables, and an optional one-minute scheduler. **Background delivery is not active in the live app until the external Supabase setup is completed.** Follow [docs/BACKGROUND_PUSH_SETUP.md](docs/BACKGROUND_PUSH_SETUP.md), run `supabase_push_setup.sql`, deploy the Edge Function, configure server-only VAPID/dispatcher secrets, store the scheduler secret in Vault, and install `supabase_push_cron_setup.sql`.

The browser notification option already in Weekwise works while the app is running; it is not a substitute for server-driven Web Push. Never commit a VAPID private key or service-role key.


## Google Calendar and Outlook (optional)

Weekwise now includes code for secure Google Calendar and Microsoft Outlook OAuth, primary-calendar sync, encrypted provider tokens and conflict-aware event reconciliation. It is **not active in production until you configure provider OAuth clients/secrets in Supabase, run supabase_calendar_setup.sql, deploy the weekwise-calendar Edge Function and pass real calendar round-trip tests**.

Follow docs/CALENDAR_OAUTH_SETUP.md for the exact callback URL, provider setup and safe secret configuration. Do not put client secrets, refresh tokens, or the AES encryption key in this repository. The existing .ics import/export remains available separately.

## Data, privacy and backups

Local browser storage keeps the planner responsive and supports offline use after the app shell has been cached. When signed in and configured, Supabase synchronizes the saved task store, reminders, focus history, habits, countdowns and saved filters. If a remote/local conflict is detected, Weekwise pauses sync and asks which copy to keep rather than silently overwriting either copy.

Use **Export backup** before clearing browser data or moving devices. The JSON backup includes task records, recurring rules, reminders, focus history, habits, countdowns and saved filters. Calendar `.ics` export is for transferring events to another calendar; it does not establish a live two-way calendar integration.

## Share lists and use an AI planning tool

From a task view, use **Share / export** to create a portable Weekwise JSON list file, then use **Import list** in another Weekwise workspace to copy the tasks. The import preserves task details and recurring rules when they are included in the export, and it clears the original reminder alert times so they do not unexpectedly notify the recipient. This is file-based transfer, **not live collaborative editing**.

In the task editor, **Copy planning prompt** copies a prompt containing the current task details and asks an AI tool to suggest actionable subtasks. Weekwise does not send that prompt to an AI service. Paste it into the AI tool you choose, then paste the returned checklist into the task's Subtasks field.

## Offline app

After the site is first opened online, the service worker caches the application shell for later offline use. Supabase account access and cross-device sync require an internet connection.

## Empty-by-design planner

The planner does not auto-fill a sample routine. Add real tasks and use recurring rules or the reusable work/class templates when you need them. Habit check-ins remain separate from ordinary task completion, and changing a task between views edits the same underlying task record.

## Weekwise 2.0 development branch

The first upgrade increment adds **Plan → Smart Week Builder (Beta)**. Set planning weekdays/hours, buffer and breaks; unscheduled flexible tasks with an explicit **Estimated focus** can be previewed, selected and scheduled. Existing timed/fixed/recurring/all-day commitments remain protected. Accepted changes are saved locally and use the existing revision-aware sync queue. Undo is available while the planner has not changed since acceptance. Unknown estimates and work that cannot fit are shown honestly. Recovery planning and the complete redesign remain future work.

The increment also preserves legacy/non-custom records and edited recurring occurrences, protects corrupt planner data, and adds validated/confirmed backup restoration with a local recovery checkpoint. See [audit](docs/WEEKWISE_2_AUDIT.md), [architecture](docs/WEEKWISE_2_ARCHITECTURE.md), [planning rules](docs/SMART_PLANNING_ENGINE.md), [design system](docs/DESIGN_SYSTEM.md), [backup and rollback](docs/DATA_MIGRATION_AND_BACKUP.md), [release gates](docs/RELEASE_CHECKLIST.md) and [progress](docs/UPGRADE_PROGRESS.md).

### Run and test

No application build or npm dependency installation is needed to serve the app. With Node 22+ and Python 3:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Supabase account behavior depends on the existing external configuration and allowed redirects; use an isolated browser/test account for manual verification.

Dependency-free checks:

```sh
node scripts/validate-weekwise.mjs
node --test tests/*.test.mjs
```

Browser CI uses an isolated Supabase stub and pinned Playwright, without touching real accounts:

```sh
npm install --no-save --no-audit --no-fund playwright@1.56.1
npx playwright install chromium
node --test tests/browser/weekwise-ui-smoke.test.mjs
```

Screenshots from the new Plan tests are saved to `test-results/` and uploaded as a CI artifact. Deno checks cover existing Supabase functions separately. Passing these checks is not proof of live OAuth, Web Push, GDPR compliance or full production readiness. Review the release checklist before merging/deploying.
