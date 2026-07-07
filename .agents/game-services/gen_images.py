"""Generate 512x512 achievement badge PNGs for Game Center.

Simple brand-consistent placeholders: navy field, tier-colored ring, family
monogram. Output: .agents/game-services/images/<local-id>.png
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from definitions import achievements  # noqa: E402

SIZE = 512
NAVY = (26, 26, 46)  # app splash #1A1A2E
TIER_COLORS = {
    "bronze": (205, 127, 50),
    "silver": (192, 192, 192),
    "gold": (255, 200, 40),
    None: (108, 92, 231),  # one-off accent
}
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Verdana Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def monogram(local_id):
    words = local_id.split("-")
    if words[-1] in ("bronze", "silver", "gold"):
        words = words[:-1]
    return "".join(w[0] for w in words[:2]).upper()


def load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_badge(local_id, tier, out_path):
    img = Image.new("RGB", (SIZE, SIZE), NAVY)
    d = ImageDraw.Draw(img)
    color = TIER_COLORS[tier]

    # Outer ring + subtle inner disc.
    ring_w = 26
    d.ellipse([24, 24, SIZE - 24, SIZE - 24], outline=color, width=ring_w)
    inner = tuple(int(c * 0.28 + n * 0.72) for c, n in zip(color, NAVY))
    d.ellipse([72, 72, SIZE - 72, SIZE - 72], fill=inner)

    text = monogram(local_id)
    font = load_font(190 if len(text) < 3 else 150)
    bbox = d.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1]), text, fill=color, font=font)

    img.save(out_path, "PNG")


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "images")
    os.makedirs(out_dir, exist_ok=True)
    for a in achievements():
        path = os.path.join(out_dir, f"{a['id']}.png")
        draw_badge(a["id"], a["tier"], path)
    print(f"wrote {len(achievements())} badges to {out_dir}")


if __name__ == "__main__":
    main()
