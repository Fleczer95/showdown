# 2. Count-based question history over boolean used-flags

Date: 2026-05-30

## Status

Accepted

## Context

Each ShowDown game samples a fixed number of questions per run from a pool
(The Drop: 9; The Wheel: 3; The Ladder: 1 per rung). Selection was pure-random, so
questions repeated too often. We want a game to cycle through each selection
pool before repeating, and to keep doing so indefinitely.

Two approaches were considered:

1. **Boolean "used" flags + reset.** Mark each shown question used; exclude used
   ones when picking; when the unused set can't fill a run, reset all flags.
2. **Count-based weighting** (as in the standard `createDeck` implementation):
   store a per-question show-count; order candidates by ascending count, shuffle
   within each count tier, take the least-seen first.

## Decision

Use **count-based** selection.

- A per-game **Question History** (`Record<questionId, showCount>`) is persisted
  on device in MMKV (`createMMKV({ id: 'showdown-history-v2' })`), keyed by game id.
- Selection uses a pure `createDeck(items, history, rng)` (standard implementation):
  group by show-count, sort ascending, shuffle within each tier, take the
  least-seen first.
- Every question carries an **explicit stable `id`** in content (the pack
  generator assigns ids for future/premium packs).
- Counts are incremented at **display time** (when a question actually appears),
  not at run-build, so an early exit never deprioritizes unseen questions. In
  The Ladder, both the skipped and the swapped-in question count as shown.
- Code split: pure `src/game/deck.ts` (createDeck) + `src/game/history.ts`
  (MMKV). Build functions take `history` as a parameter and stay pure/testable;
  screens read history at mount and call `markShown` at each reveal.

## Consequences

- Cycles each selection pool before any repeat (the count-0 tier is exhausted
  before any count-1 item is shown) — the same guarantee booleans give. Games
  with difficulty bands cycle those bands independently, so a smaller band may
  repeat while a larger one still contains unseen questions.
- **No explicit reset branch** to write or get wrong; the pool self-cycles once
  all counts equalize.
- Better at the wrap boundary: when the pool is smaller than a run needs, repeats
  are forced, but the least-recently-seen are reused (a just-seen question is not
  served again immediately, unlike a boolean reset's uniform-random pick).
- Counts grow unbounded (small ints; negligible in MMKV).
- Requires stable per-question ids (a one-time content pass).
- **Unlock behaviour (revised):** when an IAP pack unlocks, its questions enter
  at **count 0 (unseen)** and are therefore surfaced first. An earlier version
  seeded a new pack's counts to the current pool minimum so it would blend rather
  than starve the base pool, but that made freshly-bought questions read as
  already-seen — the setup-screen question-pool meter stayed at "all seen" after
  a purchase, hiding the new content. The seeding (`seedDeck` / `seedHistory` /
  `seedUnlockedPack`) was removed so a purchase visibly refills the pool and the
  new questions play first. Trade-off: for a player who has cycled the base pool
  many times (high floor), the new pack leads the deck for ~floor rounds before
  old content mixes back in — accepted as the cost of making purchases feel
  rewarding.
