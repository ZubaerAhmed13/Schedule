# Locally vendored web-vitals

The optional private device-performance tool uses Google's standard **web-vitals 6.1.0** IIFE bundle, served from `js/weekwise-vitals.js`. No CDN, analytics collector or npm installation runs in the user's browser. The app invokes recording only after an owner has opted in on a previous page load; it retains numeric values and drops callback entries, DOM targets, navigation URLs and upstream metric identifiers.

- Publisher: [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals).
- Package: `https://registry.npmjs.org/web-vitals/-/web-vitals-6.1.0.tgz`.
- Published archive integrity: `sha512-ZNoJ/MbU6aaR2WjKrFVUvy5WQx+G96YvXQFSsmKTz3A/0VlAFywjUcxl00hc/S6wef2stfgQ4yWYIJCWCNudkA==`.
- Bundle SHA-256: `6b3e4ac9d6f6abd4ea1810621668bec7d7adb121279570e6870be4fb98ab3909` (8,987 bytes).
- License: Apache-2.0; original license is included in `web-vitals-LICENSE.txt` and published/cached alongside the client.

The archive was downloaded without running package scripts, its SHA-512 compared to registry metadata, and only the standard IIFE and original license copied. The bundle is unmodified. Its optional developer source-map reference is not needed at runtime. Domain/model modules otherwise remain dependency-free. Pinned Playwright/axe test dependencies execute only in CI, as recorded in workflow files.

Recording defaults off. Stop/owner-change invalidates application callbacks immediately; the upstream observers may remain until page termination, and they have no network sender. A new recording session or owner requires a reload. See [DEVICE_ACCEPTANCE.md](DEVICE_ACCEPTANCE.md) for interpretation and limits.
