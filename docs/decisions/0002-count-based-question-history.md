# 2. Count-based question history over boolean used-flags

Date: 2026-05-30

## Status

Accepted

## Context

Each ShowDown game samples N questions per run from a pool (The Drop: 9 of ~14;
The Wheel: 3 of ~6; The Ladder: 1 per rung). Selection was pure-random, so
questions repeated too often. We want a game to cycle through its whole pool
before repeating, and to keep doing so indefinitely.

Two approaches were considered:

1. **Boolean "used" flags + reset.** Mark each shown question used; exclude used
   ones when picking; when the unused set can't fill a run, reset all flags.
2. **Count-based weighting** (as in the sibling app TinyParty's `createDeck`):
   store a per-question show-count; order candidates by ascending count, shuffle
   within each count tier, take the least-seen first.

## Decision

Use **count-based** selection.

- A per-game **Question History** (`Record<questionId, showCount>`) is persisted
  on device in MMKV (`createMMKV({ id: 'showdown-history' })`), keyed by game id.
- Selection uses a pure `createDeck(items, history, rng)` (ported from TinyParty):
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

- Cycles the full pool before any repeat (the count-0 tier is exhausted before
  any count-1 item is shown) — the same guarantee booleans give.
- **No explicit reset branch** to write or get wrong; the pool self-cycles once
  all counts equalize.
- Better at the wrap boundary: when the pool is smaller than a run needs, repeats
  are forced, but the least-recently-seen are reused (a just-seen question is not
  served again immediately, unlike a boolean reset's uniform-random pick).
- Counts grow unbounded (small ints; negligible in MMKV).
- Requires stable per-question ids (a one-time content pass).
- **Parked (Phase 3):** when an IAP pack unlocks, its count-0 questions would
  dominate until they catch up. Mitigation: seed a new pack's counts to the
  current pool minimum so new content blends rather than starving the base pool.
