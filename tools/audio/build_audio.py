#!/usr/bin/env python3
"""Builds public/assets/audio/ from the owner-approved sound packs and updates CREDITS.md.

Run from the repo root:  python3 tools/audio/build_audio.py <folder with the downloaded zips>

The packs are not committed (like legacy/ art). Download each zip from its page below into one
folder, keeping the file name shown here. This script checks every zip against its recorded
SHA-256 before using it, reads only the files named here (never running anything from the
packs), and with ffmpeg (a dev-machine tool; nothing new ships in the game) writes for every
sound:
  - <key>.ogg (Ogg Vorbis), and
  - <key>.m4a (AAC), for iPhone Safari.
Everything is made mono at 22.05 kHz and set to the same peak level (-3 dB), as on the listening
page the owner chose from; the game sets each sound's volume (src/config/audio.ts).
Sounds chosen by the owner on 2026-10-20 (M5.1), the same pipeline as HeliRescue.
"""
import hashlib
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "public" / "assets" / "audio"
CREDITS = ROOT / "CREDITS.md"
START, END = "<!-- audio:start -->", "<!-- audio:end -->"

JUNKALA = "The Essential Retro Video Game Sound Effects Collection [512 sounds].zip"
KENNEY = "Digital_SFX_Set.zip"
J = "The Essential Retro Video Game Sound Effects Collection [512 sounds] By Juhani Junkala/"

# zip name → (page, author, licence, SHA-256 of the zip as downloaded 2026-10-20)
PACKS = {
    JUNKALA: ("https://opengameart.org/content/512-sound-effects-8-bit-style", "Juhani Junkala", "CC0",
              "6d4519229c6e2c9e09502cd4967940052f68664140549a467615b56bdfd1d031"),
    KENNEY: ("https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc",
             "Kenney", "CC0", "022f0f4b73da55989567fe2b373c8af89d74f5d015257e293cab497ca606d063"),
}

# key → (zip, file inside it). Keys match SOUNDS in src/config/audio.ts.
SOUNDS = {
    "sfx-dot": (JUNKALA, J + "General Sounds/Menu Sounds/sfx_menu_move2.wav"),
    "sfx-pellet": (KENNEY, "phaserDown2.mp3"),
    "sfx-eat": (KENNEY, "zap1.mp3"),
    "sfx-battery": (JUNKALA, J + "General Sounds/Coins/sfx_coin_cluster3.wav"),
    "sfx-caught": (JUNKALA, J + "General Sounds/Weird Sounds/sfx_sound_vaporizing.wav"),
    "sfx-life": (JUNKALA, J + "General Sounds/Positive Sounds/sfx_sounds_powerup12.wav"),
    "sfx-clear": (JUNKALA, J + "General Sounds/Fanfares/sfx_sounds_fanfare3.wav"),
    "sfx-ready": (JUNKALA, J + "General Sounds/Weird Sounds/sfx_sound_poweron.wav"),
    "sfx-over": (JUNKALA, J + "General Sounds/Weird Sounds/sfx_sound_shutdown2.wav"),
    "sfx-pause": (JUNKALA, J + "General Sounds/Pause Sounds/sfx_sounds_pause1_in.wav"),
    "sfx-resume": (JUNKALA, J + "General Sounds/Pause Sounds/sfx_sounds_pause1_out.wav"),
    "sfx-start": (JUNKALA, J + "General Sounds/Menu Sounds/sfx_menu_select1.wav"),
}

RATE = "22050"
PEAK_DB = -3.0
VORBIS_QUALITY = "3"
AAC_BITRATE = "48k"


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def peak_db(src: pathlib.Path) -> float:
    """The loudest sample, in dB below full scale."""
    run = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(src), "-af", "volumedetect", "-f", "null", "-"],
                         check=True, capture_output=True, text=True)
    match = re.search(r"max_volume: (-?[\d.]+) dB", run.stderr)
    if not match:
        raise RuntimeError(f"could not measure {src.name}")
    return float(match.group(1))


def encode(src: pathlib.Path, dst: pathlib.Path, gain_db: float) -> None:
    codec = ["-c:a", "libvorbis", "-q:a", VORBIS_QUALITY] if dst.suffix == ".ogg" else ["-c:a", "aac", "-b:a", AAC_BITRATE]
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-map_metadata", "-1", "-ac", "1",
           "-ar", RATE, "-af", f"volume={gain_db:.1f}dB", *codec, str(dst)]
    subprocess.run(cmd, check=True)


def credits_table() -> str:
    rows = ["| File | Source | Changes |", "|---|---|---|"]
    for key, (zip_name, inner) in SOUNDS.items():
        page, author, licence, _ = PACKS[zip_name]
        name = pathlib.PurePosixPath(inner).name
        for ext, what in (("ogg", "Ogg Vorbis"), ("m4a", "AAC (M4A) copy for iPhone Safari")):
            rows.append(f"| `assets/audio/{key}.{ext}` | [{zip_name}]({page}) `{name}` by {author}, {licence} "
                        f"| mono 22 kHz, peak -3 dB, {what} |")
    return "\n".join(rows)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    if shutil.which("ffmpeg") is None:
        print("ffmpeg is needed (dev machine only)")
        return 2
    packs = pathlib.Path(sys.argv[1])
    for zip_name, (_, _, _, digest) in PACKS.items():
        got = sha256(packs / zip_name)
        if got != digest:
            print(f"{zip_name}: SHA-256 {got} does not match the recorded {digest}; not using it")
            return 1
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for key, (zip_name, inner) in SOUNDS.items():
            with zipfile.ZipFile(packs / zip_name) as z:
                data = z.read(inner)  # only this named file; nothing in the pack is run
            src = pathlib.Path(tmp) / (key + pathlib.PurePosixPath(inner).suffix)
            src.write_bytes(data)
            gain = PEAK_DB - peak_db(src)
            for ext in ("ogg", "m4a"):
                encode(src, OUT / f"{key}.{ext}", gain)
    text = CREDITS.read_text()
    table = f"{START}\n{credits_table()}\n{END}"
    if START in text:
        before, rest = text.split(START, 1)
        after = rest.split(END, 1)[1]
        text = before + table + after
    else:
        text = text.rstrip("\n") + (
            "\n\n## Audio\n\nSound effects from two CC0 packs, chosen by the owner on 2026-10-20 (M5.1). "
            "Built by `tools/audio/build_audio.py`, which checks each downloaded pack against the SHA-256 "
            "recorded in it; only the files below are copied.\n\n" + table + "\n")
    CREDITS.write_text(text)
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"wrote {len(SOUNDS) * 2} files, {total / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
