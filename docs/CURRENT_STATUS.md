# Weekwise current status — 16 October 2026

## Recovery evidence follow-up

Release 4 adds private original/restored-export comparison, current-build device confirmation counts and full production restore/reload/export coverage for legacy and version 1–6 backups. Controlled two-client tests cover both explicit conflict-resolution choices and convergence after reload. See [RECOVERY_EVIDENCE_RELEASE.md](RECOVERY_EVIDENCE_RELEASE.md) for exact comparison semantics and limits. The release PR records final checks and public identity. Physical device, notification, mailbox, offsite server restore and field-speed acceptance remain open. Google/Outlook activation remains excluded; earlier requests below are historical.

## Planning usefulness follow-up

Release 3 aligns readiness with the selected week, makes infeasibility and placement reasons explicit, and updates workload, breaks, remaining capacity and selected finish times as proposals are chosen. Missing-estimate editing, preserved review choices and explicit placement recovery use the existing task editor and scheduler. See [PLANNING_DECISIONS_RELEASE.md](PLANNING_DECISIONS_RELEASE.md) for semantics, data preservation and verification limits. The release PR owns final CI and deployment evidence. Google and Outlook activation remain excluded; older provider requests below are historical.

## Phone and daily execution follow-up

Release 2 compacts phone calendar controls while retaining five modes and accessible creation actions. Today puts the next commitment and highlights before secondary totals, with a bounded unfinished-work review and a read-only current-week recovery preview. See [MOBILE_TODAY_RELEASE.md](MOBILE_TODAY_RELEASE.md) for scope, clock semantics, preservation and remaining physical acceptance. The release PR owns final CI and deployment evidence. Google and Outlook activation remain excluded.

## Core usability follow-up

The current follow-up adds explicit Monday–Sunday task-date choices and a native date picker with preserved cross-week identity; Monday habit totals and check-in rows; a corrected Insights week label; compact optional onboarding; visible workspace search; and consolidated help/focus controls. See [CORE_USABILITY_RELEASE.md](CORE_USABILITY_RELEASE.md) for semantics, preservation checks and remaining acceptance. The release PR records exact source and CI evidence. The user's current scope excludes Google and Outlook activation; provider requests in the dated history below are historical.

The user's 14 October scope now includes completing Google and Outlook activation. The provider backend and encryption are deployed; the live health check still reports both provider credential sets absent, so real authorization and round trips remain pending. PR #44 is released at `163c75b604bfdb4c549d480be376af809c6d9429`, Pages run `38440755667`, assets `7a12f650c28ece2e`. PR #45 completed the non-calendar backend, browser recovery and privacy follow-up. PR #46 released the modern interface. PR #47 is live at `668743ad5c89913f7e11c95942f1bed847269c07`, Pages `38498395018`, assets `824d9de8e398f510`. The productivity follow-up adds guarded inline/bulk task actions, pinned lists, remembered navigation, direct Today highlights and secondary-tool polish; its PR records the exact checked head and release workflows. Releases require a reviewed head, fresh CI checks and an independently matched Pages marker. [Live build identity](https://zubaerahmed13.github.io/Schedule/build-info.json) always identifies the deployed client.

## Verified implementation and backend

