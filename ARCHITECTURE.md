# Waka-Waka — Architecture

The shared decisions for every Soncrant Arcade game are recorded once, in
[`soncsec/star-destroyer` ARCHITECTURE.md](https://github.com/soncsec/star-destroyer/blob/main/ARCHITECTURE.md):

| ADR | Decision |
|---|---|
| 002 | Phaser 4 game engine |
| 003 | TypeScript |
| 004 | Vite build, relative base, no runtime CDN |
| 005 | GitHub Pages staging, Apache production |
| 006 | Rules in engine-free `src/logic/` with unit tests; Playwright e2e with a test-only hook; seeded RNG |
| 007 | Security tooling: CodeQL, ESLint, npm audit, gitleaks, ZAP |
| 009 | Releases: `/srv/games-releases/<slug>/<id>/`, atomic symlink switch, rollback |
| 010 | HTTP on port 80 |
| 011 | Parallel games: one repo, folder, port and portal file per game |

Record **this game's own** decisions below as ADRs, after the owner approves them.

## Code structure

```
src/
├── main.ts            Phaser config, whole-number zoom, loads the test hook in the e2e build only
├── config/tuning.ts   every gameplay number
├── config/audio.ts    the sound list and volumes (M5.2, WW-09)
├── logic/             game rules: plain TypeScript, no Phaser imports (ESLint enforces), unit tested
│   ├── maze/          generator, validator, fallback maze
│   ├── movement       grid movement and turn buffering
│   ├── opponents      the cast, chase and scatter targets, ghost house, release order, eyes going home (special moves later)
│   ├── scheduler      scatter and chase phases from the difficulty row; each switch reverses the opponents
│   ├── highscore      parse and format the stored high score (WW-08)
│   ├── specials       special moves: one state machine per opponent, fairness rules (WW-10)
│   ├── difficulty     the difficulty row for a maze number (WW-07)
│   ├── joystick       the joystick's direction and knob position (WW-06)
│   ├── title          the title screen's page cycle and the NEW BEST! rule (M4.3)
│   ├── death          the hero's fizzle when caught (M4.5)
│   ├── reducedFlash   parse, format and resolve the reduced-flash setting (M4.5, WW-08)
│   ├── mute           parse and format the mute setting (M5.2, WW-08)
│   ├── sounds         which sounds a game step calls for (M5.2)
│   └── game           dots, score, lives, phases, the next maze
├── art/               code-drawn pixel art, turned into textures at boot
├── scenes/            Phaser scenes (Title, then Game): thin, call into logic/
│   ├── textures.ts    sprite textures shared by both scenes
│   ├── sound.ts       loads and plays the sounds; mute, saved in localStorage (M5.2, WW-09)
│   ├── highScoreStore.ts  the high score in localStorage (WW-08)
│   └── reducedFlashStore.ts  the reduced-flash setting in localStorage (WW-08)
├── ui/joystick.ts     the floating touch joystick, plain DOM around the canvas (WW-06)
├── ui/rotatePrompt.ts "turn your phone upright" notice for phones held landscape (WW-05)
└── debug/testHook.ts  window.__game for Playwright (e2e build only)
tests/
├── unit/              Vitest, 80% coverage floor on src/logic
├── e2e/               Playwright in Chromium and Firefox, incl. the production CSP
└── release/           release scripts against a fake server
scripts/               release.sh, release-remote.sh, smoke_test.py, zap_check.py, check_repo.py
tools/audio/           build_audio.py: builds public/assets/audio/ from the approved packs (dev machine only)
```

## Game decisions

Approved by the owner on 2026-10-18. Numbered WW-nn so they never clash with the shared ADRs.

### WW-01 Grid movement owned by `src/logic/`

- **Decision:** the hero and opponents live on the tile grid. Each actor has a tile, a direction and progress towards the next tile. The simulation runs on a fixed 60 Hz step inside `src/logic/`; scenes only draw the result. A pressed direction is buffered and taken at the next tile where it is open.
- **Alternatives:** Phaser Arcade physics with wall colliders.
- **Why:** exact cornering and turn buffering, identical results for the same seed, and unit-testable without a browser. Physics bodies snag on corners and drift off the grid.

### WW-02 Opponent AI: target tiles plus a mode scheduler

- **Decision:** at each tile an opponent picks the open direction (no reversing) that brings it closest to its target tile. Each personality has its own target (Murk: the hero; Gnash: 3 tiles ahead; Bolt: twice the vector from Murk to 3 tiles ahead; Wisp: the hero when more than 6 tiles away, else its corner; distances are in `tuning.ts` and were changed from the first values by the 2026-10-19 originality review). A scheduler switches all four between scatter, chase and scared, and reverses them on each switch. Later mazes switch on look-ahead and special moves through the difficulty table. **Amendment (2026-10-20, owner-approved, M7.1):** look-ahead is built: with a depth of N, an opponent judges each way it could turn by where it can be N tiles after that step, never reversing, and takes the way that can end nearest its target; a way that dead-ends sooner counts only if it reaches the target. Depth 0 is the plain one-tile choice above. It applies to chase and scatter targets, not to scared opponents or eyes.
- **Alternatives:** full A* pathfinding every step; behaviour trees.
- **Why:** readable, distinct personalities and cheap to run. A* makes every opponent behave the same and feel unfair; behaviour trees are more code than four personalities need.
- **Amendment (approved by the owner on 2026-10-19):** an eaten opponent, travelling home as a spark, takes a shortest path to the house door (breadth-first search, reversing allowed: `chooseShortest`). With the greedy no-reverse rule, the eyes circled one block for ever in some generated mazes. Chasing, scattering and scared wandering keep the rules above.

### WW-03 Mazes generated at runtime, with checks and a fallback

- **Decision:** a seeded generator on a lattice of 8×9 nodes (pitch 3: one-tile corridors, walls at least two tiles thick) builds a mirror-symmetric maze with a ghost house, a wrap-around tunnel and a start tile. It begins with every segment open and closes random mirrored pairs while every node keeps 0 or at least 2 connections and the maze stays connected. A chain of corner nodes may be at most 3 segments, so no stretch exceeds 8 tiles without a turn-off. A separate validator checks connectivity, no dead ends, the 10-tile rule counted around corners, and reachability of every dot. A maze that fails is regenerated from the next seed; after 20 failures a built-in maze is used. Each run's seed is random; `?seed=` replays it.
- **Alternatives:** a pool of pre-generated mazes shipped as JSON; hand-made mazes only.
- **Why:** the owner chose new mazes every run. In the spike, 2,000 out of 2,000 seeds passed the rule, so the retry and fallback are safety nets. Seeds keep any bad maze reproducible for bug reports.

### WW-04 Pixel art drawn in code

- **Decision:** sprites (hero, the four opponents, scared state, pellets, bonus items) are defined as small pixel maps in `src/art/` and turned into textures when the game boots. Walls are drawn as rounded neon lines from the maze grid. Fonts and UI follow the other Soncrant Arcade games.
- **Alternatives:** PNG sprite sheets from `legacy/` or new art.
- **Why:** the legacy pack has no matching set of four opponents. Code-drawn art needs no new third-party assets, stays crisp at whole-number zoom and is easy to recolour.

### WW-05 Screen and devices

- **Decision:** logical size 384×464 (24×27 tiles of 16 px plus a 16 px HUD above and below), largest whole-number zoom that fits. Phones play in portrait only; tablets play either way. The rule is by size, not device type: when the screen is landscape and the game does not fit at zoom 1, but would fit turned to portrait, a "rotate your phone" prompt shows and the game pauses.
- **Alternatives:** a smaller maze that fits landscape phones; non-integer scaling.
- **Why:** this size fits a 1080p laptop at 2× and a portrait phone at 1× while keeping pixels sharp. Tablets (768 px or more on the short side) fit at 1× or larger either way, so they need no prompt.

### WW-06 Input

- **Decision:** keyboard (arrows, WASD, P or Esc to pause) and touch: a swipe anywhere sets the buffered direction, with an optional on-screen d-pad below the maze. All inputs feed the same buffered-direction command in `src/logic/`.
- **Alternatives:** a virtual joystick.
- **Why:** maze games need four discrete directions; swipes and a d-pad map to them directly.
- **Amendment (2026-10-19, owner-approved):** the d-pad is replaced by a floating joystick (M4.1). A touch on the page outside the canvas (below the maze on a phone, beside it on a landscape tablet) shows a stick under the thumb; moving the thumb past a dead zone picks the direction, the longer axis winning as with swipes. Swipes on the maze still work. Only touch pointers show it, so desktop never does, and there is no setting. It is plain DOM (`src/ui/joystick.ts`, positioned through CSSOM so the strict CSP holds); the direction rule is in `src/logic/joystick.ts`. A touch that resumes a pause or restarts after game over does not steer.

### WW-07 Difficulty table

- **Decision:** `src/config/tuning.ts` holds one row per maze up to the plateau (about maze 20): hero and opponent speeds, scared time (dropping to "reverse only"), scatter and chase timings, house release timing, look-ahead depth and which special moves are on. Beyond the last row, the last row repeats.
- **Alternatives:** formulas in code.
- **Why:** balancing after playtests becomes a data change that is easy to review.
- **Amendment (2026-10-20):** rows now run to maze 20 (M3.1). The look-ahead depth column (M7.1) is 0 up to maze 8, then 3 from maze 9, 4 from maze 13 and 5 from maze 17. In a simulation of a fleeing hero on 60 generated mazes it shortens survival on maze 20 by about a fifth without special moves, and by little with them: most late-maze difficulty comes from speed, scares and the moves. Generated mazes have no dead ends, so depths below 3 change nothing.

### WW-08 Security for this game

- **Decision:** static files only: no server code, network calls, cookies or accounts. Only two inputs are read. `?seed=` must be a decimal integer from 0 to 2³²−1 (at most 10 digits), otherwise it is ignored. The localStorage high score must parse as a non-negative safe integer, otherwise it is reset. Nothing from the URL or storage is ever put into HTML. No new dependencies. All shared gates (CodeQL, ESLint, gitleaks, `npm audit` failing on high or critical, production-CSP e2e test, ZAP baseline) stay on.
- **Alternatives:** none considered; this is the shared baseline applied to this game's inputs.
- **Why:** the owner's top priority is that nothing shipped can be exploited.
- **Amendment (2026-10-19, owner-approved):** a third input, the reduced-flash setting (M4.5), is stored under `waka-waka.reducedFlash`. Only exactly `"1"` or `"0"` is accepted; anything else is removed and the device's "reduce motion" setting applies. Like the high score, it is never put into HTML.
- **Amendment (2026-10-20, owner-approved):** a fourth input, the mute setting (M5.2), is stored under `waka-waka.muted` with the same rule: only exactly `"1"` or `"0"`; anything else is removed and sound is on.

### WW-09 Audio later

- **Decision:** no audio until milestone M5. Then: short CC0 sound effects bundled locally, approved by the owner before they are added, listed in `CREDITS.md`, with a mute toggle (the mute setting is not stored).
- **Alternatives:** synthesised sound in code.
- **Why:** gameplay feedback comes first; sourcing sounds needs the owner's approval.
- **Amendment (2026-10-20, owner-approved):** M5 added 12 sounds the owner chose by ear from a listening page: 10 from Juhani Junkala's "512 Sound Effects (8-bit style)" and 2 from Kenney's "63 Digital Sound Effects", both CC0 on OpenGameArt. `tools/audio/build_audio.py` checks each downloaded pack against its recorded SHA-256, copies only the chosen files, and writes each as Ogg and M4A (for iPhone Safari), mono 22 kHz at the same peak level; `src/config/audio.ts` sets the mix. Each dot plays one short blip (never two alternating tones), and there is no siren or background loop (docs/ORIGINALITY.md). The mute setting **is** stored, by the owner's choice (WW-08 amendment): M mutes anywhere, the title has a SOUND button and the HUD a speaker to tap. The repo check keeps audio files valid and under 1 MB in total (about 0.2 MB now).

### WW-10 Special moves

- **Decision (approved by the owner on 2026-10-19):** each opponent has one special move, designed in [docs/SPECIAL-MOVES.md](docs/SPECIAL-MOVES.md): Frenzy (Murk, from maze 1), Dash (Bolt, maze 2), Lunge (Gnash, maze 3) and Phase (Wisp, maze 5). Each is a small state machine in `src/logic/specials.ts` (ready, tell, active). Fairness rules: a tell of at least 0.5 s always comes first and slows the opponent; only one opponent may be mid-move at a time; no moves while scared, as a spark, in the house, during GET SET! or (to start) in the tunnel; any randomness uses the seeded RNG; tells change shape or colour steadily, not only by flashing. Which moves are on and their numbers are columns of the difficulty table (WW-07).
- **Alternatives:** moves that fire at random with no tell; letting several moves overlap on later mazes.
- **Why:** the moves add variety and difficulty without feeling unfair: a player who watches can always react. Later mazes get harder through shorter cooldowns, not combined moves.
