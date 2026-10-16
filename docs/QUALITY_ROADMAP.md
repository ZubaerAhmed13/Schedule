# Weekwise quality roadmap and acceptance

The product promise is simple: capture responsibilities, build a realistic week, and recover when plans change. The existing calendar, planning, habits, focus, history, backups and offline functionality remain available. The current scope excludes Google/Outlook activation; earlier provider requests are historical. Optional AI stays disabled. Release 5 improves existing weekly review with recoverable local drafts, guarded canonical saves, explicit comparison evidence and the previous intention; see [the release contract](WEEKLY_REVIEW_RELEASE.md). Earlier usability, planning and recovery releases remain delivered. Optional planning depth still requires observed need.

| Area | Engineering delivered | Acceptance still needed |
| --- | --- | --- |
| Product clarity and onboarding | Three saved-evidence first steps; guide remains after initial capture, optional dismissal/reopen; no sample tasks or questionnaires | Observe new users capturing, planning and recovering without assistance |
| Interface | Existing forest/cream design, shared controls, responsive light/dark layouts; new consistent help and actionable sync panel | Physical keyboard, touch, rotation, zoom and usability review |
| Sync and data | Existing three-way reconciliation, revision/owner guards; explicit pending/conflict/recovery status and last acknowledged save | Same-account physical two-device offline/reconnect tests |
| Mobile and reminders | Existing cached PWA, keyboard bounds and push service; helpful setup/recovery explanations | Actual iOS/Android installation and app-closed OS receipt |
| Accessibility | Keyboard containment/return focus and automated A/AA audits for core, auth, device and help flows | Knowledgeable WCAG 2.2 AA review including VoiceOver/TalkBack and native zoom |
| Speed | Existing opt-in local web-vitals and bounded 10k-record view behavior | Representative mobile/desktop field p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 |
| Security and privacy | Focused ASVS control mapping, read-only backend review, opt-in diagnostics and updated retention/privacy explanations | Independent security and applicable legal/privacy review; eligible-plan features only by owner choice |
| Operations | Six-hour GET-only public service monitoring, failures in Actions, runbook and diagnostic export | Owner notification settings, SMTP delivery, offsite server backup/restore and measured recovery objectives |
| Capacity and maintainability | Existing modular controllers, bounded views, regression gates and exact release verification | Isolated concurrent backend load testing against observed demand and cost/quotas |
| Support and improvement | In-app first-plan help, sync/offline/reminder/backup answers and explicit public feedback link | Ongoing triage, real user feedback and consented activation/retention measurement |

## Usability sessions

Start with a small round of five participants representative of the intended users; this is a practical first research round, not statistical proof. Use each participant's own consented test profile or empty generated fixture. Do not ask for credentials or copy private planners into public issues.

Ask the participant to capture one responsibility, add an estimate, preview and approve a manageable week, reschedule after an interruption, find a saved task, and export a backup. Include an account-versus-device explanation and, when actual devices are available, an offline/reconnect task. Let them proceed without coaching; record completion, time, misunderstanding, recovery and their own account of what helped. Observe assistive-technology users separately with their chosen tools. Record only consented research notes and minimize private task details.

Choose measurable task-completion and time goals after the first baseline rather than inventing a success percentage. Fix the largest observed obstacle, repeat the affected task with new participants, and compare. Measure first useful plan and subsequent weekly return only with a deliberate consent/collection choice. No remote analytics or participant outreach is activated by this release.

## Release acceptance

Run Node/static/build checks, all existing Chromium regressions, auth/device scenarios across Chromium/Firefox/WebKit, isolated PostgreSQL contracts and Deno handlers. Audit light/dark/narrow/help surfaces and inspect the final screenshots. An unchanged planner is verified for help and diagnostic controls. Error history is verified from an actual controlled failed save and successful retry, with private text excluded and owner switches isolated. Publish only a checked expected head; independently compare source blobs, full tree and public build identity/assets. Keep real-device and provider evidence in issue #22 and never check it off from synthetic tests.

References: [Web Vitals](https://web.dev/articles/vitals), [W3C evaluation](https://www.w3.org/WAI/test-evaluate/), [operations](OPERATIONS.md), [security review](SECURITY_QUALITY.md), [device acceptance](DEVICE_ACCEPTANCE.md).
