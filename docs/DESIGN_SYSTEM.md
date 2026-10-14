# Weekwise design system

Shared tokens in `css/weekwise.css`, `css/weekwise-modern.css` and the final `css/weekwise-polish.css` layer define warm off-white backgrounds, white surfaces, forest text, green actions and restrained peach/lavender/sky accents. Dark mode uses neutral charcoal surfaces with readable green actions. Existing tool styles share the adaptive surface/text/border aliases. Assets are local and service-worker cached; no new framework or font service is required. The optional device evidence module uses a pinned, locally served web-vitals bundle.

Primary navigation: Today, Inbox, Plan, Calendar and Insights, with consistent SVG line icons. Tools & views groups Search, Tomorrow, Upcoming, Board, Filters, Matrix, Habits, Focus, Countdowns and Statistics. Pinned lists appear above grouped navigation. List pins sync through existing planner settings; owner-scoped disclosure preferences stay on the device. Lists, folders and tags use native labelled disclosures; a saved active destination reveals its parent group. Settings remains directly reachable. On phones the five primary destinations form a bottom bar; Menu exposes all groups. The global add button opens the existing editor. Existing More actions and deep links remain.

Today places quick capture before daily decisions, then shows a saved-zone date, next commitment, real workload, chosen priorities and a compact timeline. Priorities and timeline share desktop columns and stack on phones. List sharing/import live under List options. Plan begins with a read-only saved-workload overview and a choose/review/apply guide. Planning preferences summarize days, hours, daily buffer and custom windows before expanding into the existing controls. Build, Recover, validation, guarded apply and Undo retain their existing contracts.

The editor keeps title, list, day, schedule mode, time/duration and a note visible. Priority & planning; repeat, due date & reminders; category, folders & tags; and subtasks/links use native disclosures. Groups with existing selected metadata open automatically on edit or draft restoration. Invalid hidden fields reveal their ancestors before focus. Disclosure state is presentation only and does not enter saved planner records.

## Components

- Self-hosted Plus Jakarta Sans variable typography, with system fallback: 42px desktop and 34px phone workspace headings, 13–14px task/body text and 16px phone inputs. The full OFL notice ships with the 60KB WOFF2 asset; its content-derived filename and preload match the offline cache. No browser request goes to a font service.
- Cards: 15–22px radii, one-pixel borders, restrained shadows and 18–28px padding.
- Green primary action with white text in light mode and dark text on pale green in dark mode; neutral secondary actions. Visible focus ring and recognizable disabled state.
- Labeled inputs, fieldsets, checkbox text labels and wrapping button rows. Phone inputs use readable text sizes, scrollable editors and bottom action visibility.
- Meaningful empty screens. Today prompts capture; Insights explains what real activity will produce. No sample tasks or invented zero-valued achievement charts are seeded.
- Textual errors/status, polite announcements and explicit preview approval. Color alone never communicates a state.
- Dialog keyboard focus containment/restoration and inert background. Native dialogs are used for split/capture review. The task editor is the keyboard alternative to dragging.
- Reduced motion follows the system preference. Device text scaling and system light/dark preference remain available.

## Quality evidence and boundaries

CI retains 1440/820/390px screenshots. Light layouts and actual responsive forms have been reviewed; the expanded suite adds dark Today/Plan/Insights screenshots at all widths, keyboard containment, existing calendar/editor regressions and no page-level horizontal overflow. Screenshot capture resets scroll/focus so sticky controls do not obscure the full-page review.

Human screen-reader testing, complete text-zoom review, installed-PWA standalone presentation and real mobile-keyboard acceptance remain separate from automated checks. The screenshot/audit suite is not a WCAG certification. All existing controls and features remain reachable; no planner migration or backend change accompanies the redesign.

## Motion and finishing

The final `css/weekwise-polish.css` layer shares adaptive depth, readable numerical alignment, active navigation markers, selected-theme checks and focus feedback across all five palettes. Hover elevation is limited to fine pointers. Press feedback, wrapping labels, phone safe areas, forced-colour selection and the existing keyboard focus ring remain available. Dialog headers and secondary forms follow the same spacing and surface hierarchy.

