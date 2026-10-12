# Weekwise design system

Shared tokens in `css/weekwise.css` define background, surface, soft surface, text, muted text, border, green brand, radius and shadow. Body `data-theme=dark` uses the same tokens. Legacy styles are extracted intact, then shared overrides unify the preserved tools.

Primary navigation: Today, Inbox, Plan, Calendar and Insights. Secondary navigation retains Search, Tomorrow, Upcoming, Board, Filters, Matrix, personal/custom lists, folders, tags, Habits, Focus, Countdowns, Statistics and Settings. On phones the five primary destinations form a bottom bar; Menu exposes every secondary tool. The global add button opens the existing editor. Existing More actions and deep links remain.

## Components

- Restrained system typography: 32px workspace headings, 14–15px task/body text, clearly grouped supporting text.
- Cards: shared 16px radius, one-pixel border, subtle shadow and 18–26px padding.
- Green primary action with white text; neutral outlined secondary actions. Visible focus ring; disabled state remains recognizable.
- Labeled inputs, fieldsets, checkbox text labels and wrapping button rows. Phone inputs use readable text sizes, scrollable editors and bottom action visibility.
- Meaningful empty screens. Today prompts capture; Insights explains what real activity will produce. No sample tasks or invented zero-valued achievement charts are seeded.
- Textual errors/status, polite announcements and explicit preview approval. Color alone never communicates a state.
- Dialog keyboard focus containment/restoration and inert background. Native dialogs are used for split/capture review. The task editor is the keyboard alternative to dragging.
- Reduced motion follows the system preference. Device text scaling and system light/dark preference remain available.

## Quality evidence and boundaries

CI retains 1440/820/390px screenshots. Light layouts and actual responsive forms have been reviewed; the expanded suite adds dark Today/Plan/Insights screenshots at all widths, keyboard containment, existing calendar/editor regressions and no page-level horizontal overflow. Screenshot capture resets scroll/focus so sticky controls do not obscure the full-page review.

This is not a WCAG certification. Human screen-reader testing, complete contrast/text-zoom review, installed-PWA standalone presentation and real mobile-keyboard testing still require manual release review. Existing secondary icons and some dense legacy tool layouts remain candidates for further refinement; no feature is hidden permanently to simplify the redesign.
