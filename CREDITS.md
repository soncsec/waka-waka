# Credits

## Art

From the **Ansimuz Legacy Collection** (CC0 1.0, public domain): https://ansimuz.itch.io/

List every file copied into `public/assets/` here, one per line, as its path from `public/` in backticks, for example assets/ships/player.png. The repo check fails on unlisted or missing files.

_No assets yet._

## Fonts

- **Press Start 2P** by CodeMan38 (Copyright 2012 The Press Start 2P Project Authors), SIL Open Font License 1.1, used for the HUD. Source: `google/fonts` repo, `ofl/pressstart2p/`, commit `e06fe11c39051bddaef73ec338a9d1c8175723f1`; file SHA-256 `034c77f1f05ec89421e4a63f0e3a4ca1ecf852cc6d2bf611f126f275728e017d` (the same file as the games portal and Star Destroyer). License text: `src/assets/fonts/PressStart2P-OFL.txt`.

## Game art

The hero, opponents, walls, dots and pellets are drawn in code (`src/art/`, WW-04); no image files.

## Audio

Sound effects from two CC0 packs, chosen by the owner on 2026-10-20 (M5.1). Built by `tools/audio/build_audio.py`, which checks each downloaded pack against the SHA-256 recorded in it; only the files below are copied.

<!-- audio:start -->
| File | Source | Changes |
|---|---|---|
| `assets/audio/sfx-dot.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_menu_move2.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-dot.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_menu_move2.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-pellet.ogg` | [Digital_SFX_Set.zip](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) `phaserDown2.mp3` by Kenney, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-pellet.m4a` | [Digital_SFX_Set.zip](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) `phaserDown2.mp3` by Kenney, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-eat.ogg` | [Digital_SFX_Set.zip](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) `zap1.mp3` by Kenney, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-eat.m4a` | [Digital_SFX_Set.zip](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) `zap1.mp3` by Kenney, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-battery.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_coin_cluster3.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-battery.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_coin_cluster3.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-caught.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sound_vaporizing.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-caught.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sound_vaporizing.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-life.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_powerup12.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-life.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_powerup12.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-clear.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_fanfare3.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-clear.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_fanfare3.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-ready.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sound_poweron.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-ready.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sound_poweron.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-over.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sound_shutdown2.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-over.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sound_shutdown2.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-pause.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_pause1_in.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-pause.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_pause1_in.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-resume.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_pause1_out.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-resume.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_sounds_pause1_out.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
| `assets/audio/sfx-start.ogg` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_menu_select1.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, Ogg Vorbis |
| `assets/audio/sfx-start.m4a` | [The Essential Retro Video Game Sound Effects Collection [512 sounds].zip](https://opengameart.org/content/512-sound-effects-8-bit-style) `sfx_menu_select1.wav` by Juhani Junkala, CC0 | mono 22 kHz, peak -3 dB, AAC (M4A) copy for iPhone Safari |
<!-- audio:end -->
