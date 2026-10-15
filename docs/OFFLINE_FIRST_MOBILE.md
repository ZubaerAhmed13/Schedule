# Weekwise mobile offline-first account behaviour

Research date: 2026-10-15. Scope: installed mobile web app/PWA and ordinary mobile browsers. This is an enhancement to the existing local-first Weekwise store and Supabase sync, not a new backend or a remote outbox service.

## Evidence and decisions

- Todoist's offline support allows task edits and completion, indicates offline state, and synchronizes upon reconnection. It warns users not to log out with unsynced changes and requires a signed-in account before offline operation: https://www.todoist.com/help/articles/use-todoist-while-offline-4rbaZw
- Google's Android Calendar can create/edit events offline and uploads after reconnect, whereas its *desktop website* offline mode is view-only: https://support.google.com/calendar/answer/1340696?co=GENIE.Platform%3DAndroid&hl=en and https://support.google.com/calendar/answer/1340696?hl=en
- Notion mobile/desktop offline pages require preparing content for offline use and warn that non-text conflicts may not merge automatically. Browser-only Notion offline editing is unsupported; Weekwise's own PWA can be different: https://www.notion.com/en-gb/help/use-pages-offline
- Supabase persistSession retains auth material in browser storage, while explicit `signOut({scope:'local'})` revokes the current device's session rather than silently logging out other devices: https://supabase.com/docs/reference/javascript/auth and https://supabase.com/docs/guides/auth/signout
- Background Sync is not supported by all browsers (including significant iOS/Safari use), so never claim the server was updated while the app was closed. Foreground on-line events, focus, visibility, and the current 15-second check provide the durable fallback: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API and https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation

## Offline access model

A cloud account that **successfully connected to Supabase** receives a device-local, owner-scoped offline eligibility record, valid for at most 30 days since that successful connection. An identifier in the saved cloud metadata alone is **not sufficient**. The gate permits the same owner to reopen their cached account while the device is offline, not another owner, and cannot grant access to an account never verified on the device.

Offline operations save to existing checked local transactions and are not represented as uploaded until the cloud server confirms them. On reconnect, the client tries the existing Supabase session and reconciles the existing snapshot/revision. If the session cannot be recovered, the app retains pending data and requests sign-in to the same account. Existing multi-device conflicts remain reviewable. Never reset the planner, automatically use another account's cloud content, or silently discard local edits.

**Explicit sign-out:** user choice immediately revokes local offline access, closes the app gate, and attempts Supabase local-scope sign-out. Unsent changes remain saved in owner-scoped local storage, but the user must log in to access/sync them. Warn before signing out with unsent data. Do not treat a temporary network drop as voluntary logout. Once this device has successfully used a signed-in account, disable the unrelated guest entry on that device to prevent post-sign-out browsing of a guest planner. Existing never-associated device-only planners remain available on other devices. No local user data is erased by the change.

## Mobile experience

Keep the mobile top bar focused on navigation and adding tasks: no permanent sync badge or extra status row. A user can find **Synced**, **Saved offline**, **Syncing**, conflict review, and offline/account information under the three-dot menu → **Account & sync**. Never assert an upload succeeded until the server confirms it.

## Limitations and residual risk

- The offline eligibility record and planner are browser local data, **not encrypted at rest** by this feature. A person who can inspect the unlocked device/browser profile or alter web storage can potentially read or alter it. Device lock and disk encryption are recommended; strong local encryption/PIN could be a later separate project.
- Network-offline state can be ambiguous on captive or unreliable connections. The app retains edits and retries on future activity; opening the cached planner after authentication expiry may require a verified network session first.
- Remote logout, revoked tokens and account deletion cannot be discovered while the phone has no connection; stored eligibility expires after 30 days without a successful verification.
- No guaranteed background upload while iOS Safari has closed the PWA, browser storage cannot be guaranteed against OS eviction, and server confirmation is distinct from local save.
- A device-only planner is not a hidden cloud account; it is intentionally separate. Existing device-only records are preserved.

## Acceptance checks

- Unit: expiry, wrong owner, clock rollback, explicit logout, verified new sign-in, badge states.
- Browser: authenticated 390px phone offline create/edit -> local persistence -> online sync; explicit logout -> gate and no cached account access even offline; saved-account offline reload; unrelated owner isolation; device-only mode on a never-associated device; no hidden account data exposed by buttons.
- Cross-browser: Chromium, Firefox and WebKit via existing CI. Separate manual iPhone and Android installed-PWA tests remain necessary; browser simulations alone do not prove OS eviction protection or background delivery.
