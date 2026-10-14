# Weekwise design system

Shared tokens in `css/weekwise.css` and the final `css/weekwise-modern.css` layer define warm off-white backgrounds, white surfaces, forest text, green actions and restrained peach/lavender/sky accents. Dark mode uses neutral charcoal surfaces with readable green actions. Existing tool styles share the adaptive surface/text/border aliases. Assets are local and service-worker cached; no new framework, font service or runtime dependency is required.

Primary navigation: Today, Inbox, Plan, Calendar and Insights, with consistent SVG line icons. Tools & views groups Search, Tomorrow, Upcoming, Board, Filters, Matrix, Habits, Focus, Countdowns and Statistics. Pinned lists appear above grouped navigation. List pins sync through existing planner settings; owner-scoped disclosure preferences stay on the device. Lists, folders and tags use native labelled disclosures; a saved active destination reveals its parent group. Settings remains directly reachable. On phones the five primary destinations form a bottom bar; Menu exposes all groups. The global add button opens the existing editor. Existing More actions and deep links remain.

Today places quick capture before daily decisions, then shows a saved-zone date, next commitment, real workload, chosen priorities and a compact timeline. Priorities and timeline share desktop columns and stack on phones. List sharing/import live under List options. Plan begins with a read-only saved-workload overview and a choose/review/apply guide. Planning preferences summarize days, hours, daily buffer and custom windows before expanding into the existing controls. Build, Recover, validation, guarded apply and Undo retain their existing contracts.

The editor keeps title, list, day, schedule mode, time/duration and a note visible. Priority & planning; repeat, due date & reminders; category, folders & tags; and subtasks/links use native disclosures. Groups with existing selected metadata open automatically on edit or draft restoration. Invalid hidden fields reveal their ancestors before focus. Disclosure state is presentation only and does not enter saved planner records.

## Components

- System typography: 31–36px workspace headings, 13–14px task/body text and 16px phone inputs.
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

## Productivity controls

Quick edit stays in the task list and changes only explicit edited fields. A calendar date/time change checks exact availability and refuses collisions; fixed/recurring and linked timing retain their reviewed editors. Selection mode supports up to 500 explicitly chosen tasks, a review dialog for completion/reopening/list moves/tag additions/priority, and guarded exact Undo. Existing descriptive fields and reminder instants remain intact. Linked parent progress follows selected parts. Today offers a searchable, bounded highlight picker capped at three unfinished responsibilities.

Quick-edit drafts are owner-scoped device copies, protected from stale draft writes and app updates. Restore refuses to overwrite a changed original task; download/discard remain available. New local preference/draft keys participate in confirmed account cleanup. Calendar files/reminders, habit creation/tips and Focus history use labelled disclosures. Shared SVG actions, 44px form controls, fewer introductory paragraphs and consistent adaptive surfaces unify the secondary tools.
