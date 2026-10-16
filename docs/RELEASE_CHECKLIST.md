# Weekwise release checklist

Scope: current [CURRENT_STATUS.md](CURRENT_STATUS.md), original 32-section brief, Google/Outlook activation excluded. Older completed counts below are historical; current evidence belongs to the release PR. Earlier checklists and phase evidence remain in Git history.

## Checked core gates

- [x] Preserve canonical task IDs, unknown metadata, completed/history/rules/reminder identifiers and legacy backups.
- [x] Check account ownership, full snapshot, local baselines, corruption, cloud revision and review age before replacement.
- [x] Download/checkpoint original historical zone data, SHA-256 review, DST/collision refusal and guarded Undo.
- [x] Modular controller factories are exercised by behavior tests; all assets are in the versioned offline shell.
- [x] 167 Node tests, 61 built-browser checks, isolated PostgreSQL and five Deno handlers pass on the checked feature head.
- [x] 48 live backend boolean checks pass; fresh identities/invitations are cleaned; one-use checker is retired.
- [x] Invitations are private/hash checked; new submitted invitation metadata is removed despite Auth follow-up updates.
- [x] Own/cross/anonymous cloud reads, direct-write denial, competing/stale revisions and fresh-client reload verified live.
- [x] Push ownership/opt-out/dedup and active minute dispatch verified live; UI labels app-closed delivery unverified.
- [x] Account erasure remains active and password/session/owner protected; other fixture account preserved.
- [x] Controlled worker install interruption/retry, unfinished editor update guards and offline privacy reload pass.
- [x] Responsive screenshots generated/reviewed, keyboard/doubled text and axe checks recorded with human limits.
- [x] Public data/privacy behavior and retention documented; server secrets stay out of Pages.
- [x] Synthetic browser/list and scheduling measurements recorded without field-CWV claims.
- [x] Final reviewed PR head requires fresh checks after any last copy/document change.
- [x] Merge/deploy pipeline uses an expected head and verifies Pages exact commit/run/hash; post-merge workflows are checked separately.

## Deferred or external acceptance

- Google/Outlook activation remains outside the current release scope.
- [ ] Physical notification permission/provider delivery with Weekwise closed, actual expired-device cleanup and installed PWA operation.
- [ ] Human VoiceOver/TalkBack, real browser zoom and phone keyboard/rotation review.
- [ ] Physical two-device reconnect, actual historical private-backup upgrade and real signed-token waiting/expiry/mail delivery.
- [ ] Real-user 75th-percentile CWV; legal/privacy certification where applicable.
- [ ] Leaked-password protection — requires Supabase Pro or above; current free plan is unchanged.

Optional generative AI stays disabled without safe valid service configuration. No secret, email or real-user write is required merely to pass a synthetic test. An external gate is not satisfied by changing its label.

## Quality upgrade gates

- Verify the guide stays after first capture, previews remain read-only, approved scheduling completes saved-evidence steps, and dismissal/reopen remains optional.
- Verify sync diagnostics record an actual controlled failed save and successful retry, protect canonical bytes, exclude private content, stop/clear safely and remain owner-scoped.
- Audit help and device panels in phone light/dark layouts; inspect actual final screenshots and retain incomplete manual checks.
- Check public probes with denial, timeout/failure and mismatched-build fixtures, then run the GET-only live checks. Configure owner Actions notifications separately.
- Retain physical/device/mail/historical-backup/field-performance evidence and server-backup/SMTP setup as unresolved until observed.

## Release 4 recovery evidence gates

- Import legacy and version 1–6 generated backups through the production confirmation/checkpoint path, reload, export and compare original values in each browser engine.
- Check original/restored differences, additions, corrupt files, file clearing and in-flight owner isolation without planner writes or private text in reports.
- Resolve overlapping controlled client edits with each explicit choice; verify convergence and preserved IDs/notes/metadata on both clients after reload.
- Keep earlier-build confirmations dated and unchecked until repeated; never infer physical acceptance from capabilities or CI.

## Release 5 weekly review gates

- Verify local recovery across weeks/reload without changing canonical tasks, reviews or cloud revisions until explicit save.
- Preserve both visible/stored copies when another tab or device changes a review; refuse stale saves/removals and retain unknown metadata.
- Check quota/corruption/capacity refusal, Settings-only private recovery download, hidden owner isolation and exact-owner account cleanup.
- Verify explicit range, previous-period evidence, escaped prior intentions, week/ID focus links and light/dark phone/desktop accessibility; retain manual acceptance limits.
