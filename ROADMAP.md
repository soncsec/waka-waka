# Waka-Waka — Roadmap

> **Status:** Approved by the owner on 2026-10-18. Every milestone ends with something playable on staging (https://soncsec.github.io/waka-waka/). One task per branch and PR.

| Milestone | Status |
|---|---|
| M0 Setup | Done |
| M1 First playable | Done |
| M2 Full classic game | Done |
| M3 Endless and smarter | Done |
| M4 Mobile and polish | Done (signed off by the owner, 2026-10-20) |
| M5 Sound | Done |
| M6 Release | Not started |

## M0 — Setup

- [x] M0.1 Repo created from `soncsec/game-template`, `scripts/init-game.sh` run (PR #1); own ports 5182/6182/6183 (PR #2)
- [x] M0.2 Branch protection on `main` with the four required checks
- [x] M0.3 GitHub Pages turned on (Actions mode, `main` only); first staging deploy and ZAP scan pass
- [x] M0.4 Portal entry `games/waka-waka.json` (status `in-development`) merged in `soncsec/games-portal` (PR #24)
- [x] M0.5 PROJECT.md, ARCHITECTURE.md and ROADMAP.md approved by the owner (PR #3)

## M1 — First playable

- [x] M1.1 Maze generator and validator in `src/logic/maze/` (WW-03), with tests over 1,000+ seeds and the fallback maze
- [x] M1.2 Draw the maze, dots and pellets in look B, at 384×464 with whole-number zoom (WW-04, WW-05)
- [x] M1.3 Hero grid movement with turn buffering, from the keyboard and from swipes (WW-01, WW-06); eating dots, score in the HUD
- [x] M1.4 Murk chases the hero; lives, death, game over and restart
- [x] M1.5 Playwright: boots clean, hero moves and eats dots, Murk catches the hero, through the test hook
- [x] M1.6 First production release (owner approval): security report (CodeQL, ESLint, `npm audit`, gitleaks, ZAP), a 256×192 card image and `"status": "live"` by PR to `soncsec/games-portal` (the summary stays as it is), `scripts/release.sh deploy`, then the portal release and its production check (game released 2026-10-18; portal card live 2026-10-19; second release 20261019T040157Z-ba82b25b with M2.0–M2.5 and the originality fixes)

**Acceptance criteria:**
- The owner plays a real chase on staging, on desktop and on a touchscreen phone or tablet.
- After the owner approves the release, the game is live and playable at `games.soncrant.com/waka-waka/` from its portal card.
- A run's maze is new each time and the same for the same `?seed=`.
- No maze has a stretch longer than 10 tiles without a turn-off.
- CI is green.

## M2 — Full classic game

- [x] M2.0 Live quick wins from the 2026-10-18 product review: a cleared maze shows MAZE CLEARED and loads a new one, a controls hint under READY!, and the run seed on the game-over screen
- [x] M2.1 All four opponents with their targets; the ghost house and release order (WW-02); the difficulty table from WW-07 with its first row
- [x] M2.2 Scatter and chase scheduler with reversals
- [x] M2.3 Power pellets: scared opponents, eating them for rising points, eyes return to the house
- [x] M2.4 Wrap-around tunnel (opponents slow inside)
- [x] M2.5 Extra life; high score in localStorage, validated (WW-08)
- [x] M2.6 Owner playtest on desktop and on a phone or tablet; the notes become a tuning PR (signed off by the owner 2026-10-20; no tuning changes asked for)
- [x] M2.7 Originality review against Pac-Man names (including the game's own name), characters, mazes and trade dress

**Acceptance criteria:**
- The owner can tell the four opponents apart by how they move.
- A full maze can be cleared and the next one starts.
- The next production release happens after M2.3 at the earliest, so the live game never has four opponents without scatter and working pellets.
- CI is green.

## M3 — Endless and smarter

- [x] M3.1 Fill the difficulty table rows up to the plateau around maze 20 (WW-07): mazes 6–20 ramp in four bands (6, 9, 13, 17) to the plateau at maze 20
- [x] M3.2 Special moves: Frenzy (Murk), Dash (Bolt), Lunge (Gnash), Phase (Wisp), each with a visible tell
- [x] M3.3 Bonus item, twice per maze (not fruit: something that fits Look B, per docs/ORIGINALITY.md): a neon battery on the hero's start spot, worth more on later mazes
- [x] M3.4 Balance pass from the owner's playtest notes (signed off by the owner 2026-10-20 with no changes)

**Acceptance criteria:**
- Later mazes feel harder but fair in the owner's playtest.
- Each special move appears from its maze and can be seen coming.
- CI is green.

## M4 — Mobile and polish

- [x] M4.1 Floating joystick on touchscreens, in the space around the maze (replaces the planned d-pad; WW-06 amendment)
- [x] M4.2 Rotate prompt for phones held landscape, with pause; tablets play either way (WW-05)
- [x] M4.3 Title, help and game-over screens
- [x] M4.4 Pause on P or Esc and when the tab loses focus (a tap or P/Esc carries on)
- [x] M4.5 Animations (chomp, opponent bob, death) and a reduced-flash option
- [x] M4.6 HUD readability on a real phone at zoom 1 (the font is 8 px); adjust the font size or layout if needed (owner checked on their phone 2026-10-20: the HUD reads fine and the zoom stays as it is; no change needed)

**Acceptance criteria:**
- The owner plays a full run on desktop, a phone and a tablet without help.
- CI is green.

## M5 — Sound

- [x] M5.1 Propose CC0 sound effects with sources and licences; the owner approves them (no two-tone "waka" chomp, no rising siren, no copied jingles, per docs/ORIGINALITY.md) (owner chose 12 sounds from a listening page, 2026-10-20)
- [x] M5.2 Add the approved sounds, credit them in `CREDITS.md`, add a mute toggle (WW-09; M, a title button and a HUD speaker; remembered, by the owner's choice)

**Acceptance criteria:**
- Only owner-approved sounds ship, all listed in `CREDITS.md`.
- CI is green.

## M6 — Release

- [x] M6.1 Security report: CodeQL, ESLint, `npm audit`, gitleaks and ZAP results, with 0 critical or high findings ([docs/SECURITY-REPORT.md](docs/SECURITY-REPORT.md); Vite bumped to 8.3.3 for a moderate dev-only advisory)
- [ ] M6.2 Originality re-check of anything changed since M2.7
- [ ] M6.3 Portal card refresh (new image if the look has changed), by PR to `soncsec/games-portal`
- [ ] M6.4 Production release with `scripts/release.sh deploy`, only after the owner approves it

**Acceptance criteria:**
- The owner approves the release.
- The game is live at `games.soncrant.com/waka-waka/` and the smoke test passes.