- Today, Inbox, Plan, Calendar and Insights share stable canonical task IDs; projects/folders, Kanban, filters, priority matrix, countdowns, voice capture where supported, subtasks and calendar files remain available.
- Deterministic Smart Week Builder, capacity/buffers, fixed/flexible tasks, reviewed placement/splitting, Recover My Week, guarded Undo, task archive/trash, recurring schedule review and exact saved-clock Today/Focus/Insights are delivered.
- Historical IANA-zone conversion now previews exact-instant or local-clock policies, includes completed/archived records, preserves reminder identifiers, downloads an original planner/full review, records a SHA-256 checksum and creates an owner-scoped checkpoint. DST gaps/folds and duplicate destination IDs block conversion. Missing historical zones need an explicit original-zone choice; ordinary saves do not silently assign a new zone. Future original-zone rules retain their clock semantics.
- The 2,740-line controller is replaced by a 610-line startup/orchestrator and 17 injected controller factories with explicit live state accessors. Domain/model modules stay dependency-free. The exact versioned offline shell includes every controller and the public privacy page.
- Correct backend: Supabase WeekWise connection, project `iajkzlsurghfvsmqkmut`. Six Weekwise tables have RLS and validated owner cascades. Cloud writes use the compatible owner-checked revision RPC; direct authenticated writes and anonymous access are denied.
- Invitation validation is active on new Auth accounts: private hashes, atomic expiry/revocation/use limits, retained original private-code hash and a separate owner code generated only inside Vault. Follow-up Auth metadata writes cannot reintroduce newly submitted invite values. Existing account metadata is not rewritten. The owner can find the additional invitation under Vault name `weekwise_owner_invite_code` without putting it into source or a public response.
- Account erasure is active after password reauthentication and session revocation. A successful live disposable-account check verifies isolation, cascades and post-deletion cloud-write refusal. Other accounts/device-only local entries are preserved.
- Push VAPID configuration, authenticated service and exactly one minute scheduler are active. Registration cannot transfer a known endpoint to another account; cross-owner opt-out is harmless. Actual scheduled responses continue to return HTTP 200/ok=true. **Physical app-closed notification delivery remains unverified on each device**; the UI states that limitation.
- A readable, offline-capable [data/privacy page](https://zubaerahmed13.github.io/Schedule/privacy.html) explains storage, external services, exports, retention, sign-out, reminders and erasure. There is no automatic purge of task/editor history, recovery copies or delivery logs. No optional AI provider is configured; core planning does not depend on AI.

## Evidence

| Check | Result |
|---|---|
| Node | 224 tests pass locally, including seven calendar session, OAuth-return feedback, provider-readiness and stale-account contracts. [PR #53](https://github.com/ZubaerAhmed13/Schedule/pull/53) records fresh CI evidence and the exact reviewed source. |
| Built browsers | The calendar activation candidate passed 78 Chromium regression tests and 24 device/auth cases per engine across Chromium, Firefox and WebKit on `ec749eac5336477c466215d3124f2e541e37f902`. PR #53 records subsequent checks and release identity. These use controlled provider fixtures, not real provider consent or calendar round trips. |
| Database / functions / release | Isolated PostgreSQL, all five Deno handlers and release/build checks passed on that candidate head; PR #53 records the final reviewed head's checks. |
| Live backend | 48 bounded boolean checks passed: invitations and minimized stored/sign-in metadata, own/cross/anonymous reads, direct-write denial, first/competing/stale saves, fresh-client reload, push isolation/opt-out/deduplication, refresh revocation, recovery/password/token replay and erasure |
| Cleanup | Zero fresh test identities or invitation groups remain; one-use flag is false; backend checker retired to version 5 / HTTP 410 |
| Accessibility | Audited views and timezone dialog have no serious/critical axe findings; incomplete contrast/name checks remain human review. Keyboard/doubled-dialog-text/quota protection passes at phone width |
| PWA recovery | Real cached offline reload, interrupted worker install retaining the old shell, safe retry/update with an unfinished editor, and offline privacy navigation pass |
| Controlled closed-tab push | An actual DevTools push reaches the real worker with zero Weekwise tabs and invokes notification API with safe scoped URL; CI has no native notification platform, so this is not provider/OS delivery proof |
| Performance | Synthetic Chromium DOM-ready/paint/resource/CLS samples, bounded 10,000-task lists and Node scheduling benchmark are recorded; no field INP or 75th-percentile CWV claim |

See [LIVE_BACKEND_ACCEPTANCE.md](LIVE_BACKEND_ACCEPTANCE.md), [MASTER_PLAN_VERIFICATION.md](MASTER_PLAN_VERIFICATION.md), [WEEKWISE_2_ARCHITECTURE.md](WEEKWISE_2_ARCHITECTURE.md) and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Git history retains earlier phase counts and pending-stage records.

## Remaining acceptance limits

Google/Outlook credentials, consent and round trips are now requested; provider registrations and secure credential entry remain pending. Optional generative AI remains disabled as the master prompt permits. Current general UI language is English and schedule clocks use the established 24-hour presentation; arbitrary localization is not claimed.

Physical phone permission/keyboard/rotation, installed-PWA behavior, real push-provider delivery and expired-device cleanup, human VoiceOver/TalkBack/browser-zoom review, physical two-device reconnection and copies of private historical backups still need their corresponding devices/data. Controlled fixtures and doubled text do not certify those. Real signed-token expiry by waiting and mail delivery are not inferred from refresh/recovery-token checks. Legal/GDPR certification and real-user CWV percentiles are not claimed.

The Supabase organization is on the free plan. Leaked-password protection needs Pro or above and remains disabled; no paid upgrade was made. Other advisory warnings are the reviewed owner-checked SECURITY DEFINER cloud-save RPC and pg_net's catalog namespace (its functions remain in `net`, outside exposed Data API schemas). No-policy/unused-index INFO notices on server-only tables are documented, not "fixed" by granting browser access. [Password-security reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

This is an evidence-backed core release, not a claim that every human/device/legal/field acceptance criterion in the 32-section brief has been certified.

## Priorities 4–6 follow-up

Device checks, installed-app PNG/Apple icons, read-only worker/cache health, visual-viewport form bounds, account-scoped human confirmations, opt-in private web-vitals history and isolated backup rehearsal are implemented. Rehearsal shares the production restore-entry writer and never changes live storage/cloud. Metric reports contain bounded numeric values, without tasks, tokens, URLs or targets. Recording defaults off; confirmations start unverified. The cross-browser workflow adds eight focused scenarios in Chromium, Firefox and WebKit, while the existing 69-case Chromium suite remains required. Fresh pass/fail counts, screenshot review and exact release identity belong to the follow-up PR.

Physical Safari/iOS/Android push delivery, installed-app/real keyboard behaviour, VoiceOver/TalkBack, native 200% browser zoom, physical two-device reconnect, selection of a real historical backup and collection of actual device samples remain external acceptance. Engine emulation, synthetic fixtures or self-confirmed checkboxes do not certify these requirements. Google/Outlook activation is now requested; actual provider registration and consent remain pending. AI remains disabled. See [DEVICE_ACCEPTANCE.md](DEVICE_ACCEPTANCE.md).

## Reliability, first-plan guidance and operations — 14 October 2026

The optional first-run guide now persists after capture and derives three-step completion from saved tasks/preferences. Settings adds in-app help and explicit account/device/pending/conflict/recovery status. Private troubleshooting recording defaults off, retains at most 80 fixed-code outcomes/timings on this device for each account, excludes task/error/identity/token/URL content, and supports stop/clear/export and account-erasure cleanup. Public service monitoring checks seven GET-only endpoints/build conditions on a six-hour schedule, including calendar encryption readiness and separately reported provider-credential presence, without private sessions or writes. See [quality roadmap](QUALITY_ROADMAP.md), [operations](OPERATIONS.md) and [focused security review](SECURITY_QUALITY.md).

Read-only live checks found the correct backend healthy, all public Weekwise tables protected by RLS, intended owner-read/RPC grants with anonymous/direct-write denial, and one active push scheduler with 30 successful/zero failed recent runs. All seven public service probes passed; Google and Microsoft credential flags remain false. Calendar connection, mapping and OAuth-state tables have RLS and deny anonymous/browser-role access while permitting the server role. These checks do not prove mailbox or OS notification receipt, real-device usability, real calendar authorization or round trips, field performance, an independent security audit, or server disaster recovery. Physical checks remain open; SMTP delivery and offsite server backup setup are owner/provider dependent. No existing user data, schema, Auth/provider settings or paid plan was changed.
