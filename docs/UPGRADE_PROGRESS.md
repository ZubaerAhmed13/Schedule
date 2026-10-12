# Weekwise 2.0 upgrade progress

## Review candidate

Development branch: `codex/weekwise-2-foundation`.
Draft PR: https://github.com/ZubaerAhmed13/Schedule/pull/16.
Baseline main: `dc5167a299fc1f9cd00fe889619dd8a6ef335b4c`.

The actual existing app has been upgraded; features/data have not been replaced by a demo. Main, the live website and the production database remain unchanged. The user authorized branch publication and draft review; production actions are separate.

## Implemented

- Extracted application logic and legacy styles into files; added pure modules and narrow UI bridges.
- Green light/dark design system, five primary destinations, phone bottom navigation and accessible secondary tools.
- Today: next time block, up to three user-chosen priorities, timeline, saved-availability capacity and relevant deadline notices.
- Insights: genuine task completion, unioned scheduled time, recorded focus, explicit estimates, habit check-ins and saved weekly reflection. Estimates are never presented as measured work.
- Smart Week Builder: multiple windows, breaks, daily/weekly buffer, daily limit, preferred focus, explicit durations, stable explainable ordering and deadline risks.
- Editable preview placements, selected acceptance, stale/account/DST guards, independent feasibility revalidation, checked persistence and guarded Undo.
- Recover: unfinished/conflicting flexible activities, fixed protection, recurring occurrence exceptions, original IDs/details/history and global duplicate prevention.
- Explicitly named/estimated task parts, retained parent/subtask structure and linked completion reconciliation.
- Focus timer persists epochs and excludes pauses; partial finishing, short/long breaks, account ownership and deduplicated history are supported.
- Habit weekdays, paused/rest/skipped days, retained check-ins and honest foreground reminders.
- Interpreted natural capture asks for review; users can keep their original text.
- Corrupt primary/auxiliary data is preserved and blocks writes; invalid backups are rejected; confirmed restore checkpoints and rolls back included keys.
- Quota/save failures restore prior records and interrupt success messages. Another-tab changes are rejected before stale writes or cloud uploads.
- Account isolation, immutable token capture, late-response guards, checked cloud application and no redundant clean-snapshot saves.
- Device-only entry, real offline create/reload coverage, versioned frontend-only build and explicit update activation.
- Timezone metadata/review guard retains wall times; imports are bounded and unsupported foreign TZID imports are rejected rather than silently reinterpreted.
- Optional RPC hardening and a read-only privilege diagnostic are prepared, not executed.

## Validation

Run `node scripts/validate-weekwise.mjs`, `node --test tests/*.test.mjs`, `node scripts/build-weekwise.mjs` and the remote browser workflow. Current local suite has 55 tests. Browser suite has 22 regressions against the built `dist/` client, isolated Supabase fixtures and a real service worker for offline testing. CI artifacts contain desktop/tablet/phone light/dark screenshots. Both existing Supabase Edge Functions are type-checked separately.

At `92b2d14373c9081bf0fbc4a5ea2b488ee2e6c779`, all 55 Node tests, all 22 browser regressions, release checks and both Supabase Edge Function type checks passed. Browser run: https://github.com/ZubaerAhmed13/Schedule/actions/runs/38302083912. The final UI follow-up normalizes the task editor's field layout and adds desktop/mobile editor screenshots; inspect the PR's latest checks for its own result.

Browser QA found and resolved redundant startup cloud saves, a forced calendar-view change and stale storage baselines after same-tab writes. Normal planner writes now use the checked writer, while changed records from another tab remain protected.

Light and dark screenshots have been visually reviewed at 1440/820/390px. Further shared theme refinements follow those findings. A synthetic Node scheduling benchmark produced medians around 8/37/56 ms for 1,000/5,000/10,000 records in this workspace (Node v24); this is not a browser Core Web Vitals result.

## External release requirements

1. Review/authorize merge and Pages deployment, then verify the exact build-info commit/run.
2. Validate private Supabase test accounts, own-row/cross-user RLS, token expiry, invitation enforcement and real two-device/offline reconnect behavior.
3. Stage/review the optional `weekwise_rpc_hardening.sql`; it changes privileges and function execution mode. No production SQL is automatically run.
4. Configure and test OAuth/VAPID/calendar/push services only when those optional integrations are wanted. Contract tests do not establish live delivery or provider consent.
5. Complete human screen-reader, contrast/text-zoom, actual mobile keyboard and installed-PWA reviews.

## Precise continuation checklist

- Arbitrary fixed IANA-zone rendering/conversion and configurable week start remain unfinished; canonical storage remains Sunday/device-local.
- A saved-rule edit affects newly created occurrences while retaining existing materialized history. Bulk changes to already saved future occurrences need a separate reviewed preview design.
- Owner-specific unsaved editor drafts are checkpointed, but a draft-restore interface is pending. Damaged missing backup collections require explicit manual recovery; no silent reset is offered.
- Add measured browser benchmarks/virtualization for very large visible lists. The Node engine benchmark does not prove full UI performance.
- Continue separating the main module into tested state/view APIs.
- Privacy/account deletion tooling, audit retention/export policy and full security/accessibility certification need separate reviewed work.

The core planning/recovery and reliability upgrade is a concrete review candidate. It is not a claim that all 32 sections or all production integrations are complete.
