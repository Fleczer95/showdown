# ASO — App Store / Google Play metadata

Source-of-truth marketing copy for ShowDown's store listings, in English (`en-US`)
and Polish (`pl-PL`). Each locale folder mirrors the editable App Store Connect /
Google Play fields, one file per field. Generated from the app's actual content
(four game modes, async challenges, rankings, themes, premium packs).

## Files per locale

| File | Apple field | Google Play field | Limit |
|------|-------------|-------------------|-------|
| `name.txt` | App Name | Title | 30 (Apple) / 50 (Play) |
| `subtitle.txt` | Subtitle | — | 30 |
| `short-description.txt` | — | Short description | 80 (Play) |
| `keywords.txt` | Keywords (comma-sep, no spaces) | — (Play has no field) | 100 |
| `promotional-text.txt` | Promotional Text (editable anytime) | — | 170 |
| `description.txt` | Description | Full description | 4000 |
| `whats-new.txt` | What's New | Release notes | 4000 |

Run `python3 aso/validate.py` to check every file against its limit.

## Global submission settings (not per-locale)

- **Primary category:** Games (subcategory: Trivia; secondary suggestion: Word)
- **Privacy Policy URL:** en `https://lebene.pl/en/privacy` · pl `https://lebene.pl/pl/polityka-prywatnosci`
- **Export compliance:** No non-exempt encryption (`usesNonExemptEncryption: false` in app.json)
- **Content rights:** Contains no third-party content requiring rights (original questions + "legally distinct" formats)
- **Copyright:** `2026 Lebene` — CONFIRM legal entity name
- **Support URL:** TODO — needs a real page (e.g. `https://lebene.pl/en/support`). REQUIRED by Apple.
- **Marketing URL:** `https://lebene.pl` (optional)

## Notes
- Apple keywords: no spaces after commas, singular forms (Apple auto-matches plurals),
  no words already in name/subtitle (those are indexed), no competitor brand names.
- Polish copy is native, grounded in the in-app translations (Drabina, Plansza, Koło, Zrzut).
