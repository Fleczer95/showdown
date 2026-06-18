# Earned Signature Emoji — Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)

## Summary

A **signature** is a single emoji earned at a level milestone and shown next to the
player's nickname on both the global Rankings board and the local Leaderboard. It is a
pure function of `lifetimeXp` (auto, highest-earned) — never user-entered — mirroring
how `unlockedRewards()` already derives theme unlocks. Shipping a new tier is additive
and retroactive: anyone already past that level gets it with no migration.

Signatures double as a new earned-cosmetic reward type that fills the current "reward
desert" on the Level Map (today only levels 15 and 30 grant a reward; levels 1–14 and
31–50 grant nothing).

## Goals

- Add a social, IAP-safe, cheap-to-produce reward type that is visible to other players.
- Front-load rewards (a first reward by level 5) and populate the empty back half.
- Keep the signature meaningful: system-derived, never claimable via free text.
- Show earned/locked signatures as a collection on the Progress → Achievements tab.

## Non-goals (YAGNI)

- No equip/picker UI and no stored "active signature" preference — the displayed
  signature is always the highest tier the player has earned.
- No rendering on the Home level chip or the challenge-share card.
- No server-side verification of earned tier (not possible on the Firestore Spark plan;
  see Anti-spoof).
- No app-wide emoji → SVG migration and no SVG library adoption. This feature only builds
  the `Glyph` seam those will plug into, and routes signature rendering through it (see
  Render abstraction).
  - **Update (2026-06-18):** the migration has since landed through this exact seam.
    `Glyph` now renders bundled **Microsoft Fluent Emoji (3D)** art (PNG, MIT) for the app's
    9 emojis via `src/components/atoms/glyphAssets.ts`, falling back to the OS text glyph for
    anything unmapped. The game-title emoji (`games.ts`) were routed through `Glyph` too. No
    call site or wire format changed — the chosen art is raster images, not an SVG library.

## Background — two boards

- **Global Rankings** (`src/screens/RankingScreen.tsx`, Firestore, ADR-0004).
  `RankingEntry = { nickname, score }`, deliberately minimal, keyed by device UUID at
  `rankings/{game}/periods/{period}/entries/{uuid}`. Fed by async challenges, seen by
  other players. Best-only: each new best **overwrites** the device's single entry
  (`push.ts`).
- **Local Leaderboard** (`src/components/molecules/Leaderboard.tsx`, MMKV, on-device).
  `LeaderboardEntry = { nickname, progress, score, timestamp }`, per-game top-10,
  private to the device. Rows are **appended** and timestamped.

The signature appears on both.

## Data model

### Wire format: store the id, not the glyph

Entries store the signature **id** (a stable ASCII slug, e.g. `"fire"`), **never** the emoji
glyph itself. The app — the only renderer — resolves id → presentation at render time. This
decouples the stored data from the visual:

- The visual can be swapped later (emoji → bespoke SVG/Skia badge) with **zero data
  migration**; stored entries keep their id and render the new asset.
- Firestore rules validate against a small fixed set of ids (plain ASCII), avoiding
  unicode-emoji matching in rules.
- The wire value is stable across emoji unicode versions and platform quirks.

**Visual for v1: emoji.** Chosen over custom SVG because emoji are already an established
inline pattern in this app (`games.ts` renders 🪜/💰/🎡 next to game titles), they suit the
kids/family audience (multicolor, instantly legible), and need no asset pipeline. Because the
wire format is an id, this is a reversible decision — see above.

### Render abstraction — prepared for the planned app-wide emoji → SVG migration

The project intends to later migrate **all** emoji in the app to SVG via a library (e.g. a
Twemoji/OpenMoji-style codepoint → SVG renderer). To make that a one-place change rather than
a scattered find-and-replace, this feature does **not** interpolate raw emoji into `<Text>`.
Instead it introduces a single shared presentational atom:

```tsx
// src/components/atoms/Glyph.tsx — the ONE place an emoji becomes pixels.
function Glyph({ emoji, size }: { emoji: string; size?: number }): JSX.Element
```

