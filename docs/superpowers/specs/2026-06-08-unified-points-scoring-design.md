# Unified Points Scoring — Design

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Scope:** All three live games — The Ladder, The Drop, The Wheel.

## Problem

The Ladder scores by "szczebel" (rung reached, 1–15), which is not a points value and
isn't comparable to the money-based scores of The Drop and The Wheel. We want every game
to produce a **points** score on its leaderboard, with two new reward mechanics:

1. **Speed bonus** — faster decisions earn more points (hidden per-decision timer).
2. **Clean-play bonus** — bonus for not using "koło ratunkowe" (lifelines) / paid help.

## Core rule (shared by all three games)

A single pure helper drives every speed bonus:

```
speedBonus(baseValue, seconds) = round(baseValue × max(0, (100 − seconds) / 100))
```

- Hidden per-decision stopwatch with a **100-second window**. An instant answer earns a
  bonus equal to `baseValue`; at ≥100 s the bonus is 0.
- Inherently **capped at `baseValue`** — the speed bonus for a decision can never exceed
  that decision's correct-answer base points.
- **Scales per stage** automatically, because `baseValue` rises with the stage, so a fast
  answer late is worth more than a fast answer early.

This lives in a new pure module `src/game/scoring.ts` (no React / react-native imports),
unit-tested, and imported by all three play screens. Each play screen records a
`decisionStartedAt` timestamp (epoch ms) and computes elapsed seconds at the moment of the
decision: `seconds = (Date.now() − decisionStartedAt) / 1000`.

## The Ladder

- **Base:** `rung × 100` per correct answer (rung 1 = 100 … rung 15 = 1500).
- **Speed:** per question, `speedBonus(rung × 100, seconds)`. The timer resets on each new
  question, **including after a Skip** (Skip swaps in a new question on the same rung).
- **No-lifeline bonus:** **+500 per unused lifeline** at run end. Three lifelines
  (50:50, ask studio, skip) → up to **+1500** for a clean run. Partial credit for using
  fewer. Computed as `(3 − usedLifelines.length) × 500`.
- **Final score** = Σ(correct-answer base) + Σ(per-question speed bonus) + lifeline bonus.

Note: base + speed accrue only for questions answered **correctly**. A wrong answer ends
the run; that question contributes nothing.

## The Drop

- **Base:** final surviving bank.
- **Speed:** per round, `speedBonus(moneyKeptThatRound, secondsToLockIn)`, where the timer
  runs from the start of the round's allocating phase to when "Lock In" is pressed, and
  `moneyKeptThatRound` is the stake placed on the correct option that survived (known after
  the reveal). The suspense/reveal animation time does **not** count against the timer.
- **No clean bonus** — The Drop has no lifelines or paid help.
- **Final score** = final bank + Σ(round speed bonuses).

## The Wheel

- **Base:** final banked cash.
- **Speed:** per puzzle, `speedBonus(puzzleBankedCash, secondsToSolve)`, where the timer
  runs from when the puzzle is presented to the moment of a correct solve, and
  `puzzleBankedCash` is the round cash banked by that solve.
- **No-vowel bonus:** **+250 per puzzle solved without buying a vowel** (mirrors the 250
  vowel cost; vowel-buying is the "paid help" analog to a lifeline).
- **Final score** = banked cash + Σ(per-puzzle speed bonus) + Σ(per-puzzle no-vowel bonus).

Note: speed and no-vowel bonuses accrue only on a **correct solve**. A failed/abandoned
puzzle contributes its banked cash (0 for a wrong solve) and no bonuses. Because puzzles
can take a while, speed bonuses here will often be small — that is acceptable; the speed
bonus is a nice-to-have, not a core driver for The Wheel.

## Leaderboard & display

- All three boards now store **points**. `Leaderboard.formatScore` becomes uniform:
  `score.toLocaleString(locale)` with a "pts" label. The Ladder-specific
  `leaderboard.rung` formatting branch is removed (and the now-unused `leaderboard.rung`
  i18n key cleaned up if nothing else references it).
- **Board reset via namespace bump:** because Ladder scores change scale (rung 1–15 →
  thousands) and Drop/Wheel scores now include bonuses, old entries are not comparable.
  Bump the MMKV board store id `showdown-leaderboard` → `showdown-leaderboard-v2` so old
  local boards are cleanly abandoned. No migration code (acceptable for pre-release local
  data). The shared `prefsStore` (last nickname) is **not** changed.
- **Game-over screens:** show the **total points** prominently, with a small breakdown
  line showing the components (base / speed / clean bonus) so players see where points
  came from. The Ladder keeps a flavor subtitle ("Reached rung X").

## Constants (final)

| Constant | Value |
|---|---|
| Speed window | 100 s |
| Ladder base per rung | `rung × 100` |
| Ladder lifeline bonus | 500 per unused lifeline (max 1500) |
| Wheel no-vowel bonus | 250 per clean puzzle |
| Board MMKV namespace | `showdown-leaderboard-v2` |

## Architecture / units

- `src/game/scoring.ts` — pure: `speedBonus(baseValue, seconds)` plus shared constants
  (`SPEED_WINDOW_SECONDS`, `LADDER_RUNG_POINTS`, `LADDER_LIFELINE_BONUS`,
  `WHEEL_NO_VOWEL_BONUS`). Optionally small pure helpers per game for assembling a final
  score from its inputs, to keep play screens thin and testable.
- Each play screen owns a `decisionStartedAt` timestamp and accumulators for speed/clean
  bonuses across the run, and passes the assembled total as `pendingScore` to
  `<Leaderboard>` at game over.
- `src/game/leaderboard.ts` — bump store id; remove the raw-score comment that says Ladder
  stores "rung".
- `src/components/molecules/Leaderboard.tsx` — uniform points formatting; drop the
  per-game `rung` branch.

## Testing

- Unit tests for `scoring.ts`: `speedBonus` boundaries (0 s → baseValue, 50 s → half,
  ≥100 s → 0, negative/overshoot clamped), rounding, and per-game final-score assembly.
- Existing `leaderboard.test.ts` still passes (ranking logic unchanged); update any
  rung-specific expectations if present.

## Out of scope

- Combining the three per-game boards into a single cross-game leaderboard.
- Migrating old local leaderboard entries.
- Visible countdown UI / timeout failure (explicitly chose hidden timer, no fail).
