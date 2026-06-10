# Content Schemas, Conventions & Wiring

## Table of contents
- Gameplay bridge (read first)
- File locations
- Per-game card shapes
- Authoring representation
- Front-load curve (ladder)
- id / sku / i18n conventions
- Catalog wiring (PackDefinition)
- i18n wiring

## Gameplay bridge (READ FIRST)

A content bridge feeds owned packs into gameplay via `src/data/store/packContent.ts`:
- `getOwnedPackContent<T>(gameId, locale, ownedIds)` — localized cards (Ladder, Wheel).
- `getOwnedPackContentBilingual<TMono, T>(gameId, ownedIds, zip)` — bilingual cards (Drop).

Each play screen reads `useStore().purchasedItemIds`, calls the bridge, and merges the result with its free bank: Ladder via `buildLocalizedRungs(lang, ownedCards)` (slotted by `difficulty`), Wheel via `pickPuzzles(locale, count, owned)`, Drop via `buildGame([...dropQuestions, ...owned])` using `zipDropCard`.

**What this means for authoring** — the bridge consumes `PackDefinition.content` (`{ en, pl }`) for the game's `gameId`, so the per-locale card shape MUST match what each game expects:
- Ladder: each card needs `difficulty` (1–15) in addition to the localized question fields, or it cannot be slotted into a rung.
- Drop: cards are `DropPackCard` (`{ id, prompt: string, options: string[], correctIndex }`); EN and PL arrays must be the same length and index-aligned (the zipper pairs them by position).
- Wheel: cards are the localized `PuzzleContent` from `wheel/logic.ts` (`{ id, phrase: string, category: string }`), phrases UPPERCASE.

A pack with the wrong per-card shape will type-check at the catalog boundary but break at runtime, so match these exactly.

## File locations

| Concern | Path |
|---|---|
| Ladder free content | `src/game/ladder/content.ts` (`RUNGS: QuestionContent[][]`, `ALL_PACK`) |
| Drop free content | `src/game/drop/content.ts` (`dropQuestions: DropQuestion[]`), type in `src/game/drop/logic.ts` |
| Wheel free content | `src/game/wheel/content.ts` (`PACKS`, `PuzzleContent`) |
| Store types | `src/data/store/types.ts` (`PackDefinition`, `PackContent`) |
| Store catalog | `src/data/store/catalog.ts` (`STORE_CATALOG`) |
| Store icons | `src/data/store/index.ts` (`STORE_ICONS`) |
| i18n | `src/i18n/locales/en.json`, `src/i18n/locales/pl.json` |
| Content validator | `scripts/validate-content.mjs` |

## Per-game card shapes (bilingual — what the games + validators use)

```ts
// Ladder — content.ts. RUNGS is indexed by rung (15 entries); each entry is a pool.
interface QuestionContent {
  id: string;                 // `ladder-<slug>-NNN`
  question: { en: string; pl: string };
  options: { en: string; pl: string }[];   // exactly 4
  correctIndex: number;       // 0..3
  hint: { en: string; pl: string };
}

// Drop — logic.ts. Flat pool. No difficulty field.
interface DropQuestion {
  id: string;                 // `drop-<slug>-NNN`
  prompt: { en: string; pl: string };
  options: { en: string; pl: string }[];   // exactly 4 real statistics; one true
  correctIndex: number;       // 0..3
}

// Wheel — content.ts. Flat pool. Phrases UPPERCASE.
interface PuzzleContent {
  id: string;                 // `wheel-<slug>-NNN`
  phrase: { en: string; pl: string };
  category: { en: string; pl: string };
}
```

## Authoring representation

Author the pack as a **bilingual content module** matching the shapes above, at `src/game/<game>/packs/<slug>.ts`. This makes `audit_engine.cjs` and `validate-content.mjs` work directly (they expect the bilingual `{en,pl}`-per-field shape).

The store's `PackContent<TCard>` is `{ en: TCard[]; pl: TCard[] }` — **monolingual arrays per locale**. Derive it from the bilingual module by splitting each field into its locale, so EN/PL parity is guaranteed by construction:

```ts
const en = cards.map(c => ({ ...c, question: c.question.en, options: c.options.map(o => o.en), hint: c.hint?.en }));
const pl = cards.map(c => ({ ...c, question: c.question.pl, options: c.options.map(o => o.pl), hint: c.hint?.pl }));
// PackDefinition.content = { en, pl }
```

## Front-load curve (ladder)

Run `scripts/pack_plan.mjs --game ladder --slug <slug>` for the authoritative table. Summary:

| Pool | Rungs | difficulty | Count / rung |
|---|---|---|---|
| 1 | 1–3 | 1–3 | 30 |
| 2 | 4–6 | 4–6 | 24 |
| 3 | 7–9 | 7–9 | 20 |
| 4 | 10–12 | 10–12 | 15 |
| 5 | 13–15 | 13–15 | 11 |

Total = 300. Each `QuestionContent.difficulty` (if present in the consuming shape) and its rung index MUST match. Pools 4–5 are intentionally below the audit's 20/rung floor.

## id / sku / i18n conventions

- pack id: `pack-<game>-<slug>`
- card ids: `<game>-<slug>-NNN` (zero-padded to 3; sequential within the pack)
- sku: `com.showdown.pack_<game>_<slug>`
- i18n key root: `<game>_<slug>` →
  - `screen.store.item.<game>_<slug>.title`
  - `screen.store.item.<game>_<slug>.desc`
  - `screen.store.feature.<game>_<slug>_1`, `_2`, …

## Catalog wiring (PackDefinition)

`STORE_CATALOG` in `catalog.ts` currently spreads only `themes`. The header comment marks where game packs go (`// ...gamePacks`). Create/extend a per-game packs array (e.g. `src/data/store/packs.ts` exporting `gamePacks: PackDefinition[]`) and spread it into `STORE_CATALOG` before `...themes`. Each entry:

```ts
{
  id: 'pack-<game>-<slug>',
  kind: 'pack',
  gameId: '<the-game-id from src/data/games.ts, e.g. "the-ladder">',
  status: 'hidden',            // flip to 'live' only after IAP approval in BOTH stores
  tier: 'premium',
  sku: 'com.showdown.pack_<game>_<slug>',
  presentation: {
    titleKey: 'screen.store.item.<game>_<slug>.title',
    descriptionKey: 'screen.store.item.<game>_<slug>.desc',
    iconName: '<key from STORE_ICONS>',
    accentColor: '#RRGGBB',
    featuresKey: ['screen.store.feature.<game>_<slug>_1', 'screen.store.feature.<game>_<slug>_2'],
    fallbackPrice: '$2.99',
  },
  content: { en: [...], pl: [...] },   // derived monolingual arrays
}
```

Note `gameId` uses the game registry id (`the-ladder`, `the-drop`, `the-wheel`) from `src/data/games.ts`, not the short `ladder/drop/wheel` token.

## i18n wiring

Add the title/desc/feature strings under `screen.store.item` and `screen.store.feature` in BOTH `en.json` and `pl.json`, mirroring the existing `theme_cyberpunk` entries. Every key present in EN must exist in PL.
