---
name: game-services
description: 'Game Center + Google Play Games Services provisioning for ShowDown. Covers the definitions module (31 achievements + 3 leaderboards mirrored from src/game/progression), the ASC Game Center script, the Play Games Configuration API script, badge image generation, and the ids captured into app code. Use when: adding/renaming achievements or leaderboards, re-running store provisioning, Game Center, Play Games, gamesConfiguration API.'
source: showdown (custom)
---

# Game Services provisioning — ShowDown

Store-side mirror of the in-app progression achievements (see
`src/game/progression/achievements.ts`) plus three best-score leaderboards.

## Files

| File                    | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `definitions.py`        | Single source of truth: 31 achievements + 3 leaderboards, EN/PL, points    |
| `gen_images.py`         | Renders 512×512 badge PNGs into `images/` (used by Game Center)           |
| `create_game_center.py` | ASC API: gameCenterDetail, achievements, localizations, images, leaderboards |
| `create_play_games.py`  | Games Configuration API: achievements + leaderboards, writes generated ids |

Both provisioning scripts are idempotent (list-first, skip existing) — safe to re-run.

## Runtime ids used by the app

- Apple: deterministic vendor ids `com.showdown.app.ach.<id_underscored>` /
  `com.showdown.app.lb.<game_id_underscored>` (derived in `src/services/gameServices/ids.ts`).
- Google: opaque generated ids captured into `src/services/gameServices/playIds.generated.ts`
  and the Games project id into `modules/game-services/android/src/main/res/values/games-ids.xml`.

## Environment

```bash
/usr/bin/python3 -m venv .venv-agents   # system python — the Homebrew pythons have a broken pyexpat
.venv-agents/bin/python -m pip install PyJWT cryptography requests google-api-python-client google-auth Pillow
```

## Key facts / pitfalls

| Fact | Detail |
| --- | --- |
| ASC credentials | Same as `app-store-connect-api` skill (key `TYBAQ9XDGV`, app `6774886649`) |
| GC achievement images | PATCH commit accepts only `{"uploaded": true}` — `sourceFileChecksum` → 409 ATTRIBUTE.UNKNOWN |
| GC locales | `en-US` and `pl` |
| Games project id | `381435458877` (= showdown-tv-quiz project number; created 2026-07-03 in Play Console) |
| Games Publishing API | Must be enabled in the **service account's** project (`breathing-in-labour`); enable propagation can take ~10 min |
| Play Games locales | `en-US` and `pl-PL`; Polish had to be added first under game Właściwości → Zarządzaj tłumaczeniami |
| Play Games leaderboard format | `scoreFormat` is flat: `{"numberFormatType": "NUMERIC", "numDecimalPlaces": 0}` (no `numberFormat` nesting) |
| Play Games icons | No longer uploadable via API (no `imageConfigurations` resource) — add manually in Play Console if desired |
| Publishing | Play Games configs are drafts until "Sprawdź i opublikuj" in Play Console; GC config ships with the next app release |
