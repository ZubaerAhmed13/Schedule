# Homepage, account entry and organised Settings

## Research and decisions

- Chrome's PWA guidance recommends that an installed app start directly in the application rather than its marketing page: https://web.dev/articles/add-manifest
- The manifest start URL is a launch hint; actual display mode and the iOS standalone flag also distinguish installed launches, including existing installations: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url and https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode
- Give the manifest a stable ID equal to its previous implicit ID (`./`) before changing start_url, so existing installs keep their identity: https://developer.chrome.com/docs/capabilities/pwa-manifest-id
- Group settings by user purpose. Account/profile, appearance, planning/time, reminders, data/files and help/device remain distinct, following the platform approach of organising related settings: https://developer.apple.com/design/human-interface-guidelines/settings and https://www.todoist.com/help/account-and-billing/account/change-your-name-or-avatar-photo-pPt111AI
- Supabase getSession is used by the existing browser session flow to choose a screen; it is not a new server authorization check: https://supabase.com/docs/reference/javascript/auth-getsession . Existing RLS, owner isolation, signed-out locks, recovery callbacks and offline grants remain authoritative.

## Entry contract

Browser visitors see the product homepage, with no visible login form. The Sign in link opens `./?page=signin`, a separate addressable account page served by the same static app shell. Public/account links use native document navigation, so refresh, deep links, browser Back/Forward and password managers work without a server rewrite. There is exactly one auth form. Public page navigation never submits credentials or mutates planner records. A neutral loading state waits for the existing session initialization, avoiding a marketing-page flash for authenticated visits. Successful authentication and restored sessions enter Today through the existing finishSignInLanding path. Existing explicit device-only mode remains available.

Installed launches use `./?view=today&launch=app` and skip marketing, including when sign-in is needed. Standalone/fullscreen detection and iOS navigator.standalone cover existing installed apps whose old manifest start URL is still cached. Browser visits remain eligible for the homepage. Sign-out retains existing account/offline revocation and returns to the browser homepage or installed account screen. No cache flag is promoted to proof of authentication. Password recovery retains the original dedicated account recovery workflow.

## Settings contract

Six categories progressively reveal existing controls without replacing forms or handlers. Unsaved fields survive switching categories. The current category resets at an owner change. Planner time zone belongs to Planning & time; account deletion belongs to Account; JSON, .ics and draft recovery controls remain exclusively in Settings. Themes, accessible input alternatives, reminder delivery, backup confirmation/checkpoints, device checks and troubleshooting remain available. Homepage examples are illustrative and never contain user data. Google/Outlook configuration is unchanged.

## Validation boundary

Run the existing Node, release/build, browser regression and three-engine device/auth suites, with additional entry, history, installed launch, session restoration and category accessibility checks. CI screenshots support visual inspection. Actual iOS/Android installation, home-screen launch and OS session behaviour still require real-device observation.

Explicit account-page visits take precedence over remembered device-only mode. A null INITIAL_SESSION event preserves a deliberately selected local planner instead of reopening the public gate. The auth fixture emits the same initial event as Supabase, including local-mode reload and explicit account-page regression cases.