`js/weekwise-motion.js` performs presentation only. Explicit navigation reveals up to five existing sections over 260ms with 28ms offsets; calendar period/view changes settle the existing grid without the old forced reflow or blur animation. Only the current entrance survives rapid navigation. Routine sync, timer ticks and re-rendering the current view do not start page entrances. Completion feedback resolves the newly rendered control and runs only after its checked state is confirmed; completed tasks do not pulse again on refresh.

Menus, native dialogs, utility panels, the task editor and the sign-in illustration use finite entrance animations. No action, form submission, focus restoration or dialog close waits for an animation. CSS and JavaScript both follow `prefers-reduced-motion`; changing that preference cancels active JavaScript animations immediately. Hidden pages cancel queued effects. No library, analytics, network call, persisted preference or planner mutation is added by motion. Both assets belong to the versioned offline shell.

Content remains fully opaque throughout entrances so text contrast is retained during motion. Only decorative illustration/backdrop layers fade. Foreground and background palette colours change together immediately; shadow and transform feedback can still animate. Text links and keyboard rings follow the selected palette; primary add actions use the existing local SVG icon system instead of font-dependent full-width symbols.

Browser checks cover rapid navigation, finite animation duration, preference changes during motion, unchanged original records, keyboard Escape/focus restoration, native copy dialogs, phone overflow and reduced-motion task capture. Existing five-theme audits and desktop/phone screenshots remain part of review.

## Workspace composition

Desktop navigation occupies a bounded, scrollable surface with a solid selected destination. Phone navigation retains the five primary destinations and the expandable Menu. Compact page actions use the same labelled local SVG controls. Today combines the next saved commitment with a read-only completion summary, then highlights and the timeline; capture stays directly above the overview. The completion summary includes activities assigned to today, carried overnight/all-day activities and deadlines due today, and excludes records that explicitly do not require completion. It counts saved completion marks, not measured work. An unassigned day uses text rather than an invented progress chart.

Task lists share a continuous surface and show real schedule metadata without repeating Inbox labels. Every edit, selection, highlight and delete control remains available, with a compact two-column action grid on phones. Plan uses a compact four/three-column phone day overview and three readiness metrics so navigation and planning preferences remain close to the workload. Settings cards use consistent decorative line icons, and the editor, habit, focus, summary and filter forms share the same type and surface hierarchy. Browser checks include a failed-font fallback that still permits task capture and preserves existing records.

## Productivity controls

Quick edit stays in the task list and changes only explicit edited fields. A calendar date/time change checks exact availability and refuses collisions; fixed/recurring and linked timing retain their reviewed editors. Selection mode supports up to 500 explicitly chosen tasks, a review dialog for completion/reopening/list moves/tag additions/priority, and guarded exact Undo. Existing descriptive fields and reminder instants remain intact. Linked parent progress follows selected parts. Today offers a searchable, bounded highlight picker capped at three unfinished responsibilities.

Quick-edit drafts are owner-scoped device copies, protected from stale draft writes and app updates. Restore refuses to overwrite a changed original task; download/discard remain available. New local preference/draft keys participate in confirmed account cleanup. Calendar files/reminders, habit creation/tips and Focus history use labelled disclosures. Shared SVG actions, 44px form controls, fewer introductory paragraphs and consistent adaptive surfaces unify the secondary tools.

## Device evidence and visible viewport

Settings opens one progressive Device, speed & recovery tool. Read-only capability status is separate from dated human confirmations. Performance recording is opt-in and local; unsupported metrics show no sample. Backup selection restores only into isolated memory and can export a checksum/count report. Controls reflow at 320px, dialogs use the visible viewport height, and navigation is hidden when a detected phone keyboard would obscure a focused input. Pinch zoom is not classified as a keyboard. Physical keyboard, screen-reader and native zoom tests remain open.
