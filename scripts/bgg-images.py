#!/usr/bin/env python3
"""Laddar ner omslagsbilder från BGG till images/ och sätter ryggfärg.

Körs efter bgg-sync.mjs, som fyller i "imageUrl" i games.json.
För varje spel med bgg-id och imageUrl:
  - laddar ner bilden (en gång), skalar till max 480 px och sparar images/<bgg-id>.jpg
  - sätter "image" till den lokala sökvägen
  - räknar fram en dominant färg från omslaget och sparar den som "color" (används på hyllryggen)

Kräver Pillow:  python3 -m pip install pillow
"""
import io
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "games.json"
OUT = ROOT / "images"
MAX = 480


def dominant(img: Image.Image) -> str:
    """Vanligaste färgen bland 8 kvantiserade, men hoppa över nästan vitt/svart."""
    small = img.convert("RGB").resize((64, 64))
    pal = small.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    colors = pal.getpalette()[: 8 * 3]
    counts = sorted(pal.getcolors(), reverse=True)
    for _, idx in counts:
        r, g, b = colors[idx * 3: idx * 3 + 3]
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        if 30 < lum < 225:
            return f"#{r:02x}{g:02x}{b:02x}"
    r, g, b = colors[counts[0][1] * 3: counts[0][1] * 3 + 3]
    return f"#{r:02x}{g:02x}{b:02x}"


def main() -> None:
    raw = json.loads(FILE.read_text(encoding="utf-8"))
    games = raw if isinstance(raw, list) else raw["games"]
    OUT.mkdir(exist_ok=True)
    done = 0
    for g in games:
        gid, url = g.get("bgg"), g.get("imageUrl")
        if not gid or not url:
            continue
        path = OUT / f"{gid}.jpg"
        if not path.exists():
            req = urllib.request.Request(url, headers={"User-Agent": "Spelhyllan/1.0 (github.com/BoostSebastian/board-games)"})
            try:
                with urllib.request.urlopen(req, timeout=30) as res:
                    img = Image.open(io.BytesIO(res.read()))
            except Exception as e:  # noqa: BLE001 – en trasig bild ska inte stoppa resten
                print(f"!! {g['name']}: {e}")
                continue
            img = img.convert("RGB")
            img.thumbnail((MAX, MAX))
            img.save(path, "JPEG", quality=82, optimize=True, progressive=True)
            done += 1
            time.sleep(0.5)
        g["image"] = f"images/{gid}.jpg"
        if not g.get("color"):
            g["color"] = dominant(Image.open(path))
    FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Klart: {done} nya bilder.")


if __name__ == "__main__":
    main()
