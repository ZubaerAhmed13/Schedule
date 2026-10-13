# Weekwise current status — 13 October 2026

The user's current scope is to finish Weekwise while **deferring Google and Outlook**. PR #44 is released at `163c75b604bfdb4c549d480be376af809c6d9429`, Pages run `38440755667`, assets `7a12f650c28ece2e`. PR #45 completed the non-calendar backend, browser recovery and privacy follow-up. PR #46 released the modern interface. The productivity follow-up adds guarded inline/bulk task actions, pinned lists, remembered navigation, direct Today highlights and secondary-tool polish; its PR records the exact checked head and release workflows. Releases require a reviewed head, fresh CI checks and an independently matched Pages marker. [Live build identity](https://zubaerahmed13.github.io/Schedule/build-info.json) always identifies the deployed client.

## Verified implementation and backend

- Today, Inbox, Plan, Calendar and Insights share stable canonical task IDs; projects/folders, Kanban, filters, priority matrix, countdowns, voice capture where supported, subtasks and calendar files remain available.
- Deterministic Smart Week Builder, capacity/buffers, fixed/flexible tasks, reviewed placement/splitting, Recover My Week, guarded Undo, task archive/trash, recurring schedule review and exact saved-clock Today/Focus/Insights are delivered.
- Historical IANA-zone conversion now previews exact-instant or local-clock policies, includes completed/archived records, preserves reminder identifiers, downloads an original planner/full review, records a SHA-256 checksum and creates an owner-scoped checkpoint. DST gaps/folds and duplicate destination IDs block conversion. Missing historical zones need an explicit original-zone choice; ordinary saves do not silently assign a new zone. Future original-zone rules retain their clock semantics.
- The 2,740-line controller is replaced by a 609-line startup/orchestrator and 17 injected controller factories with explicit live state accessors. Domain/model modules stay dependency-free. The exact versioned offline shell includes every controller and the public privacy page.
- Correct backend: Supabase WeekWise connection, project `iajkzlsurghfvsmqkmut`. Six Weekwise tables have RLS and validated owner cascades. Cloud writes use the compatible owner-checked revision RPC; direct authenticated writes and anonymous access are denied.
- Invitation validation is active on new Auth accounts: private hashes, atomic expiry/revocation/use limits, retained original private-code hash and a separate owner code generated only inside Vault. Follow-up Auth metadata writes cannot reintroduce newly submitted invite values. Existing account metadata is not rewritten. The owner can find the additional invitation under Vault name `weekwise_owner_invite_code` without putting it into source or a public response.
- Account erasure is active after password reauthentication and session revocation. A successful live disposable-account check verifies isolation, cascades and post-deletion cloud-write refusal. Other accounts/device-only local entries are preserved.
- Push VAPID configuration, authenticated service and exactly one minute scheduler are active. Registration cannot transfer a known endpoint to another account; cross-owner opt-out is harmless. Actual scheduled responses continue to return HTTP 200/ok=true. **Physical app-closed notification delivery remains unverified on each device**; the UI states that limitation.
- A readable, offline-capable [data/privacy page](https://zubaerahmed13.github.io/Schedule/privacy.html) explains storage, external services, exports, retention, sign-out, reminders and erasure. There is no automatic purge of task/editor history, recovery copies or delivery logs. No optional AI provider is configured; core planning does not depend on AI.

## Evidence

| Check | Result |
|---|---|
| Node | 179 tests pass locally, including 12 atomic task-action contracts. Fresh CI evidence is recorded in the productivity PR. |
| Built Chromium | Modern-interface release: 63 tests passed on head `40030133370b0e0e900db3d3a4aec41fa3486bcd`, [browser run 38456056588](https://github.com/ZubaerAhmed13/Schedule/actions/runs/38456056588). The productivity follow-up adds four browser cases; its PR owns the fresh results. |
| Database / functions / release | Isolated PostgreSQL, all five Deno handlers and release/build checks passed on that same head |
| Live backend | 48 bounded boolean checks passed: invitations and minimized stored/sign-in metadata, own/cross/anonymous reads, direct-write denial, first/competing/stale saves, fresh-client reload, push isolation/opt-out/deduplication, refresh revocation, recovery/password/token replay and erasure |
| Cleanup | Zero fresh test identities or invitation groups remain; one-use flag is false; backend checker retired to version 5 / HTTP 410 |
| Accessibility | Audited views and timezone dialog have no serious/critical axe findings; incomplete contrast/name checks remain human review. Keyboard/doubled-dialog-text/quota protection passes at phone width |
| PWA recovery | Real cached offline reload, interrupted worker install retaining the old shell, safe retry/update with an unfinished editor, and offline privacy navigation pass |
| Controlled closed-tab push | An actual DevTools push reaches the real worker with zero Weekwise tabs and invokes notification API with safe scoped URL; CI has no native notification platform, so this is not provider/OS delivery proof |
| Performance | Synthetic Chromium DOM-ready/paint/resource/CLS samples, bounded 10,000-task lists and Node scheduling benchmark are recorded; no field INP or 75th-percentile CWV claim |

See [LIVE_BACKEND_ACCEPTANCE.md](LIVE_BACKEND_ACCEPTANCE.md), [MASTER_PLAN_VERIFICATION.md](MASTER_PLAN_VERIFICATION.md), [WEEKWISE_2_ARCHITECTURE.md](WEEKWISE_2_ARCHITECTURE.md) and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Git history retains earlier phase counts and pending-stage records.

## Remaining acceptance limits

Google/Outlook credentials, consent and round trips are **deferred by the user**. Optional generative AI remains disabled as the master prompt permits. Current general UI language is English and schedule clocks use the established 24-hour presentation; arbitrary localization is not claimed.

Physical phone permission/keyboard/rotation, installed-PWA behavior, real push-provider delivery and expired-device cleanup, human VoiceOver/TalkBack/browser-zoom review, physical two-device reconnection and copies of private historical backups still need their corresponding devices/data. Controlled fixtures and doubled text do not certify those. Real signed-token expiry by waiting and mail delivery are not inferred from refresh/recovery-token checks. Legal/GDPR certification and real-user CWV percentiles are not claimed.

The Supabase organization is on the free plan. Leaked-password protection needs Pro or above and remains disabled; no paid upgrade was made. Other advisory warnings are the reviewed owner-checked SECURITY DEFINER cloud-save RPC and pg_net's catalog namespace (its functions remain in `net`, outside exposed Data API schemas). No-policy/unused-index INFO notices on server-only tables are documented, not "fixed" by granting browser access. [Password-security reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

This is an evidence-backed core release, not a claim that every human/device/legal/field acceptance criterion in the 32-section brief has been certified.
