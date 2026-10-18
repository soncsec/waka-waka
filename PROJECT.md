# Waka-Waka — Project

> **Status:** Approved by the owner on 2026-10-18.

## 1. Summary

A neon maze-chase game: eat every dot in a freshly generated maze while four named opponents, each with its own personality and special move, hunt you down. Clear the maze and a new one appears, with opponents that are faster and smarter and power-ups that are weaker, until the difficulty levels off around maze 20.

## 2. Scope (version 1.0)

| Area | Decision |
|---|---|
| Genre and camera | Top-down, single-screen grid maze chase. Logical size 384×464 (24×27 tiles of 16 px plus HUD), whole-number zoom. |
| Controls | Keyboard: arrows or WASD, with the next turn buffered. Touch: swipe, plus an optional on-screen d-pad. P or Esc pauses; the game also pauses when the tab loses focus. |
| Devices | Desktop browsers, and phones and tablets with touchscreens. Phones are **portrait only**; landscape shows a "rotate your phone" prompt. Tablets play in either orientation. |
| Player | The hero, a teal chomper. 3 lives, plus an extra life at a score threshold set in `tuning.ts`. |
| Opponents | **Murk** (red-pink, spiky): chases the hero's tile; special move *Frenzy* from maze 1. **Gnash** (orange, box with teeth): aims 4 tiles ahead of the hero; *Lunge* from maze 3. **Bolt** (yellow, diamond): flanks using Murk's position; *Dash* from maze 2. **Wisp** (violet, jelly): chases from far away and drifts off up close; *Phase* through a thin wall from maze 5. All four leave a ghost house in turn and alternate between scatter and chase. |
| Mazes | Generated, mirror-symmetric, **new every run**. Every maze is connected, has no dead ends, and has no stretch longer than 10 tiles without a turn-off, counted around corners. A maze that fails the checks is generated again; after 20 failures a built-in maze is used. The run seed is random, shown on the game-over screen, and can be set with `?seed=` to replay a run. |
| Difficulty | Endless. Each maze raises opponent speed (up to a cap), shortens power pellets (later they only turn opponents around), cuts scatter time and switches on special moves, using a table in `tuning.ts`. Levels off around maze 20. |
| Power-ups | Power pellets (opponents turn scared and can be eaten for rising points) and a bonus item that appears twice per maze. More power-ups are a later scope change. |
| Scoring | Points for dots, pellets, opponents and the bonus item. High score in localStorage only. |
| Art | Look B "Neon Arcade": original pixel art drawn in code, so no new third-party art. Fonts and UI reuse what other Soncrant Arcade games already use. |
| Audio | None until milestone M5. Then CC0 sound effects, each set approved by the owner, with a mute toggle. |

Out of scope for v1: multiplayer, online leaderboards, accounts, a maze editor, landscape play on phones (tablets are fine), extra power-ups beyond the pellet and bonus item.

## 3. Constraints (shared by every Soncrant Arcade game)

- Browser only, single player: desktop browsers (current Chrome, Firefox, Safari, Edge), phone browsers in portrait, and tablet browsers either way.
- No accounts, payments, analytics, cookies or third-party requests. localStorage holds only the high score.
- Art keeps its native pixel style; whole-number scaling only.
- Served at `games.soncrant.com/waka-waka/` over HTTP (ADR-010), behind the security headers in the portal's Apache config.
- Security comes first: release only with no critical or high vulnerabilities and passing static (CodeQL, ESLint, npm audit, gitleaks) and dynamic (ZAP) checks.
- Original names, shapes, colours and mazes. Nothing copies Pac-Man's names, characters, maze layouts or trade dress.

## 4. Decisions confirmed by the owner

| Date | Decision |
|---|---|
| 2026-10-18 | Look B, Neon Arcade (custom art drawn in code) |
| 2026-10-18 | Opponents Murk, Gnash, Bolt and Wisp, with special moves |
| 2026-10-18 | Generated mazes, new every run; reject any maze with a stretch longer than 10 tiles without a turn-off, counted around corners |
| 2026-10-18 | Endless with rising difficulty |
| 2026-10-18 | Power pellet and bonus item in v1; more power-ups later |
| 2026-10-18 | CC0 sound effects in a later milestone, after owner approval |
| 2026-10-18 | Touch and mobile support; portrait only on phones |
| 2026-10-18 | No deadline; secure, with no critical or high vulnerabilities |
| 2026-10-18 | Architecture and milestone plan approved |
| 2026-10-18 | The four docs are also kept in the Claude Docs doc "Waka-Waka Project Docs" |
| 2026-10-18 | Playable on desktop and on touchscreen phones and tablets; tablets in either orientation |
| 2026-10-18 | Swipe controls move from M2.6 into M1.3, so the first playable works on touchscreens |
| 2026-10-18 | First live on games.soncrant.com after M1 (the first chase), each release with owner approval; the card keeps its final summary |
| 2026-10-18 | Product review after M1 (tab "Product review" in the Claude Docs doc): quick wins pulled forward into M2.0; the next production release only after M2.3; the difficulty table starts in M2.1; an owner playtest and the originality review close M2; a phone readability check in M4 |

## 5. Open questions

None right now.
