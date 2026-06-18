# Daily Limit on Offline Solo Runs

**Status:** Approved (design)
**Date:** 2026-06-18

## Problem

Offline solo play — the "Start" button on `GameSetupScreen` — currently has no
limit. We want a daily cap on solo runs, mirroring the existing
challenge-creation limit (`src/game/challenge/limit.ts`), and we want reaching a
new level to grant extra runs. The cap protects nothing on the free Firestore
tier (solo play is offline) but gives a retention/monetization lever and makes
levelling feel rewarding.

Solo play is the heart of the app ("solo game-show collection for a single
phone"), so the cap is deliberately generous and every threshold is tunable.

## Decisions

Locked during brainstorming:

1. **Daily-reset cap** (like challenges), not regenerating energy.
2. **One-time bonus runs (stored balance)** on level-up, banked and persisted.
3. **Premium ownership raises the cap** — `+1` per owned premium item (matches
   challenges).
4. **One global counter** across all four games (matches challenges).
5. **Bonus balance is spent only after the daily allowance is exhausted.**

## Model

A new focused module `src/game/offline/limit.ts`, mirroring
`src/game/challenge/limit.ts`. It **reuses** `premiumItemsOwned` and `canUpsell`
from `challenge/limit.ts` so premium logic is not duplicated.

Persisted state in its own MMKV store (`showdown-offline-runs`), one global
record across all games:

```ts
interface OfflineRunState {
    day: string;          // 'YYYY-MM-DD' local day the `used` count belongs to
    used: number;         // runs consumed from the daily allowance today
    bonus: number;        // banked level-up runs (does NOT reset daily)
    lastBonusLevel: number; // highest level already paid out, for one-time grants
}
```

### Allowance and remaining

- **Daily allowance** = `BASE_DAILY_RUNS + premiumItemsOwned(owned)`.
- **Day roll:** when `state.day !== today`, `used` is treated as `0`. Reads stay
  pure (no write); the roll is persisted on the next `consume`.
- `remaining(owned)` = `max(0, dailyAllowance - effectiveUsed) + bonus`, where
  `effectiveUsed = state.day === today ? used : 0`.

### Consuming a run

Hooked **only** at the Start button in `GameSetupScreen`:

- If `remaining <= 0` → open the offline-limit sheet (upsell + dismiss,
  mirroring the existing challenge `limitSheet`) and do **not** start.
- Else consume one: spend the daily allowance first; once
  `effectiveUsed >= dailyAllowance`, decrement `bonus`. Persist `day = today`
  and the updated counts, then `send({ type: 'START' })`.

Challenge play is untouched: it routes through the shared play screens but never
presses the Start button, so it never consumes an offline run. It keeps its own
create-limit.

## Level-up grants bonus runs

Each newly reached level banks `BONUS_RUNS_PER_LEVEL` runs into `bonus`.

`recordRun` (`src/game/progression/recordRun.ts`) is the single
run-completion seam and already computes `previousLevel` and the final `level`.
It calls `grantLevelBonus(previousLevel, finalLevel)` — plain numbers only, so
the limit module needs no import from progression (no dependency cycle).

```ts
grantLevelBonus(prevLevel, newLevel):
    state = read() ?? seed { day: today, used: 0, bonus: 0, lastBonusLevel: prevLevel }
    if first-encounter: state.lastBonusLevel = prevLevel   // seed, no payout
    if newLevel > state.lastBonusLevel:
        state.bonus += (newLevel - state.lastBonusLevel) * BONUS_RUNS_PER_LEVEL
        state.lastBonusLevel = newLevel
        persist
```

- **No retroactive windfall:** on first encounter `lastBonusLevel` seeds to the
  player's level *before* this run (`prevLevel`). An existing level-10 player
  therefore banks nothing on contact; only levels gained after shipping pay out.
  A new player (level 1) pays from their first level-up.
- Because every completed run flows through `recordRun`, levelling up via a
  **challenge** also banks offline bonus runs — a consistent cross-mode reward.

`recordRun`'s returned diff (`RecordRunDiff`) gains `bonusRunsGranted: number` so
the UI can surface the reward.

## UX

- **Start button** (`GameSetupScreen`): shows remaining runs (e.g.
  `Start · 4 left`). At `remaining === 0` it dims like the challenge button does
  at its cap but stays tappable to open the limit sheet. Remaining is refreshed
  on focus via the existing `useFocusEffect` block alongside `createdToday` /
  `coverage`.
- **Offline-limit sheet:** mirrors the challenge `limitSheet` — body copy, an
  upsell CTA to the Store when `canUpsell(owned)`, and a dismiss button.
- **RunCelebration:** on level-up, shows a `+N runs` line (using
  `diff.bonusRunsGranted`) so the reward is felt at the moment it's earned.
- **i18n:** new keys under an `offline.limit.*` namespace (title, body, cta,
  dismiss) and the Start button count label, added to both `en` and `pl`.
- **Analytics:** `offline_limit_hit` event (params `{ game }`), mirroring
  `challenge_limit_hit`.

## Tunables

In `src/game/offline/limit.ts`, as named constants:

- `BASE_DAILY_RUNS = 5` — free solo runs per local day, all games combined.
  Generous on purpose; the core loop lives here.
- `BONUS_RUNS_PER_LEVEL = 3` — banked per level reached.
- Premium bonus: `+1` per owned premium item (reuses `premiumItemsOwned`).

## Testing

Pure functions get unit tests like `challenge/limit.test.ts` (catalog mocked for
deterministic premium math):

- `dailyAllowance` / `remaining`: base, premium bonus, day-roll resets `used`,
  bonus added on top.
- `consume`: spends daily allowance first; **bonus only after the allowance is
  exhausted**; returns false / no-op at zero remaining.
- `grantLevelBonus`: one-time per level, seeds `lastBonusLevel` to `prevLevel` on
  first encounter (no windfall), grants across multi-level jumps, idempotent on
  re-call at the same level.
- `recordRun`: diff reports `bonusRunsGranted` on level-up and `0` otherwise.

## Out of scope

- Regenerating/energy-style replenishment.
- Per-game counters.
- Limiting challenge play (keeps its own create-limit).
