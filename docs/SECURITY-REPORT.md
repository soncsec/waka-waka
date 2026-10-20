# Waka-Waka — Security report (M6.1)

> **As of:** 2026-10-20, on commit `ab8445f` (live as release `20261020T205724Z-ab8445fd`), plus the Vite 8.3.3 bump in this PR.
> **Result:** 0 critical and 0 high findings once this PR merges. Three advisories published on 2026-10-20 in a development tool (one high, two moderate) are fixed here; none reaches players.

## Results

| Check | Where it runs | Result |
|---|---|---|
| CodeQL (JavaScript and TypeScript, 126 rules) | CI, every push and pull request | 0 results on `ab8445f`; 0 alerts open, none ever raised |
| ESLint | `npm run check`, CI | Clean |
| `npm audit` | CI (fails on high or critical), local | On Vite 8.3.2: 1 high (three advisories, below), which fails the CI gate from 2026-10-20. On Vite 8.3.3: 0 of any severity |
| gitleaks 8.30.1 (pinned, checksum checked) | CI, whole history | 47 commits scanned, no leaks (also run locally: none) |
| GitHub secret scanning and Dependabot alerts | GitHub | 0 open |
| OWASP ZAP 2.17.0 baseline (passive) | CI, against staging on GitHub Pages | 0 failures, 0 high; 13 warnings, explained below |
| Production headers | `curl` of the live site | All set (below) |
| Production-CSP end-to-end test | `npm run check`, CI | The game runs under the production policy with no violations |
| Live check after release | Chromium and Firefox against the live site | No console errors, no requests to other hosts, no test hook, all 12 sounds load from our own server |

## The Vite advisories (fixed)

Three advisories were published on 2026-10-20 for `launch-editor`, which Vite 8.3.0–8.3.2 bundles for its dev server's "open in editor" feature:

| Advisory | Severity | What |
|---|---|---|
| [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | High | A file existence check can be bypassed on Windows |
| [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | Moderate | Editor command-line flags can be misread, running commands with some editors |
| [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | Moderate | `%` is not escaped on Windows |

All three need the Vite dev server running and a request to its editor endpoint. The dev server is a development tool: it never ships to players, and the dev machine runs Linux. Vite 8.3.3 fixes all three (released 2026-10-06, so it meets the two-week rule); the owner approved the bump on 2026-10-20. Nothing else in the lockfile changed. Other Soncrant Arcade repos on Vite 8.3.0–8.3.2 (including the games portal) are affected the same way and need the same bump.

## ZAP warnings on staging

Staging is GitHub Pages, which cannot send custom headers. Production is Apache, which sends them all. Each warning:

| Warning | Why it shows on staging | Production |
|---|---|---|
| CSP header not set; CSP directive and `style-src 'unsafe-inline'` notes | Pages sends no CSP for the game. The `unsafe-inline` and directive notes come from GitHub's own 404 pages at `soncsec.github.io/`, which the scan also visits | Strict CSP: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` and more |
| Missing anti-clickjacking header | Pages limitation | `X-Frame-Options: DENY` and `frame-ancestors 'none'` |
| X-Content-Type-Options missing | Pages limitation | `nosniff`, on pages, scripts and sound files |
| Permissions Policy not set | Pages limitation | Camera, microphone, location, payment and USB off |
| Cross-domain misconfiguration | Pages sends `Access-Control-Allow-Origin: *` | No CORS header; `Cross-Origin-Resource-Policy: same-origin` |
| Strict-Transport-Security not set | — | The site is HTTP by the owner's decision (shared ADR-009); no HSTS until the site moves to HTTPS |
| Cross-Origin-Opener/Embedder-Policy | — | Not set: the game uses no cross-origin isolation features. Low; accepted |
| Timestamp disclosure | A large number inside the Phaser bundle that looks like a Unix time | False positive |
| Cache notes (informational) | Normal caching of static files | `index.html` is `no-cache`; the hashed assets can cache |

## What the game reads and stores

- **Inputs:** `?seed=` (a whole number up to 2³²−1, otherwise ignored) and three localStorage values: the high score (a non-negative safe integer), reduced flash and mute (each exactly `"1"` or `"0"`). Anything else is removed or reset, and nothing from the URL or storage is ever put into HTML (WW-08). Unit and e2e tests cover tampered values.
- **Requests:** only our own origin. No analytics, cookies, accounts or third-party hosts; the e2e tests and the live check fail on any foreign request.
- **Release safety:** `scripts/release.sh` refuses unless HEAD is `origin/main`, the tree is clean and every required CI check (including ZAP) passed on that commit; it refuses to upload a build containing the test hook, and smoke-tests the live headers after switching.

## Open items

- HTTPS for `games.soncrant.com` (shared ADR-009): an owner decision for the whole arcade, not this game.
