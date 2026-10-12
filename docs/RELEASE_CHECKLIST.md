# Weekwise 2.0 release gates

This branch is a review candidate; merging/publishing is a separate authorized action.

- [x] Audit exact baseline and record a safe development branch.
- [x] Dependency-free release sanity checks and Node tests pass locally.
- [x] Preserve existing keys, IDs, completion history, recurrence exceptions and backup format.
- [x] Add bounded backup validation, confirmed restore and recovery checkpoint.
- [x] Add explicit planning preview/acceptance, checked local persistence and guarded Undo.
- [x] Cache added modules/CSS and bump release cache generation.
- [x] Browser CI passed at 76b5bb7 including editor, calendar and Plan tests; rerun after follow-up changes.
- [x] Both Supabase Edge Functions type-checked in CI at 76b5bb7.
- [x] Reviewed styled light-theme screenshots at desktop/tablet/mobile widths.
- [ ] Review dark-theme screenshots and installed-PWA layouts.
- [ ] Complete keyboard, screen-reader, contrast, zoom and modal focus review.
- [ ] Validate an actual legacy-user upgrade and valid backup restore in an isolated profile.
- [ ] Verify installed PWA update/offline loading; independently confirm local use without online sign-in.
- [ ] Verify two-device revision conflicts, interrupted requests, offline reconnect and account isolation with test accounts.
- [ ] Read-only production SQL diagnostic confirms intended schema/RLS and invite trigger.
- [ ] Provider setup and Google/Outlook round-trip verification, if enabling integrations.
- [ ] Background push closed-app delivery and unsubscribe/expiry verification, if enabling push.
- [ ] Browser performance measurements with large synthetic collections; Core Web Vitals claims need real evidence.
- [ ] Security/privacy review, especially direct authenticated table writes, OAuth, imports, external requests and secret boundaries.
- [ ] Authorize merge/release after unresolved high-severity risks have been addressed.
- [ ] After deployment: exact build-info commit/run marker matches released commit.

Never mark an optional integration live from source/contract tests alone. No OAuth, VAPID, privileged Supabase or AI secrets should be placed in frontend code.
