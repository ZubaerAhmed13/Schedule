# Weekwise named Today welcome — research, behaviour and acceptance

## Decision

Use **one** low-friction, optional personalised greeting on the authenticated/device-only **Today** screen. Keep task views, navigation, sign-in, system notifications, error messages, public marketing and account recovery neutral. The name is an expression of preference, **not a login identity**.

Example when the saved preferred name is "Ada": **Good morning, Ada.** The source is `store.settings.profile.fullName` for the currently selected planner owner; it is never inferred from email, usernames, date of birth, or task content. The owner's saved time zone and existing Today clock provide the morning (<12:00), afternoon (<18:00) and evening (18:00 onward) boundary. Exact sentence punctuation is retained.

If there is no saved name, the option is off, or the profile is an older backup, keep **Good morning.**, **Good afternoon.** or **Good evening.** without prompting for personal information. Do not assume a family name or split a multiword name: the user may enter a preferred name in any writing system.

Today now shows the same greeting and local date even for an empty planner, while preserving the existing optional getting-started guide and its first-task action. On task-filled days, the existing workload / next-commitment presentation remains untouched.

## User control and privacy

Settings → Personal details offers **Greet me by name on Today**. It is enabled by default for existing saved names, but can be disabled without deleting the name or birth date. The optional `showNameInGreeting:false` lives alongside the existing planner profile and participates in the current owner-safe transaction, account sync, backup, restore and account-switch isolation. Older profiles (no preference) keep their exact shape on save when enabled. Clearing all details removes the profile; no new backend table, permission, timestamp, telemetry or network request is necessary.

Never personalise the unauthenticated "Welcome back" entry or an OS notification: either could be visible to someone other than the planner owner. This change does not implement birthday greetings, age calculation, generated nicknames or fake celebrations. The saved name is escaped before inserting it in the DOM. Extra-long names wrap, and the greeting is an ordinary heading (not an interruptive live region).

## Research basis

- Nielsen Norman Group, *The Dangers of Overpersonalization*: use just enough personalisation to reduce friction, avoid repetitive intrusive mentions. https://www.nngroup.com/articles/overpersonalization/
- Nielsen Norman Group, *Customization vs. Personalization in the User Experience*: allow the individual to control personalisation. https://www.nngroup.com/articles/customization-personalization/
- Google Material communication principles: concise, clear, context-specific language. https://codelabs.developers.google.com/codelabs/material-communication-guidance
- Microsoft style guidance, names and contact information: a name may not be the right form of address for every culture; don't infer how to address someone. https://github.com/MicrosoftDocs/microsoft-style-guide/blob/main/styleguide/global-communications/names-contact-information.md
- W3C accessibility design pattern, *Support a Personalized and Familiar Interface*: make preferences familiar and easy to configure. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o8p04-interface/

## Verification

- Unit: 00:00 / 11:59 / 12:00 / 17:59 / 18:00 / 23:59 boundaries, no-name fallback, legacy data, multi-word and international preferred names, opt-out round trips and invalid preference value.
- Browser: empty Today, first save, return from Settings, reload, opt-out and re-enable, safe HTML text insertion, and two-account isolation.
- Preserve manual acceptance for physical device settings, long names on small screens, screen reader heading navigation and cloud reconnect. Automated browser checks alone do not certify those scenarios.

The greeting does not reveal personal information on a signed-out page or change existing task/schedule data.
