# Achievements & Rewards — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)
**Scope:** New progression layer across all three live games — The Ladder, The Drop, The Wheel.

## Problem

ShowDown is three solo games with separate per-game leaderboards and no connective
tissue, no reason to return, and no reason to try a game you don't already open. We
want a progression layer that does four jobs at once:

- **A — Retention:** reasons to come back (streaks, steady climb).
- **B — Breadth/discovery:** push players to try all three games and their mechanics.
- **C — Earn-only cosmetics:** exclusive themes (sounds later) that **cannot be bought**,
  creating desire without undercutting the premium themes the store sells.
- **D — Completionist:** badges for specific feats, satisfying on their own.

## Shape

A **hybrid** of two complementary systems:

- A finite **Level Map** — the spine. It unifies the three otherwise-disconnected games
  under one cumulative track and is the home for all earn-only cosmetics.
- Discrete **achievement medals** — beside the map. The map rewards *volume*; achievements
  reward *specific skill and breadth*.

Each achievement grants a **badge + XP**. Exclusive themes/sounds live **only** on map
nodes (0 flagship exceptions in v1). Players reach cosmetics by playing (volume → XP →
map) and accelerate via achievements (which pay XP into the same spine).

## XP — a separate, normalized currency

Raw game scores are **not commensurable** (The Drop's bank runs to 1,000,000; a Ladder
run tops out in the low thousands; The Wheel's bank is different again). Summing them
would make the map measure "how much Drop did you play." So XP is its own tunable quantity,
decoupled from the per-game `score`.

`lifetimeXp` is **monotonic** (only grows) and **never spendable** — it cannot be bought,
so the IAP store and the progression track never touch. Lifetime XP *is* the balance.

### Per-run XP (floor + skill + breadth)

```
runXp(result) = FLOOR
              + round(SKILL_CAP × performanceFraction(result))   // skill
              + breadthBonus(result.gameId, localDate)            // breadth
```

- **Floor** — flat XP for completing any run. Protects retention: weak/casual players
  still climb.
- **Skill** — `0..SKILL_CAP`, scaled by each game's own normalized result so games are
  comparable:
  - Ladder: `rungReached / 15`
  - Drop: `finalBank / 1_000_000`
  - Wheel: `puzzlesSolved / 3`
- **Breadth** — `BREADTH_BONUS` for the **first play of each distinct game per local
  day** (all three in a day → 3 × bonus). The lever that makes people try a game they
  ignore.

Achievements additionally pay flat XP (see below).

## Everything is derived

Mirroring `src/data/store/resolver.ts`: persist only **raw stats**; compute the rest as
**pure functions** over them.

- `level(lifetimeXp, MAP)` → current level.
- `unlockedRewards(lifetimeXp, MAP)` → set of unlocked cosmetic ids.
- `achievementsUnlocked(stats)` → set of completed achievement ids.

Because ownership is *derived from* monotonic state (not fired once on a threshold
cross), **extending the map or adding achievements later is purely additive and
retroactive** — a returning player whose `lifetimeXp` already qualifies instantly owns
the new nodes. **No migration code, ever.** This is the whole reason the map can be
extended over time.

## The Level Map

- **Finite, 15 levels for v1**, data-driven (a declarative array, like `games.ts` /
  store catalog) so future updates append entries + ship the cosmetic.
- **Escalating curve** — first ~3 levels in the opening session (hook), midgame over days,
  L15 a multi-week goal.
- **Cosmetics decoupled from level count.** Most nodes carry a badge + an XP/confetti
  beat. Exclusive earn-only themes sit on a few milestone nodes only.
  - v1 commits **2 earned themes**: **L8** (mid) and **L15** (capstone).
  - **L5 / L11 / L14** are **reserved** nodes — filled with new earned themes/sounds in
    later updates (auto-granted retroactively to anyone already past them).

### Curve (cumulative XP to reach each level)

| Lv | XP | Lv | XP | Lv | XP |
|----|------|----|-------|----|--------------------|
| 1  | 0    | 6  | 1,800 | 11 | 8,500  ◇reserved    |
| 2  | 150  | 7  | 2,600 | 12 | 11,000             |
| 3  | 400  | 8  | 3,600 ✦theme | 13 | 14,000      |
| 4  | 750  | 9  | 4,900 | 14 | 17,500 ◇reserved   |
| 5  | 1,200 ◇reserved | 10 | 6,500 | 15 | 22,000 ✦capstone theme |

Paces to ~Level 3–4 in the first session, L15 ≈ 50+ engaged days at casual pace.

## Achievements (v1: 25)

Mix of tiered families (for cumulative axes where a ladder helps) and one-off feats
(for inherently binary skill/breadth moments). Each grants **badge + XP**.

### Tiered families (Bronze / Silver / Gold) — the retention drip

| Family | Tiers |
|---|---|
| Contestant (runs played) | 10 / 50 / 200 |
| On a Roll (consecutive-day streak) | 3 / 7 / 30 |
| Regular (distinct days played) | 5 / 15 / 40 |
| Winner (wins, any game) | 5 / 25 / 100 |
| Big Scorer (single-run points) | 5k / 20k / 50k |

### One-offs — skill & breadth feats

- **Triple Threat** — play all 3 games in one day *(breadth)*
- **Well-Rounded** — win each of the 3 games at least once *(breadth)*
- **To the Top** — reach Rung 15 on the Ladder
- **Spotless** — win a Ladder run using zero lifelines
- **Survivor** — survive all 9 Drop rounds
- **Iron Bank** — finish the Drop keeping ≥ half the starting bank
- **Vowel-Free** — solve a Wheel puzzle buying no vowels
- **Clean Sweep** — solve all 3 Wheel puzzles in one run
- **Quick Wit** — earn a big speed bonus (answer under ~5s at a high rung)
- **Comeback** — solve a Wheel puzzle after surviving a Bankrupt

XP payouts: one-off **200**; tiers **Bronze 100 / Silver 250 / Gold 500**.

**0 flagship exceptions in v1** — no achievement carries its own exclusive cosmetic; all
cosmetics are on the map. Revisit pinning a theme to *Clean Sweep* in a later update once
theme supply grows (trivial + retroactive under the derived design).

## Module & integration

New self-contained **`src/game/progression/`** owns:

- map data + the pure `level` / `unlockedRewards` functions,
- achievement definitions + `achievementsUnlocked`,
- earned-cosmetic definitions (unlock condition; **theme tokens stay in
  `src/theme/themes/`** like every other theme),
- `recordRun` + its persistence,
- own MMKV store: **`showdown-progression`**.

**Earned cosmetics stay out of the commercial store** (`STORE_CATALOG`), so IAP flows,
SKUs, and `is_paying_user` analytics stay uncontaminated. Earned themes **union into
`src/theme/registry.ts`**: `themeRegistry = [...storeThemes, ...progressionThemes]`, one
picker, earned rows tagged (e.g. "Earned ✦"), their lock resolved against
`unlockedRewards(lifetimeXp)` instead of purchases. Store theme tokens and earned theme
tokens are otherwise identical, so the theme provider/persistence need no changes.

## Runtime — one impure seam

`recordRun(result: GameRunResult)` is called at each game-over (the same place the screen
assembles its unified `score`). It:

1. updates persisted **raw stats** — `lifetimeXp`, run count, per-game wins, the distinct
   dates-played set, today's played-gameId set, best single-run score;
2. returns a **before/after diff** — XP gained, any level-up, newly-unlocked rewards,
   newly-completed achievements — so the game-over screen can celebrate.

`GameRunResult` carries: `gameId`, `score`, `progress`, plus the few facts achievements
need (`won`, lifelines used, vowels bought, rounds survived, bankrupt-recovered, clean?).
Two of these (lifelines, vowels) already exist in the unified-scoring breakdown.

## Date / streak model

- A "day" is the device's **local calendar date** (`YYYY-MM-DD`). No anti-tamper —
  clock-fiddling only wins a free cosmetic in an offline app; not worth defending.
- Persist a **set of distinct local dates played** + the **set of gameIds played on the
  current date**.
- `currentStreak` / `longestStreak` are **pure functions** over the date set + today
  (so "played N distinct days" achievements come free and stay retroactive). The breadth
  bonus checks whether today's gameId set already contains this game before awarding.

## Surfacing

- New **Progress screen** (new `Stack.Screen`), entered from a **level chip on the Home
  header** (e.g. "Lv 7 ▰▰▱"). Contains two sections: the Level Map (visual spine) and an
  Achievements grid. Purely additive — Home and the game list are untouched.
- **Celebration:** inline on game-over — an XP bar animates the gain, a level-up pip fires
  on a threshold cross. **Escalate to a brief mini-interstitial** only when a run unlocks
  an exclusive theme/sound or a flagship feat. ~95% of runs get the inline bar; the rare
  big beats get full fanfare without interrupting every run.

## Constants (starting values — all in `progression/constants.ts`)

| Constant | Value |
|---|---|
| Run XP floor | 50 |
| Skill cap | 100 |
| Breadth bonus (per game, per local day) | 75 |
| Achievement XP — one-off | 200 |
| Achievement XP — tiers | 100 / 250 / 500 |
| Levels (v1) | 15 |
| Level curve | 0 → 22,000 cumulative (see table) |
| Earned theme nodes (v1) | L8, L15 |
| Reserved nodes | L5, L11, L14 |
| Progression MMKV store | `showdown-progression` |

All tunable from real session data without touching logic.

## Testing

- Pure-function unit tests: `runXp` (floor/skill/breadth terms, per-game normalization,
  boundaries), `level` / `unlockedRewards` (threshold edges, retroactive grant when map is
  extended), `achievementsUnlocked` (each family's tiers, each one-off), streak derivation
  (consecutive vs gap vs same-day), breadth once-per-day-per-game.
- `recordRun` diff: XP delta, level-up detection, newly-unlocked set correctness.

## Out of scope (v1)

- Spendable currency / buying levels (XP is earn-only, never spendable).
- A level system replacing achievements (the two coexist).
- Flagship achievement → direct exclusive cosmetic (deferred; revisit for *Clean Sweep*).
- Home-as-map (the map ships on its own Progress screen first).
- Anti-tamper on local-date streaks.
- Sound rewards (reserved map nodes only; tokens land later).
- Async Challenge / cross-game leaderboard (separate post-MVP tracks).
