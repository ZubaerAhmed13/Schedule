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

## Data, privacy and backups

Local browser storage keeps the planner responsive and supports offline use after the app shell has been cached. When signed in and configured, Supabase synchronizes the saved task store, reminders, focus history, habits, countdowns and saved filters. If a remote/local conflict is detected, Weekwise pauses sync and asks which copy to keep rather than silently overwriting either copy.

Use **Export backup** before clearing browser data or moving devices. The JSON backup includes task records, recurring rules, reminders, focus history, habits, countdowns and saved filters. Calendar `.ics` export is for transferring events to another calendar; it does not establish a live two-way calendar integration.

## Offline app

After the site is first opened online, the service worker caches the application shell for later offline use. Supabase account access and cross-device sync require an internet connection.

## Empty-by-design planner

The planner does not auto-fill a sample routine. Add real tasks and use recurring rules or the reusable work/class templates when you need them. Habit check-ins remain separate from ordinary task completion, and changing a task between views edits the same underlying task record.
