# The Wheel — skill-based power spin

Date: 2026-06-15
Status: Implemented on branch `wheel-rotate` (tests/typecheck/lint green)
Game: The Wheel (`src/game/wheel/`)

> Implementation deviation: the reduced-motion fallback is a row of discrete
> abstract power chips (no slider dependency exists, and a draggable slider would
> need `@react-native-community/slider` or hand-rolled gesture-handler work).
> Chips keep aiming influence + jitter with zero continuous animation.

## Problem

Today the wheel is pure luck. `spin()` (`logic.ts`) draws a uniform random
segment **before** the animation; the rotation in `WheelPlayScreen.handleSpin`
is cosmetic (always 6 turns, fixed ease-out) and just parks the pre-chosen
segment under the pointer. The player has **zero influence** on the outcome.

## Goal

Let the player influence where the wheel lands by regulating spin force, while
a small random drift keeps BANKRUPT a live threat (press-your-luck tension is
preserved, not removed).

## Decisions (agreed)

- **Mechanism: hold-to-charge power meter ("na czucie", no preview).**
  Hold the button → a power bar oscillates 0↔1 in a loop → release at the felt
  moment. Power deterministically picks the target segment; a ±1–2 segment
  jitter is applied on top. The bar is the input device the player learns; the
  wheel only shows the result. No on-wheel preview marker (deliberately the
  harder, "by feel" variant).
- **Fairness model:** `power → segment` is **deterministic** (same power → same
  segment, before jitter), so the skill is learnable. The jitter is the *only*
  randomizer of the outcome.
- **Wheel start position:** wheel **continues from where it last stopped** (no
  reset). This adds *visual* variety only — it does **not** randomize the
  outcome, because landing is computed to an absolute segment index regardless
  of start angle.
- **Turns:** still several decorative turns, fewer than before — `SPIN_TURNS = 3`
  (was 6). Purely cosmetic; does not affect the result.
- **Jitter profile:** start with "Balanced" — `|0|: 30% · |1|: 50% · |2|: 20%`,
  sign (left/right) 50/50. Exposed as a tunable constant to test other profiles
  later.
- **Wheel layout (`WHEEL[]`):** keep current order. With aiming + ±2 it already
  yields good risk/reward (only 200 and 350 are "safe"; jackpots 1000/800 always
  have BANKRUPT within +2). Treat the order as tunable now that it matters.

## Section 1 — logic (`logic.ts`)

Add tunable constants and a force-driven spin; remove the old uniform `spin()`.

```ts
// Tunable. Weights for |jitter| 0/1/2; sign chosen 50/50 after.
export const JITTER_WEIGHTS = { 0: 0.30, 1: 0.50, 2: 0.20 };
export const SPIN_TURNS = 3;     // base decorative full turns
export const POWER_TURNS = 3;    // extra turns at max charge -> stronger spin feels faster
export const CHARGE_MS = 800;    // one 0->1 oscillation sweep (difficulty)

// power in [0,1] maps linearly across the 12 segments (~8.3% per segment).
export function spinWithPower(power: number, rng: () => number = Math.random): SpinResult {
    const target = Math.floor(power * WHEEL.length) % WHEEL.length;
    const jitter = sampleJitter(rng);                 // in {-2,-1,0,1,2}
    const index = (target + jitter + WHEEL.length) % WHEEL.length;
    return { index, segment: WHEEL[index] };
}
```

- `sampleJitter(rng)` picks magnitude via `JITTER_WEIGHTS`, then sign 50/50.
- Delete `spin()` (`logic.ts:85`) and repoint its single caller + tests.
- Everything else (`guessConsonant`, `applyBankrupt`, scoring) unchanged — the
  index still maps to the same segment, so the game economy is untouched.

## Section 2 — interaction + animation (`WheelPlayScreen.tsx`)

**Charge (oscillation):** new shared value `power` (0..1).
- `onPressIn`: `charging = true`; start
  `power.value = withRepeat(withTiming(1, { duration: CHARGE_MS }), -1, true)`.
- `onPressOut`: read `power.value` (readable from JS), cancel the oscillation,
  compute `spinWithPower(power)`, run the landing animation.

**Landing (continues from current position — no reset):**

```ts
const segAngle   = 360 / WHEEL.length;
const landingMod = (((-segAngle * result.index) % 360) + 360) % 360;
const currentMod = ((rotation.value % 360) + 360) % 360;
const forward    = (((landingMod - currentMod) % 360) + 360) % 360;
const target = rotation.value + SPIN_TURNS * 360 + forward;
rotation.value = withTiming(
    target,
    { duration: 3200, easing: Easing.out(Easing.poly(5)) },
    (f) => { if (f) runOnJS(settleSpin)(result); },
);
```

`settleSpin` is unchanged — result flows into the existing `awaitGuess` /
BANKRUPT handling.

**Power bar (UI):** horizontal, full width, above the action button (around the
current `statusSlot`). Animated fill width from `power`, `accent` color, rounded,
`surfaceVariant` track. **Abstract — no value ticks** (ticks would be a preview;
we play by feel). Button label: "Hold to charge" → "Release!" while charging.

**Accessibility (`useReducedMotion`):** the oscillation is motion and the core
challenge. Fallback for reduce-motion: a **draggable slider** to set power
precisely + a shortened spin. Player loses the timing challenge but keeps
aiming influence + jitter — a fair a11y path.

## Section 3 — polish, constants, tests

- **Haptics:** light tick on release (`HapticPressable` exists), second tick when
  the wheel stops in `settleSpin`.
- **Tunable constants** live at the top of `logic.ts`: `JITTER_WEIGHTS`,
  `SPIN_TURNS`, `CHARGE_MS`.
- **Tests (`logic.test.ts`):**
  - `spinWithPower(0)` → segment 0; force→segment mapping is monotonic.
  - jitter with a stubbed `rng` lands on the predicted segments; index always
    wraps within 0..11.
  - jitter distribution matches `JITTER_WEIGHTS` (seeded statistical test).
  - update/replace the two existing `spin()` tests (`logic.test.ts:75-82`).

## Out of scope / to test later

- Tuning jitter profile (1 forgiving / 2 balanced / 3 swingy).
- Tuning `WHEEL[]` order, `SPIN_TURNS`, `CHARGE_MS`.
- Difficulty ramp (e.g. faster `CHARGE_MS` on later puzzles).
```
