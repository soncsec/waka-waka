# Waka-Waka — Originality review (M2.7)

> **Status:** Reviewed by the owner on 2026-10-19. This is a product review, not legal advice. Decisions and what has been done are listed under **Owner decisions** below.

PROJECT.md requires original names, shapes, colours and mazes, and nothing that copies Pac-Man's names, characters, maze layouts or trade dress. Game rules themselves are generally not protected, but courts have weighed a clone's overall look and feel: character shapes and colours, maze layouts and sound effects (for example *Atari v. North American Philips*, 1982, and the *Mighty Mouth* case, 1983 — see Sources). So the risk comes from **many small matches adding up**, not from any single one.

## Findings

| # | Element | Pac-Man | Waka-Waka today | Risk | Proposal |
|---|---|---|---|---|---|
| 1 | Game name | — | "Waka-Waka", widely known as the sound of Pac-Man eating | **Medium** | Owner decision: keep, or rename (see below). No live US "WAKA WAKA" mark for video games turned up in a first search, but the name points straight at Pac-Man. |
| 2 | On-screen text | Yellow "READY!" under the ghost house; red "GAME OVER" in the same place | Same words, same colours, same place | **Medium** | Change both, e.g. "GET SET" / "RUN OVER", or a different position or colour. |
| 3 | Scared opponents | Turn dark blue, flash white near the end, become eyes that return to the house | Turn blue, flash white, become eyes that return to the house | **Medium** | Keep the mechanic; change the look: e.g. opponents dim to a grey outline and "short-circuit" with sparks, flash pink, and return as a small spark rather than eyes. |
| 4 | Points for eating opponents | 200, 400, 800, 1600 | 200, 400, 800, 1600 | Low–medium | Change the sequence, e.g. 100, 300, 700, 1500, or a multiplier. |
| 5 | Opponent targeting | Blinky: Pac-Man's tile; Pinky: 4 ahead; Inky: Blinky vector doubled from 2 ahead; Clyde: chases beyond 8 tiles, else corner | Identical rules (WW-02) | Low (rules) but adds to look and feel | Tweak numbers so behaviour is ours: e.g. Gnash 3 ahead, Wisp shy distance 6, Bolt pivot 3 ahead. M3.2 special moves will make them more distinct. |
| 6 | Scatter/chase timing | 7/20/7/20/5/20/5/∞ s on level 1 | Identical | Low | Change to our own pattern, e.g. 6/22/6/22/4/25/4/∞. Easy, data only (WW-07). |
| 7 | Extra life | At 10,000 points | At 10,000 | Low | Change to, e.g., 8,000 or 12,000. |
| 8 | Hero | Yellow circle, wedge mouth | Teal circle with teeth and shading | Low–medium | Keep; the teal colour and teeth differ. Optional: give it a distinct feature (eye, antenna or tail) so it reads as its own character. |
| 9 | Opponents' look | Four ghost silhouettes (dome, wavy skirt) in red, pink, cyan, orange | Spiky ball, toothy box, diamond, jelly; red-pink, orange, yellow, violet | Low | Keep. Watch Wisp: a jelly with a rippling skirt is the closest to a ghost silhouette; consider tentacles or a different hem. |
| 10 | Opponent names | Blinky, Pinky, Inky, Clyde | Murk, Gnash, Bolt, Wisp | None | Keep. |
| 11 | Mazes | One fixed 28×31 layout, blue double-line walls | Generated every run, 24×27, neon pink walls; fallback maze is our own | Low | Keep. The shared genre parts (central house with door, side tunnel, four corner pellets) are common to the genre. |
| 12 | Sound (M5) | "Waka" chomp, siren, death jingle | None yet | — | Rule for M5: no chomp sound that alternates two tones like "waka", no rising siren, no copied jingle. |
| 13 | Bonus item (M3.3) | Fruit (cherry, strawberry, …) with rising values | Not built | — | Rule for M3.3: not fruit; e.g. neon gems or batteries that fit Look B. |

## The name (finding 1)

- **Keep "Waka-Waka":** it's catchy and already live on the portal. The risk is association: players and Bandai Namco will read it as a nod to Pac-Man, and every other match in this table gets weighed with that in mind.
- **Rename:** options in the same playful, onomatopoeic spirit, checked for obvious clashes before choosing: *Chomp Circuit*, *Neon Muncher*, *Gobble Grid*, *Maze Muncher*. A rename touches the repo slug, portal card and URL, so it is cheapest now.

## Owner decisions (2026-10-19)

| Finding | Decision | Done |
|---|---|---|
| 1 Name | Keep "Waka-Waka" | — |
| 2 On-screen text | Change | "GET SET!" in neon pink; "RUN ENDED" in amber |
| 4 Points | Change | 100, 300, 700, 1500 |
| 5 Targeting | Change the numbers | Gnash 3 ahead (was 4); Bolt pivots 3 ahead (was 2); Wisp shy within 6 (was 8) |
| 6 Scatter/chase timing | Change | 6/22/6/22/4/25/4/∞ s |
| 7 Extra life | Change | 12,000 |
| 3 Scared look | Redesign, screenshots for approval | Short-circuited look (dark body, pale edge, spark line; pink when flashing); eaten opponents travel home as a spark |
| 12, 13 Sound and bonus item | Rules for M5 and M3.3 | Added to the roadmap |
| — Next production release | Only after these fixes | — |

## Recommended order

1. Decide the name.
2. One PR for findings 2, 4, 6 and 7 (text and numbers only; small).
3. One PR for finding 3 (scared look) with screenshots for approval, since it is art (WW-04).
4. Finding 5 as part of the M2.6 playtest tuning, so the numbers are tuned and original at the same time.
5. Add the rules in findings 12 and 13 to the M5 and M3.3 task text.

## Sources

- [Pac-Man Owners Caught in Retro Game IP Maze (Patent Arcade)](https://www.patentarcade.com/?p=5251): Bandai Namco's 2019 copyright and trademark suit over licensed Pac-Man versions.
- [List of Pac-Man clones (Wikipedia)](https://wikipedia.com/wiki/Hangly-Man): history of clones and the early court cases (*Atari v. North American Philips*, *Midway v. Bandai-America*, *Mighty Mouth*).
- [Pac-Man Wiki: clones and bootlegs](https://pacman.fandom.com/wiki/History_of_Pac-Man_clones_and_bootlegs/Gameplay_clones)
- [Trademarkia search for "waka waka"](https://www.trademarkia.com/search/trademarks?q=waka%20waka): first page of 293 results showed no live class 9 or 28 video-game mark; not a full clearance search.
- [CIPO: PAC-MAN word mark 1014978](https://ised-isde.canada.ca/cipo/trademark-search/1014978)
