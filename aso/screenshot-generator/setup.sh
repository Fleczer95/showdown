#!/bin/bash
# Sets up the screenshot-generator workspace by copying source raws into
# public/ (Next.js can only serve assets from public/).
# Run this once after cloning, or any time the raws change.
#
# Polish Play Store raws use Polish filenames; this script renames them to
# the English slide IDs the routes look up.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAW="$DIR/../screenshots/raw"
ASSETS="$DIR/../assets"
PUB="$DIR/public"

# Mockup (ships with the skill)
SKILL_MOCKUP="$HOME/.claude/skills/app-store-screenshots/mockup.png"
if [ -f "$SKILL_MOCKUP" ] && [ ! -f "$PUB/mockup.png" ]; then
  cp "$SKILL_MOCKUP" "$PUB/mockup.png"
fi

cp "$ASSETS/play-store-icon.png" "$PUB/app-icon.png"

mkdir -p "$PUB/screenshots/en" "$PUB/screenshots/pl"
cp "$RAW/app-store/en/"*.png "$PUB/screenshots/en/"
cp "$RAW/app-store/pl/"*.png "$PUB/screenshots/pl/"

mkdir -p "$PUB/screenshots-ipad/en" "$PUB/screenshots-ipad/pl"
cp "$RAW/app-store/ipad/en/"*.png "$PUB/screenshots-ipad/en/"
cp "$RAW/app-store/ipad/pl/"*.png "$PUB/screenshots-ipad/pl/"

mkdir -p "$PUB/screenshots-play/en" "$PUB/screenshots-play/pl"
cp "$RAW/play-store/phone/en/"*.png "$PUB/screenshots-play/en/"

# Polish Play Store phone raws → rename to EN slide IDs
PL_PHONE="$RAW/play-store/phone/pl"
cp "$PL_PHONE/01_home_screen.png"          "$PUB/screenshots-play/pl/01_home_screen.png"
cp "$PL_PHONE/02_zakazane_slowa.png"       "$PUB/screenshots-play/pl/02_forbidden_words.png"
cp "$PL_PHONE/03_zakazane_slowa_game.png"  "$PUB/screenshots-play/pl/03_forbidden_words_game.png"
cp "$PL_PHONE/04_czolko_game.png"          "$PUB/screenshots-play/pl/04_who_am_i_game.png"
cp "$PL_PHONE/05_5_sekund_game.png"        "$PUB/screenshots-play/pl/05_5_seconds_game.png"
cp "$PL_PHONE/06_ustawienia.png"           "$PUB/screenshots-play/pl/06_settings.png"

mkdir -p "$PUB/screenshots-play-tablet/en" "$PUB/screenshots-play-tablet/pl"
cp "$RAW/play-store/tablet10/en/"*.png "$PUB/screenshots-play-tablet/en/"

PL_TAB="$RAW/play-store/tablet10/pl"
cp "$PL_TAB/01_home_screen.png"          "$PUB/screenshots-play-tablet/pl/01_home_screen.png"
cp "$PL_TAB/02_zakazane_slowa.png"       "$PUB/screenshots-play-tablet/pl/02_forbidden_words.png"
cp "$PL_TAB/03_zakazane_slowa_game.png"  "$PUB/screenshots-play-tablet/pl/03_forbidden_words_game.png"
cp "$PL_TAB/04_czolko_game.png"          "$PUB/screenshots-play-tablet/pl/04_who_am_i_game.png"
cp "$PL_TAB/05_5_sekund_game.png"        "$PUB/screenshots-play-tablet/pl/05_5_seconds_game.png"
cp "$PL_TAB/06_ustawienia.png"           "$PUB/screenshots-play-tablet/pl/06_settings.png"

echo "Setup complete. Run \`yarn install && yarn dev\` to start the generator."
