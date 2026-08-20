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


# Play Console rejects duplicate achievement icons, so families whose initials
# collide get an explicit monogram ("challenger" would otherwise clash with
# "contestant" on C).
MONOGRAMS = {"challenger": "CH"}


def monogram(local_id):
    words = local_id.split("-")
    if words[-1] in ("bronze", "silver", "gold"):
        words = words[:-1]
    family = "-".join(words)
    if family in MONOGRAMS:
        return MONOGRAMS[family]
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


# Game Stats icons. Same navy field as the badges so the two sets read as one
# family, but a single accent instead of tier colours — stats have no tiers.
STAT_ACCENT = (72, 191, 227)


def stat_monogram(icon_filename):
    """'stat-ladder-best.png' -> 'LB'. Single-word names keep two letters."""
    stem = icon_filename.rsplit(".", 1)[0]
    words = [w for w in stem.split("-") if w != "stat"]
    if len(words) == 1:
        return words[0][:2].upper()
    return "".join(w[0] for w in words[:2]).upper()


def draw_stat_icon(icon_filename, out_path):
    img = Image.new("RGB", (SIZE, SIZE), NAVY)
    d = ImageDraw.Draw(img)

    d.ellipse([24, 24, SIZE - 24, SIZE - 24], outline=STAT_ACCENT, width=26)
    inner = tuple(int(c * 0.28 + n * 0.72) for c, n in zip(STAT_ACCENT, NAVY))
    d.ellipse([72, 72, SIZE - 72, SIZE - 72], fill=inner)

    text = stat_monogram(icon_filename)
    font = load_font(190)
    bbox = d.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1]), text, fill=STAT_ACCENT, font=font)

    img.save(out_path, "PNG")


def stat_icon_names():
    """Every icon filename referenced by the Game Stats CSVs."""
    import csv

    base = os.path.join(os.path.dirname(__file__), "game_stats")
    names = set()
    for name in ("RepetitiveStatsConfig.csv", "ProgressionStatConfig.csv"):
        with open(os.path.join(base, name), newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                names.add(row["Icon File Name"])
    return sorted(names)


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "images")
    os.makedirs(out_dir, exist_ok=True)

    if len(sys.argv) > 1 and sys.argv[1] == "stats":
        icons = stat_icon_names()
        for icon in icons:
            draw_stat_icon(icon, os.path.join(out_dir, icon))
        print(f"wrote {len(icons)} stat icons to {out_dir}")
        return

    for a in achievements():
        path = os.path.join(out_dir, f"{a['id']}.png")
        draw_badge(a["id"], a["tier"], path)
    print(f"wrote {len(achievements())} badges to {out_dir}")


if __name__ == "__main__":
    main()
