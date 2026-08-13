"""Bundle the Game Stats configuration into the ZIP Play Console expects.

Google takes one archive holding the three CSVs and every icon they reference.
The CSVs name icons without a path, so everything is written flat at the root.

Fails loudly on a missing icon: a silently incomplete archive would be rejected
by the console with a much less obvious message.

Usage: /usr/bin/python3 .agents/game-services/pack_game_stats.py
Output: .agents/game-services/game_stats.zip
"""

import csv
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(HERE, "game_stats")
IMAGE_DIR = os.path.join(HERE, "images")
OUT = os.path.join(HERE, "game_stats.zip")

CSVS = ("repetitive_stats.csv", "progression_stat.csv", "localizations.csv")
ICON_SOURCES = ("repetitive_stats.csv", "progression_stat.csv")


def icon_names():
    names = set()
    for name in ICON_SOURCES:
        with open(os.path.join(CONFIG_DIR, name), newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                names.add(row["icon_filename"])
    return sorted(names)


def main():
    icons = icon_names()
    missing = [i for i in icons if not os.path.exists(os.path.join(IMAGE_DIR, i))]
    if missing:
        print("missing icons — run gen_images.py stats first:", ", ".join(missing))
        return 1

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for name in CSVS:
            z.write(os.path.join(CONFIG_DIR, name), name)
        for icon in icons:
            z.write(os.path.join(IMAGE_DIR, icon), icon)

    print(f"wrote {OUT}")
    print(f"  {len(CSVS)} csv + {len(icons)} icons")
    return 0


if __name__ == "__main__":
    sys.exit(main())
