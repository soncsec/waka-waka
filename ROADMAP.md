# Waka-Waka — Roadmap

> **Status:** Approved by the owner on 2026-10-18. Every milestone ends with something playable on staging (https://soncsec.github.io/waka-waka/). One task per branch and PR.

| Milestone | Status |
|---|---|
| M0 Setup | In progress |
| M1 First playable | Not started |
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
- [ ] M0.5 PROJECT.md, ARCHITECTURE.md and ROADMAP.md approved by the owner

## M1 — First playable

- [ ] M1.1 Maze generator and validator in `src/logic/maze/` (WW-03), with tests over 1,000+ seeds and the fallback maze
- [ ] M1.2 Draw the maze, dots and pellets in look B, at 384×464 with whole-number zoom (WW-04, WW-05)
- [ ] M1.3 Hero grid movement with turn buffering, eating dots, score in the HUD (WW-01)
- [ ] M1.4 Murk chases the hero; lives, death, game over and restart
- [ ] M1.5 Playwright: boots clean, hero moves and eats dots, Murk catches the hero, through the test hook

**Acceptance criteria:**
- The owner plays a real chase on staging.
- A run's maze is new each time and the same for the same `?seed=`.
- No maze has a stretch longer than 10 tiles without a turn-off.
- CI is green.

## M2 — Full classic game

- [ ] M2.1 All four opponents with their targets; the ghost house and release order (WW-02)
- [ ] M2.2 Scatter and chase scheduler with reversals
- [ ] M2.3 Power pellets: scared opponents, eating them for rising points, eyes return to the house
- [ ] M2.4 Wrap-around tunnel (opponents slow inside)
- [ ] M2.5 Clearing a maze loads a new one; extra life; high score in localStorage, validated (WW-08)
- [ ] M2.6 Basic swipe controls (WW-06)

**Acceptance criteria:**
- The owner can tell the four opponents apart by how they move.
- A full maze can be cleared and the next one starts.
- The game plays on a phone in portrait with swipes.
- CI is green.

## M3 — Endless and smarter

- [ ] M3.1 Difficulty table in `tuning.ts`, levelling off around maze 20 (WW-07)
- [ ] M3.2 Special moves: Frenzy (Murk), Dash (Bolt), Lunge (Gnash), Phase (Wisp), each with a visible tell
- [ ] M3.3 Bonus item, twice per maze
- [ ] M3.4 Balance pass from the owner's playtest notes

**Acceptance criteria:**
- Later mazes feel harder but fair in the owner's playtest.
- Each special move appears from its maze and can be seen coming.
- CI is green.

## M4 — Mobile and polish

- [ ] M4.1 Optional on-screen d-pad
- [ ] M4.2 Portrait-only prompt for landscape phones, with pause
- [ ] M4.3 Title, help and game-over screens (game over shows the run seed)
- [ ] M4.4 Pause on P or Esc and when the tab loses focus
- [ ] M4.5 Animations (chomp, opponent bob, death) and a reduced-flash option

**Acceptance criteria:**
- The owner plays a full run on desktop and on a phone without help.
- CI is green.

## M5 — Sound

- [ ] M5.1 Propose CC0 sound effects with sources and licences; the owner approves them
- [ ] M5.2 Add the approved sounds, credit them in `CREDITS.md`, add a mute toggle (WW-09)

**Acceptance criteria:**
- Only owner-approved sounds ship, all listed in `CREDITS.md`.
- CI is green.

## M6 — Release

- [ ] M6.1 Security report: CodeQL, ESLint, `npm audit`, gitleaks and ZAP results, with 0 critical or high findings
- [ ] M6.2 Originality review against Pac-Man names, characters, mazes and trade dress
- [ ] M6.3 Portal card image and status change, by PR to `soncsec/games-portal`
- [ ] M6.4 Production release with `scripts/release.sh deploy`, only after the owner approves it

**Acceptance criteria:**
- The owner approves the release.
- The game is live at `games.soncrant.com/waka-waka/` and the smoke test passes.
