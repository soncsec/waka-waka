# Waka-Waka — Special moves (M3.2 design, proposed)

> **Status:** Proposal for the owner's approval, 2026-10-19. Nothing is built yet. Numbers are starting values for the difficulty table (WW-07) and will be tuned in M3.4.

PROJECT.md gives each opponent a special move with a visible tell: **Frenzy** (Murk, from maze 1), **Dash** (Bolt, from maze 2), **Lunge** (Gnash, from maze 3) and **Phase** (Wisp, from maze 5). The goal is that every move is **readable and escapable**: a player who watches the tell can always react.

## Fairness rules (all moves)

1. **Tell first, always.** Every move starts with a tell of at least 0.5 s; during the tell the opponent stops or slows, so the player gains ground.
2. **One at a time.** Only one opponent can be doing a special move at once, across the whole cast.
3. **Never while scared, as a spark, in the house, in the tunnel, or during GET SET!**
4. **Cooldowns.** After a move, that opponent waits before it can use it again.
5. **Seeded.** Any randomness (who goes first when two are ready) uses the seeded RNG, so `?seed=` replays it.
6. **Reduced motion.** Tells never rely on fast flashing alone: each also changes shape or colour steadily, so the reduced-flash option (M4.5) keeps them readable.

## The four moves

| Move | Who / from | Trigger | Tell | Effect | Starting numbers |
|---|---|---|---|---|---|
| **Frenzy** | Murk, maze 1 | Every 20 s of chase, if Murk is out and not scared | Spikes spin fast and turn white-hot; Murk slows to half speed for 1 s | Murk chases at +30% speed for 3 s | every 20 s; tell 1 s; burst 3 s at ×1.3 |
| **Dash** | Bolt, maze 2 | The hero is in the same straight corridor, within 8 tiles, with no wall between | Bolt stops for 0.6 s and stretches into a long diamond pointing at the hero, with a dotted line along the corridor | Bolt shoots straight down the corridor at ×2.2 speed until it reaches a junction or wall, then carries on normally | range 8; tell 0.6 s; ×2.2; cooldown 10 s |
| **Lunge** | Gnash, maze 3 | The hero is 2–3 tiles ahead of Gnash, in the direction it is moving | Gnash stops for 0.5 s with its teeth bared (mouth opens, teeth flash) | Gnash jumps forward 2 tiles at ×3 speed; if it misses, it pauses 0.5 s ("shaking its head") | range 2–3; tell 0.5 s; jump 2 tiles; cooldown 8 s |
| **Phase** | Wisp, maze 5 | The hero is on the far side of a thin wall: a straight run of 2 wall tiles between Wisp's corridor and the hero's, within 4 tiles | Wisp turns see-through and shimmers for 1 s; a faint outline appears on the far side where it will come out | Wisp drifts through the wall in 0.8 s at half speed and comes out on the far side | wall ≤ 2 tiles; range 4; tell 1 s; cross 0.8 s; cooldown 12 s |

Phase never goes into or out of the ghost house, never through the outer border, and never into the tunnel. The maze generator makes walls at least 2 tiles thick (WW-03), so "thin wall" means exactly 2 tiles.

## Difficulty table (WW-07)

New columns per maze row: which moves are on, and each move's numbers (cooldown, speed factor, range). The table switches them on as PROJECT.md says (Frenzy 1, Dash 2, Lunge 3, Phase 5), and later rows can shorten cooldowns and tells down to the fairness floor (tell ≥ 0.5 s).

## Build plan (after approval)

1. Logic in `src/logic/specials.ts` (no Phaser), one small state machine per opponent: `ready → tell → active → cooldown`, with unit tests for every trigger, tell length, effect, cooldown and the fairness rules.
2. Art for each tell in `src/art/sprites.ts`, with a contact sheet for approval.
3. E2E hook control to trigger a move, and an e2e test per move.
4. One PR per move, in maze order: Frenzy, Dash, Lunge, Phase.

## Decisions needed

1. Approve the four moves as described, or change any of them.
2. Approve the "one at a time" rule (stricter, fairer) or allow overlaps on later mazes.
3. Record the design as a new decision **WW-10 Special moves** in ARCHITECTURE.md once approved?
