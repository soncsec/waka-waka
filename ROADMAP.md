# Waka-Waka — Roadmap

> **Status:** Approved by the owner on 2026-10-18. Every milestone ends with something playable on staging (https://soncsec.github.io/waka-waka/). One task per branch and PR.

| Milestone | Status |
|---|---|
| M0 Setup | Done |
| M1 First playable | In progress |
| M2 Full classic game | Not started |
| M3 Endless and smarter | Not started |
| M4 Mobile and polish | Not started |
| M5 Sound | Not started |
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
- [ ] M1.6 First production release (owner approval): security report (CodeQL, ESLint, `npm audit`, gitleaks, ZAP), a 256×192 card image and `"status": "live"` by PR to `soncsec/games-portal` (the summary stays as it is), `scripts/release.sh deploy`, then the portal release and its production check

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
- [ ] M2.6 Owner playtest on desktop and on a phone or tablet; the notes become a tuning PR
- [x] M2.7 Originality review against Pac-Man names (including the game's own name), characters, mazes and trade dress

**Acceptance criteria:**
- The owner can tell the four opponents apart by how they move.
- A full maze can be cleared and the next one starts.
- The next production release happens after M2.3 at the earliest, so the live game never has four opponents without scatter and working pellets.
- CI is green.

## M3 — Endless and smarter

- [ ] M3.1 Fill the difficulty table rows up to the plateau around maze 20 (WW-07)
- [ ] M3.2 Special moves: Frenzy (Murk), Dash (Bolt), Lunge (Gnash), Phase (Wisp), each with a visible tell
- [ ] M3.3 Bonus item, twice per maze (not fruit: something that fits Look B, per docs/ORIGINALITY.md)
- [ ] M3.4 Balance pass from the owner's playtest notes

**Acceptance criteria:**
- Later mazes feel harder but fair in the owner's playtest.
- Each special move appears from its maze and can be seen coming.
- CI is green.

## M4 — Mobile and polish

- [ ] M4.1 Optional on-screen d-pad
- [ ] M4.2 Rotate prompt for phones held landscape, with pause; tablets play either way (WW-05)
- [ ] M4.3 Title, help and game-over screens
- [ ] M4.4 Pause on P or Esc and when the tab loses focus
- [ ] M4.5 Animations (chomp, opponent bob, death) and a reduced-flash option
- [ ] M4.6 HUD readability on a real phone at zoom 1 (the font is 8 px); adjust the font size or layout if needed

**Acceptance criteria:**
- The owner plays a full run on desktop, a phone and a tablet without help.
- CI is green.

## M5 — Sound

- [ ] M5.1 Propose CC0 sound effects with sources and licences; the owner approves them (no two-tone "waka" chomp, no rising siren, no copied jingles, per docs/ORIGINALITY.md)
- [ ] M5.2 Add the approved sounds, credit them in `CREDITS.md`, add a mute toggle (WW-09)

**Acceptance criteria:**
- Only owner-approved sounds ship, all listed in `CREDITS.md`.
- CI is green.

## M6 — Release

- [ ] M6.1 Security report: CodeQL, ESLint, `npm audit`, gitleaks and ZAP results, with 0 critical or high findings
- [ ] M6.2 Originality re-check of anything changed since M2.7
- [ ] M6.3 Portal card refresh (new image if the look has changed), by PR to `soncsec/games-portal`
- [ ] M6.4 Production release with `scripts/release.sh deploy`, only after the owner approves it

**Acceptance criteria:**
- The owner approves the release.
- The game is live at `games.soncrant.com/waka-waka/` and the smoke test passes.
