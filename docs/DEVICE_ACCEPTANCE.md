# Weekwise priorities 4–6: device, accessibility and recovery evidence

Open **Settings → Device, speed & recovery** on the device you normally use. These tools are implemented; physical acceptance still needs real observations. Google/Outlook remain deferred, and optional AI remains disabled.

| Priority | Delivered engineering | Evidence still required |
| --- | --- | --- |
| 4 — Real-device reliability | Read-only service-worker/cache health, installed-window detection, notification permission/local subscription status, PNG/Apple install icons, visible-viewport form bounds and independent Chromium/Firefox/WebKit scenarios | Closed-app provider/OS delivery; actual installed Safari/iOS/Android use; phone keyboard/rotation; physical two-device offline reconnect |
| 5 — Human accessibility | Labelled progressive tool, keyboard containment/restoration, 320px/enlarged-text checks, focus margins above sticky navigation, light/dark axe checks | VoiceOver/TalkBack interpretation and announcements; native browser 200% zoom; actual mobile keyboard/touch |
| 6 — Speed and recovery | Opt-in local web-vitals samples, per-build/viewport p75 and counts, bounded view-to-paint measurements, checksum/count reports, same restore entries rehearsed in isolated memory | Representative real usage over time and real backup selection; full restore in an isolated browser profile; broad field-performance acceptance |

## Confirming your device

Each checkbox is a dated **confirmation by you**, scoped to this account/browser profile and build. It begins unconfirmed; a capability probe never checks it automatically. Repeat confirmations made on an earlier build. Keep downloaded reports private; they include device evidence and backup checksums/counts, without task text or authentication tokens.

1. Enable background reminders from reminder settings. Schedule a harmless reminder a few minutes ahead, close all Weekwise tabs and confirm that a system notification arrives. Subscription readiness alone does not prove delivery. Some phone browsers require home-screen installation.
2. Install the app using your browser menu or Share → Add to Home Screen. Open once online, then reopen offline. A cloud account's saved offline copy and a device-only planner remain separate.
3. Use the actual phone keyboard, rotate the screen and check that capture/editor fields and Save remain reachable.
4. Use two physical devices signed into the same account. Make a harmless edit with one offline, reconnect and review any revision conflict deliberately. Confirm the chosen change remains on both devices. Remove the temporary task afterward.
5. Use VoiceOver/TalkBack through Today, capture, the highlight picker and editors. Check labels, status announcements, focus containment and return focus. Then use native 200% browser zoom with Tab/Shift+Tab/Enter/Escape and check sticky-bar occlusion.

## Private speed evidence

Recording is off by default. Enable **Record future page loads**, save unfinished work and reload. Keep using the app normally. The locally vendored standard `web-vitals` 6.1.0 library supplies LCP/INP/CLS; the app retains numeric values only, not callback entries/DOM targets/URLs. Views use a small allowlist; custom list/folder/tag names become generic categories. No measurement upload or analytics account is used.

Evidence is scoped to the current account/browser profile, separated by build and viewport class, and bounded to 80 page samples with 50 view-response measurements each. `null` means unavailable/unobserved, not zero. p75 uses nearest-rank values from available samples; sample counts remain visible. Fewer than 20 samples is labelled limited evidence. Twenty samples is a local diagnostic threshold, not a claim of statistical field acceptance. INP samples require observed qualifying interactions; unsupported APIs remain unavailable. Stopping/clearing or switching owners invalidates page callbacks. A new owner needs a reload before a fresh page can be recorded.

Reference targets from the [Web Vitals documentation](https://web.dev/articles/vitals): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. A single personal device's history is not CrUX or a representative real-user population score. View-to-paint values are app diagnostics, separate from standardized INP.

## Backup rehearsal and full restore

Choose a copy of an actual Weekwise JSON backup under 10 MB. Parsing, validation, complete production restore entries and checked storage transactions run against a fresh memory store. The production importer now captures the owner, auth epoch and included collection bytes before reading a file, then rechecks them before confirmation and before committing. Account switches or newer edits abort without a confirmation or write. Round-trip validation includes all persisted planner fields and every auxiliary collection present in the backup. Absent auxiliary collections stay absent. Reports contain SHA-256 of the original file, bytes/counts and the rehearsal result; no task contents. The selected file is never uploaded or persisted by this tool. Owner changes cancel pending results and clear the selected file/report.

For a **full** historical restore acceptance test, open a separate browser profile, leave cloud sign-in off, import a copy through the existing restore workflow, and check original IDs, notes, reminder identifiers, recurrence, archive/history, habits and recorded focus. Reload, export the restored copy and compare it to the original. Keep your primary profile and original file unchanged. An in-memory rehearsal is useful evidence but does not test that physical profile's storage/quotas, cloud restoration or a file not selected.

## Automated scope

The Chromium regression suite adds a real worker/cache health case and remains mandatory (69 cases). The device workflow runs eight additional scenarios in each of Chromium, Firefox and WebKit: read-only account isolation, exported-copy rehearsal, opt-in numeric recording/privacy, simulated keyboard geometry, narrow/enlarged-text focus, quick edit/Undo, two independent revision contexts with a controlled failed network write, and phone light/dark axe audits. All records and credentials are synthetic and isolated; no live user is a writable fixture. WebKit on Linux is an engine check, **not physical Safari**. Keyboard geometry and font scaling are controlled simulations, **not native OS keyboard or browser zoom certification**.

[Playwright browser support](https://playwright.dev/docs/browsers), [VisualViewport reference](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) and [third-party provenance](THIRD_PARTY.md) explain the underlying mechanisms. Exact checked heads, workflows, screenshots and public deployment identity are recorded in the release PR and issue #22.