- **v1 internals:** render the emoji character as `<Text style={{ fontSize: size }}>`.
- **Post-migration:** swap the internals to the SVG library (look up the emoji's codepoint),
  changing nothing at any call site.

The atom is keyed by the **emoji character**, which is the stable semantic token both today's
text render and a codepoint-based SVG library understand. Every signature render surface goes
through `<Glyph>`. The atom is shared infrastructure: the future migration reuses it for all
other emoji (game emoji, etc.).

**Scope:** this feature only *creates* `Glyph` and routes signature rendering through it.
Migrating pre-existing emoji (e.g. `games.ts`) to `<Glyph>`, and adopting the SVG library, are
explicitly **out of scope** here — but `Glyph` is the seam they will plug into. Routing the
existing game emoji through `Glyph` is a trivial, optional follow-up, not part of this plan.

### Module

New module `src/game/progression/signatures.ts`, sibling to `themes.ts`:

```ts
export interface Signature {
    /** Reward id — matches a LEVEL_MAP node `rewardId` and `unlockedRewards()`. */
    id: string;            // e.g. 'signature-spark'
    /** Stable ASCII slug stored on board entries (the id without the 'signature-' prefix). */
    slug: string;          // e.g. 'spark'
    /** v1 presentation: the emoji the slug resolves to. Swap to an SVG component later. */
    emoji: string;         // e.g. '⚡'
    titleKey: string;      // e.g. 'progression.signatures.spark'
    level: number;         // the LEVEL_MAP node it is bound to
}

export const SIGNATURES: readonly Signature[];

/** The highest-tier signature SLUG earned at `lifetimeXp`, or undefined. Stored on entries. */
export function signatureSlug(lifetimeXp: number): string | undefined;

/** Resolve a stored slug to its current presentation (v1: emoji). Render-time only. */
export function signatureEmoji(slug: string | undefined): string | undefined;

/** Allowlist of every known signature slug (for Firestore rule validation + tests). */
export const SIGNATURE_SLUGS: readonly string[];
```

`signatureSlug(lifetimeXp)` walks `SIGNATURES` (or `LEVEL_MAP`) and returns the slug of the
highest-level signature whose node has been reached (`lifetimeXp >= node.xp`), or `undefined`
below the first signature tier. `signatureEmoji(slug)` maps a stored slug back to its emoji
**character**; that character is then handed to `<Glyph>`, which is the single place a glyph
becomes pixels. So there are exactly two seams: the emoji character is *defined* once (in
`SIGNATURES`) and *rendered* once (in `Glyph`).

### Binding to the Level Map

Signatures reuse the **existing** `LevelNode.rewardId` field with a `signature-` prefix,
alongside today's `theme-` prefix. `unlockedRewards()` already collects every reached
`rewardId` regardless of type, so it needs no change. One reward per node.

### Placement

Signatures occupy currently-empty nodes; the two existing theme rewards are unchanged.
Because the displayed signature is always the highest earned, the emoji visibly upgrades
as the player climbs.

| Level | Reward id | Slug (wire) | Emoji (v1 render) |
|-------|-----------|-------------|-------------------|
| 5  | `signature-sprout`   | `sprout` | 🌱 |
| 10 | `signature-spark`    | `spark`  | ⚡ |
| 15 | `theme-champion`     | —        | *(unchanged theme)* |
| 20 | `signature-fire`     | `fire`   | 🔥 |
| 25 | `signature-gem`      | `gem`    | 💎 |
| 30 | `theme-legend`       | —        | *(unchanged theme)* |
| 40 | `signature-star`     | `star`   | 🌟 |
| 50 | `signature-crown`    | `crown`  | 👑 |

(Slugs and levels are stable; the emoji column is just the v1 presentation and can change
without touching stored data.)

## Write path — signature captured at write time

The signature is read from current progression state and written onto the entry when the
score is saved/pushed. The non-hook accessor `loadStats()` (`recordRun.ts:101`) exposes
`lifetimeXp`, so both paths can derive it without React context.

The stored value is the **slug** (`signatureSlug(...)`), never the emoji glyph.

- **Local leaderboard** (`src/game/leaderboard.ts` `saveScore`): add `signature?: string`
  (the slug) to `LeaderboardEntry`. On save, compute `signatureSlug(loadStats().lifetimeXp)`
  and store it on the row. Because rows are appended and timestamped, each historical row
  **freezes** the signature the player had at that run.
- **Global board** (`src/game/ranking/push.ts`): add `signature?: string` (the slug) to
  `RankingEntry` (an **ADR-0004 amendment** — the type is deliberately minimal today).
  In `pushToBucket` / `pushRanking`, derive `signatureSlug(loadStats().lifetimeXp)` and
  include it in the `submitEntry` payload. Because the entry is overwritten on each new
  best, it reflects the signature at the player's **last best-push** — consistent with
  "highest earned at write time."

`undefined`/absent signature is valid everywhere (players below level 5, or entries
written before this feature ships).

## Anti-spoof — signature is system-only; nicknames go text-only

The signature must mean something, so it is never sourced from user input:

1. **Nicknames become text-only.** Add an emoji/symbol stripper applied to:
   - the public challenge/ranking nickname at its single write point
     (`src/game/challenge/nickname.ts` `setChallengeNickname`, alongside the existing
     `containsProfanity` gate); and
   - the local leaderboard nickname input (`Leaderboard.tsx` / `leaderboard.ts`
     `saveScore`).
   The stripper keeps letters (incl. diacritics), digits, spaces, and basic punctuation,
   and removes emoji/pictographic symbols. Net effect: the **only** emoji that can appear
   on a row is the app-set signature.
2. **Firestore security rules.** Update the rankings entry rule to:
   - accept `signature` only when absent, empty, or a member of the known
     `SIGNATURE_SLUGS` allowlist (plain ASCII slugs — easy to validate in rules); and
   - keep `nickname` a plain string (length-bounded as today).

   A hacked client still cannot claim a signature **through the app** (it is derived), and
   the allowlist blocks arbitrary strings. A modified client could still write a valid-but-
   unearned slug; this is accepted residual risk — pure vanity, identical in spirit to the
   already-trusted free-text nickname, and unverifiable on the Spark plan. Documented in the
   ADR-0004 amendment. The cleanup script's `--remove` remains the moderation backstop.

## Rendering surfaces

Every surface renders the glyph via `<Glyph emoji={signatureEmoji(slug)} />` — never raw
`<Text>` interpolation — so both a visual change (in `Glyph`) and the emoji character itself
(in `SIGNATURES`) each live in exactly one place.

1. **Global board** — `RankingScreen.tsx` `BoardRow`: render `<Glyph>` for
   `entry.signature` (when present) immediately before the nickname.
2. **Local leaderboard** — `Leaderboard.tsx` row: render `<Glyph>` for `entry.signature`
   (when present) immediately before the nickname.
3. **Map tab reward node** — `ProgressScreen.tsx` map list currently hardcodes the
   `theme-` prefix (lines ~206-253). Generalize the reward-node renderer to resolve the
   reward by id prefix: `theme-*` → theme name + ✦ (current behavior); `signature-*` →
   `<Glyph>` + its title. Locked/earned icon logic (`Sparkles`/`Lock` vs
   `unlockedRewards.has(...)`) is unchanged.
4. **Achievements tab — Signatures collection (new).** Add a third section below
   "Challenges" and "Feats" in the Achievements tab. Reuse the **exact** Feats grid
   pattern (`styles.grid` + the badge `Card`):
   - **Earned:** the emoji (via `<Glyph>`) shown in full color, label = signature
     title, sublabel = unlock level.
   - **Locked:** identical to a locked Feat — greyed `Lock` icon with the card at
     `opacity: 0.55`, showing the unlock level (e.g. "Level 25").
   Section header uses a new i18n key `progression.signaturesTitle`.

## i18n

Add to `src/i18n/locales/en.json` and `pl.json`:

- `progression.signaturesTitle` — Achievements-tab section header.
- `progression.signatures.<slug>` — one title per signature (`sprout`, `spark`, `fire`,
  `gem`, `star`, `crown`).
- A reward-label key for the map node if the existing `progression.rewardTheme` does not
  fit signatures (e.g. `progression.rewardSignature`).

Per AGENTS.md, verify EN/PL parity after adding keys.

## Testing

- `signatureSlug(lifetimeXp)` — returns `undefined` below level 5; returns each tier's slug
  at its threshold; upgrades at each subsequent threshold; is retroactive. Unit.
- `signatureEmoji(slug)` — resolves each known slug to its emoji character; returns
  `undefined` for unknown/absent slugs. Unit.
- `Glyph` — renders the given emoji character (today as text); a snapshot/exists check so
  the migration seam is covered. Unit.
- Nickname stripper — removes emoji/pictographic symbols, preserves letters (incl.
  diacritics), digits, spaces, basic punctuation. Unit.
- `saveScore` writes the derived slug onto the new local entry. Unit.
- `pushRanking`/`pushToBucket` includes the derived slug in the submitted payload.
  Unit (mock `submitEntry`).
- `SIGNATURE_SLUGS` matches the slug of every `signature-*` entry in `SIGNATURES`, and
  every `signature-*` `rewardId` on a `LEVEL_MAP` node resolves to a `SIGNATURES` entry
  (extend `map.test.ts`).
- Firestore rules: an entry with an allowlisted slug is accepted; one with an off-allowlist
  string is rejected (rules emulator test if present; otherwise documented manual check).

## Files touched

- `src/components/atoms/Glyph.tsx` — **new** atom: the single emoji→pixels seam for the
  planned app-wide SVG migration. Signature surfaces render through it.
- `src/game/progression/signatures.ts` — **new** module (`SIGNATURES`, `signatureSlug()`,
  `signatureEmoji()` resolver, `SIGNATURE_SLUGS` allowlist).
- `src/game/progression/map.ts` — add `signature-*` `rewardId`s to nodes 5/10/20/25/40/50.
- `src/game/progression/index.ts` — export the new module.
- `src/game/ranking/types.ts` — `RankingEntry.signature?: string` (slug).
- `src/game/ranking/push.ts` — derive + include slug on push.
- `src/game/leaderboard.ts` — `LeaderboardEntry.signature?: string` (slug); derive on save.
- `src/utils/nickname.ts` (or new sibling) — emoji/symbol stripper for text-only nicknames.
- `src/game/challenge/nickname.ts` — apply stripper at the public write point.
- `src/components/molecules/Leaderboard.tsx` — strip on save; render signature in rows.
- `src/screens/RankingScreen.tsx` — render signature in `BoardRow`.
- `src/screens/ProgressScreen.tsx` — generalize map reward node; add Signatures grid.
- `src/i18n/locales/en.json`, `pl.json` — new keys.
- Firestore security rules — allowlist `signature`, keep `nickname` text.
- `docs/decisions/0004-*.md` — amendment noting the `signature` field + trust posture.
- Tests as listed above.
