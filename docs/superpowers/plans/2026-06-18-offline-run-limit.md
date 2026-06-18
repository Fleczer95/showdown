# Offline Solo-Run Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap offline solo "Start" runs per local day — base + premium bonus — with level-ups banking one-time bonus runs spent only after the daily allowance is exhausted.

**Architecture:** A new focused module `src/game/offline/limit.ts` holds the state shape, a thin MMKV wrapper, and pure reducers (mirroring how `progression/recordRun.ts` splits `applyRun` from `recordRun`). It reuses `premiumItemsOwned`/`canUpsell` from `challenge/limit.ts`. `recordRun` calls the bonus grant at the single run-completion seam; `GameSetupScreen` consumes a run at the Start button only. Challenge play is untouched.

**Tech Stack:** TypeScript, React Native, `react-native-mmkv`, Jest, react-i18next-style `t()` with `%{name}` interpolation.

## Global Constraints

- Pure reducers contain all logic and are unit-tested without MMKV; impure wrappers (load/apply/save) are thin. Mirror `progression/recordRun.ts`.
- MMKV is globally mocked in `jest.setup.js` (in-memory). Catalog must be mocked in limit tests for deterministic premium math (see `challenge/limit.test.ts`).
- Do NOT duplicate premium logic — import `premiumItemsOwned` and `canUpsell` from `../challenge/limit`.
- i18n keys must be added to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/pl.json`. Interpolation syntax is `%{name}`.
- One global counter across all four games. Bonus balance never resets daily; daily `used` resets on local day-roll.
- Bonus is spent ONLY after the daily allowance is exhausted.
- No retroactive windfall: `lastBonusLevel` seeds to the player's level *before* the first recorded run.
- Tunables, named constants in `limit.ts`: `BASE_DAILY_RUNS = 5`, `BONUS_RUNS_PER_LEVEL = 3`, premium `+1` per item.

---

### Task 1: Offline run-limit module (pure reducers + MMKV wrapper)

**Files:**
- Create: `src/game/offline/limit.ts`
- Test: `src/game/offline/limit.test.ts`

**Interfaces:**
- Consumes: `premiumItemsOwned(owned: ReadonlySet<string>): number` and `canUpsell(owned: ReadonlySet<string>): boolean` from `../challenge/limit`.
- Produces:
  - `interface OfflineRunState { day: string; used: number; bonus: number; lastBonusLevel: number }`
  - `BASE_DAILY_RUNS: number`, `BONUS_RUNS_PER_LEVEL: number`
  - Pure: `dailyAllowance(owned: ReadonlySet<string>): number`
  - Pure: `effectiveUsed(state: OfflineRunState, today: string): number`
  - Pure: `remaining(state: OfflineRunState, owned: ReadonlySet<string>, today: string): number`
  - Pure: `consume(state: OfflineRunState, owned: ReadonlySet<string>, today: string): { state: OfflineRunState; ok: boolean }`
  - Pure: `grantBonus(state: OfflineRunState, prevLevel: number, newLevel: number, today: string): OfflineRunState`
  - Pure: `defaultOfflineState(today: string): OfflineRunState`
  - Impure: `canStartOfflineRun(owned: ReadonlySet<string>): boolean`
  - Impure: `remainingOfflineRuns(owned: ReadonlySet<string>): number`
  - Impure: `consumeOfflineRun(owned: ReadonlySet<string>): boolean`
  - Impure: `grantLevelBonus(prevLevel: number, newLevel: number): number` (returns runs granted this call)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/offline/limit.test.ts
// Mock the catalog so premium math is deterministic: one premium pack counts.
jest.mock('../../data/store/catalog', () => ({
    STORE_CATALOG: [
        { id: 'pack-a', kind: 'pack', tier: 'premium', status: 'live' },
        { id: 'theme-free', kind: 'theme', tier: 'free', status: 'live' },
    ],
}));

import {
    BASE_DAILY_RUNS,
    BONUS_RUNS_PER_LEVEL,
    defaultOfflineState,
    dailyAllowance,
    effectiveUsed,
    remaining,
    consume,
    grantBonus,
    type OfflineRunState,
} from './limit';

const TODAY = '2026-06-18';
const owned = (...ids: string[]) => new Set(ids);

function state(overrides: Partial<OfflineRunState> = {}): OfflineRunState {
    return { ...defaultOfflineState(TODAY), ...overrides };
}

describe('dailyAllowance', () => {
    it('is the base with no premium items', () => {
        expect(dailyAllowance(owned())).toBe(BASE_DAILY_RUNS);
    });
    it('adds one per owned premium item', () => {
        expect(dailyAllowance(owned('pack-a'))).toBe(BASE_DAILY_RUNS + 1);
    });
    it('never counts a free item', () => {
        expect(dailyAllowance(owned('theme-free'))).toBe(BASE_DAILY_RUNS);
    });
});

describe('effectiveUsed', () => {
    it('is the stored count on the same day', () => {
        expect(effectiveUsed(state({ used: 2 }), TODAY)).toBe(2);
    });
    it('rolls to zero on a new day', () => {
        expect(effectiveUsed(state({ used: 2, day: '2026-06-17' }), TODAY)).toBe(0);
    });
});

describe('remaining', () => {
    it('is the full allowance with nothing used', () => {
        expect(remaining(state(), owned(), TODAY)).toBe(BASE_DAILY_RUNS);
    });
    it('adds the banked bonus on top of the daily allowance', () => {
        expect(remaining(state({ bonus: 4 }), owned(), TODAY)).toBe(BASE_DAILY_RUNS + 4);
    });
    it('never goes below the bonus when the allowance is overspent', () => {
        expect(remaining(state({ used: 99, bonus: 2 }), owned(), TODAY)).toBe(2);
    });
});

describe('consume — daily allowance first, bonus only after', () => {
    it('spends the daily allowance before the bonus', () => {
        const r = consume(state({ used: 0, bonus: 3 }), owned(), TODAY);
        expect(r.ok).toBe(true);
        expect(r.state.used).toBe(1);
        expect(r.state.bonus).toBe(3); // untouched while allowance remains
    });
    it('spends the bonus only once the allowance is exhausted', () => {
        const full = state({ used: BASE_DAILY_RUNS, bonus: 2 });
        const r = consume(full, owned(), TODAY);
        expect(r.ok).toBe(true);
        expect(r.state.used).toBe(BASE_DAILY_RUNS); // allowance stays maxed
        expect(r.state.bonus).toBe(1);
    });
    it('rolls the day, resetting used to 1 for the first run of a new day', () => {
        const r = consume(state({ used: BASE_DAILY_RUNS, day: '2026-06-17' }), owned(), TODAY);
        expect(r.ok).toBe(true);
        expect(r.state.day).toBe(TODAY);
        expect(r.state.used).toBe(1);
    });
    it('refuses when nothing remains', () => {
        const r = consume(state({ used: BASE_DAILY_RUNS, bonus: 0 }), owned(), TODAY);
        expect(r.ok).toBe(false);
        expect(r.state).toEqual(state({ used: BASE_DAILY_RUNS, bonus: 0 }));
    });
});

describe('grantBonus — one-time per level, no windfall', () => {
    it('seeds lastBonusLevel to prevLevel on a fresh state and grants for the jump this run', () => {
        // Fresh player at level 1 → 2 this run: grant one level's worth.
        const next = grantBonus(defaultOfflineState(TODAY), 1, 2, TODAY);
        expect(next.bonus).toBe(BONUS_RUNS_PER_LEVEL);
        expect(next.lastBonusLevel).toBe(2);
    });
    it('does not pay an existing high-level player retroactively', () => {
        // First encounter at level 10 with no level-up this run: seed, no payout.
        const next = grantBonus(defaultOfflineState(TODAY), 10, 10, TODAY);
        expect(next.bonus).toBe(0);
        expect(next.lastBonusLevel).toBe(10);
    });
    it('grants across a multi-level jump', () => {
        const next = grantBonus(state({ lastBonusLevel: 4 }), 4, 7, TODAY);
        expect(next.bonus).toBe(3 * BONUS_RUNS_PER_LEVEL);
        expect(next.lastBonusLevel).toBe(7);
    });
    it('is idempotent when no new level is reached', () => {
        const prev = state({ lastBonusLevel: 7, bonus: 5 });
        expect(grantBonus(prev, 7, 7, TODAY)).toEqual(prev);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/offline/limit.test.ts`
Expected: FAIL — cannot find module `./limit`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/game/offline/limit.ts
import { createMMKV } from 'react-native-mmkv';
import { premiumItemsOwned } from '../challenge/limit';
import { localDate } from '../progression/recordRun';

// Daily cap on offline solo runs (the "Start" button), the offline-play sibling
// of the challenge-creation limit. Honour-based and client-side: solo play is
// offline so nothing on the Firestore free tier is at stake; the cap is a
// retention/monetization lever and makes levelling tangible. One GLOBAL counter
// across all four games. The daily allowance grows by one per owned premium item
// (theme or pack), reusing the challenge limit's premium math. Reaching a new
// level banks one-time BONUS runs, spent only after the daily allowance is gone.

/** Free baseline: solo runs any device can start per local day, all games. */
export const BASE_DAILY_RUNS = 5;
/** One-time runs banked for each new level reached. */
export const BONUS_RUNS_PER_LEVEL = 3;

export { canUpsell };

export interface OfflineRunState {
    /** Local day (YYYY-MM-DD) the `used` count belongs to. */
    day: string;
    /** Runs consumed from the daily allowance on `day`. */
    used: number;
    /** Banked level-up runs — never reset by the day-roll. */
    bonus: number;
    /** Highest level already paid out, so grants stay one-time (-1 until seeded). */
    lastBonusLevel: number;
}

/** Fresh state seeded to today; lastBonusLevel is re-seeded on first grant. */
export function defaultOfflineState(today: string): OfflineRunState {
    return { day: today, used: 0, bonus: 0, lastBonusLevel: -1 };
}

/** The device's daily solo-run allowance (global, all games). */
export function dailyAllowance(owned: ReadonlySet<string>): number {
    return BASE_DAILY_RUNS + premiumItemsOwned(owned);
}

/** `used`, treating a stale day as zero (the day-roll, without mutating state). */
export function effectiveUsed(state: OfflineRunState, today: string): number {
    return state.day === today ? state.used : 0;
}

/** Runs still available today: leftover daily allowance plus the banked bonus. */
export function remaining(state: OfflineRunState, owned: ReadonlySet<string>, today: string): number {
    const dailyLeft = Math.max(0, dailyAllowance(owned) - effectiveUsed(state, today));
    return dailyLeft + state.bonus;
}

/**
 * Spend one run. Daily allowance first; the bonus is touched only once the
 * allowance is exhausted. Returns the updated state and whether a run was spent.
 */
export function consume(
    state: OfflineRunState,
    owned: ReadonlySet<string>,
    today: string,
): { state: OfflineRunState; ok: boolean } {
    const used = effectiveUsed(state, today);
    if (used < dailyAllowance(owned)) {
        return { state: { ...state, day: today, used: used + 1 }, ok: true };
    }
    if (state.bonus > 0) {
        return { state: { ...state, day: today, used, bonus: state.bonus - 1 }, ok: true };
    }
    return { state, ok: false };
}

/**
 * Bank bonus runs for any levels gained. On first encounter (lastBonusLevel < 0)
 * seed it to `prevLevel` so an existing high-level player gets no windfall — only
 * levels gained after this point pay out.
 */
export function grantBonus(
    state: OfflineRunState,
    prevLevel: number,
    newLevel: number,
    today: string,
): OfflineRunState {
    const baseline = state.lastBonusLevel < 0 ? prevLevel : state.lastBonusLevel;
    if (newLevel <= baseline) {
        return { ...state, lastBonusLevel: baseline };
    }
    return {
        ...state,
        day: state.day || today,
        bonus: state.bonus + (newLevel - baseline) * BONUS_RUNS_PER_LEVEL,
        lastBonusLevel: newLevel,
    };
}

// --- Persistence -----------------------------------------------------------

const store = createMMKV({ id: 'showdown-offline-runs' });
const STATE_KEY = 'state';

function loadState(): OfflineRunState {
    const json = store.getString(STATE_KEY);
    if (!json) return defaultOfflineState(localDate());
    try {
        return { ...defaultOfflineState(localDate()), ...(JSON.parse(json) as Partial<OfflineRunState>) };
    } catch {
        return defaultOfflineState(localDate());
    }
}

function saveState(state: OfflineRunState): void {
    store.set(STATE_KEY, JSON.stringify(state));
}

/** Whether the device can start another offline solo run right now. */
export function canStartOfflineRun(owned: ReadonlySet<string>): boolean {
    return remaining(loadState(), owned, localDate()) > 0;
}

/** Runs still available today (daily leftover + banked bonus). */
export function remainingOfflineRuns(owned: ReadonlySet<string>): number {
    return remaining(loadState(), owned, localDate());
}

/** Spend one run, persisting. Returns false (no-op) when nothing remains. */
export function consumeOfflineRun(owned: ReadonlySet<string>): boolean {
    const { state, ok } = consume(loadState(), owned, localDate());
    if (ok) saveState(state);
    return ok;
}

/** Bank bonus runs for a level-up, persisting. Returns runs granted this call. */
export function grantLevelBonus(prevLevel: number, newLevel: number): number {
    const before = loadState();
    const after = grantBonus(before, prevLevel, newLevel, localDate());
    saveState(after);
    return after.bonus - before.bonus;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/offline/limit.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 5: Commit**

```bash
git add src/game/offline/limit.ts src/game/offline/limit.test.ts
git commit -m "feat(offline): daily solo-run limit with banked level-up bonus runs"
```

---

### Task 2: Grant bonus runs at the recordRun seam

**Files:**
- Modify: `src/game/progression/types.ts` (add `bonusRunsGranted` to `RecordRunDiff`)
- Modify: `src/game/progression/recordRun.ts` (call `grantLevelBonus` in the impure `recordRun`)
- Test: `src/game/progression/recordRun.test.ts` (add a case)

**Interfaces:**
- Consumes: `grantLevelBonus(prevLevel: number, newLevel: number): number` from `../offline/limit`.
- Produces: `RecordRunDiff.bonusRunsGranted: number`.

Note: the pure `applyRun` already returns `previousLevel`/`level` in its diff and sets `bonusRunsGranted: 0`. Only the impure `recordRun` calls `grantLevelBonus` (the side effect) and overwrites `bonusRunsGranted` with the real total — keeping `applyRun` pure and its existing tests valid.

- [ ] **Step 1: Write the failing test**

Add to `src/game/progression/recordRun.test.ts` (keep existing imports; `applyRun` is already imported there):

```ts
describe('applyRun — bonus runs field', () => {
    it('reports zero bonusRunsGranted from the pure reducer (the grant is a side effect)', () => {
        const { diff } = applyRun(stats(), result({ gameId: 'the-ladder', rungReached: 6 }), TODAY);
        expect(diff.bonusRunsGranted).toBe(0);
    });
});
```

This asserts the pure reducer always reports `0`. The grant math itself is fully
covered by `grantBonus` in `src/game/offline/limit.test.ts`; the impure
`recordRun` wiring (one extra line calling `grantLevelBonus`) is verified by
`tsc` and exercised at runtime, deliberately not under a shared-MMKV-singleton
unit test that would couple test ordering.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/progression/recordRun.test.ts`
Expected: FAIL — `diff.bonusRunsGranted` is `undefined` (property not yet on the type/diff).

- [ ] **Step 3: Add the field to the type**

In `src/game/progression/types.ts`, inside `RecordRunDiff`, after `newAchievements`:

```ts
    /** Achievement ids newly completed by this run. */
    newAchievements: string[];
    /** Offline solo-run bonus banked by this run's level-up(s) (0 if none). */
    bonusRunsGranted: number;
```

- [ ] **Step 4: Set it in applyRun and grant in recordRun**

In `src/game/progression/recordRun.ts`:

Add the import near the top (after the existing progression imports):

```ts
import { grantLevelBonus } from '../offline/limit';
```

In `applyRun`, in the returned `diff` object, add the field (pure reducer always reports 0 — the grant is a side effect):

```ts
    const diff: RecordRunDiff = {
        xpGained: stats.lifetimeXp - beforeXp,
        lifetimeXp: stats.lifetimeXp,
        leveledUp: finalLevel > previousLevel,
        previousLevel,
        level: finalLevel,
        newRewards,
        newAchievements,
        bonusRunsGranted: 0,
    };
```

Replace the impure `recordRun` body so it performs the grant and reports the real total:

```ts
/** Impure entry point: record a finished run and persist. Returns the diff. */
export function recordRun(result: GameRunResult): RecordRunDiff {
    const { stats, diff } = applyRun(loadStats(), result, localDate());
    store.set(STATS_KEY, JSON.stringify(stats));
    // Bank offline-run bonus for any levels this run crossed. The grant is the
    // single source of truth for the count (idempotent on lastBonusLevel), so any
    // run — solo or challenge — that levels up earns banked solo runs.
    const bonusRunsGranted = diff.leveledUp ? grantLevelBonus(diff.previousLevel, diff.level) : 0;
    return { ...diff, bonusRunsGranted };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/game/progression/recordRun.test.ts src/game/offline/limit.test.ts`
Expected: PASS (existing applyRun tests still green; new cases green).

- [ ] **Step 6: Commit**

```bash
git add src/game/progression/types.ts src/game/progression/recordRun.ts src/game/progression/recordRun.test.ts
git commit -m "feat(progression): bank offline bonus runs on level-up via recordRun"
```

---

### Task 3: Gate the Start button, show remaining, add the limit sheet

**Files:**
- Modify: `src/screens/GameSetupScreen.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/pl.json`

**Interfaces:**
- Consumes: `canStartOfflineRun`, `remainingOfflineRuns`, `consumeOfflineRun`, `canUpsell` from `../game/offline/limit`.
- Produces: no new exports (screen-local behavior).

This task has no unit test (it's screen wiring around already-tested logic); it is verified by the type-check/lint plus the existing limit unit tests. Keep edits surgical and mirror the existing challenge `limitSheet`.

- [ ] **Step 1: Add i18n keys (en)**

In `src/i18n/locales/en.json`, add a top-level `"offline"` block (place it right after the closing brace of the `"challenge"` block):

```json
    "offline": {
        "startWithCount": "Start Game · %{count} left",
        "limit": {
            "title": "Out of runs for today",
            "body": "Daily solo runs are limited. They reset at midnight — and every level you reach banks extra runs.",
            "cta": "Unlock a pack or theme — each adds +1 a day",
            "dismiss": "Got it"
        }
    },
```

- [ ] **Step 2: Add i18n keys (pl)**

In `src/i18n/locales/pl.json`, add the matching block after the `"challenge"` block (translate consistently with existing PL copy):

```json
    "offline": {
        "startWithCount": "Zagraj · %{count} pozostało",
        "limit": {
            "title": "Limit gier na dziś wyczerpany",
            "body": "Liczba dziennych gier solo jest ograniczona. Odnawia się o północy — a każdy zdobyty poziom dorzuca dodatkowe gry.",
            "cta": "Odblokuj pakiet lub motyw — każdy dodaje +1 dziennie",
            "dismiss": "Rozumiem"
        }
    },
```

- [ ] **Step 3: Add imports and state in GameSetupScreen**

In `src/screens/GameSetupScreen.tsx`, add the import (next to the existing `dailyCap, canUpsell` import from challenge/limit — keep `canUpsell` coming from challenge/limit; the offline module re-exports it, but to avoid a duplicate identifier import the offline functions under distinct names):

```ts
import { canStartOfflineRun, remainingOfflineRuns, consumeOfflineRun } from '../game/offline/limit';
```

After the existing `createdToday` state declaration, add offline-runs state:

```ts
    const [offlineLimitSheet, setOfflineLimitSheet] = useState(false);
    const [runsLeft, setRunsLeft] = useState(() => remainingOfflineRuns(ownedIds));
```

In the existing `useFocusEffect` callback, refresh `runsLeft` alongside the others:

```ts
    useFocusEffect(
        useCallback(() => {
            setCreatedToday(countCreatedToday());
            setCoverage(poolCoverage(gameId, ownedIds));
            setRunsLeft(remainingOfflineRuns(ownedIds));
        }, [gameId, ownedIds]),
    );
```

- [ ] **Step 4: Add the start handler**

Add this handler near `onCreateChallenge` (it gates, consumes, then starts):

```ts
    // Solo play is daily-capped (offline limit). At zero, open the limit/upsell
    // sheet instead of starting; otherwise spend one run and begin the session.
    const onStart = () => {
        if (!canStartOfflineRun(ownedIds)) {
            SafeAnalytics.logEvent({ name: 'offline_limit_hit', params: { game: game.id } });
            setOfflineLimitSheet(true);
            return;
        }
        consumeOfflineRun(ownedIds);
        setRunsLeft(remainingOfflineRuns(ownedIds));
        send({ type: 'START' });
    };
```

- [ ] **Step 5: Wire the Start button to the handler + label + dim**

Replace the Start `Button` (the one with `onPress={() => send({ type: 'START' })}`) so it uses `onStart`, shows the remaining count, and dims at zero:

```tsx
                    <Button
                        fullWidth
                        size='lg'
                        onPress={onStart}
                        style={{
                            backgroundColor: accent,
                            borderColor: accent,
                            opacity: runsLeft <= 0 ? 0.55 : 1,
                        }}
                        textColor={onAccent}
                        icon={<Play size={20} color={onAccent} fill={onAccent} />}
                    >
                        {runsLeft <= 0 ? t('common.start') : t('offline.startWithCount', { count: runsLeft })}
                    </Button>
```

- [ ] **Step 6: Add the offline-limit BottomSheet**

After the existing challenge `limitSheet` `BottomSheet` (the one titled `t('challenge.limit.title')`), add a sibling sheet. Reuse `canUpsell` already imported from `../game/challenge/limit`:

```tsx
            <BottomSheet
                visible={offlineLimitSheet}
                onClose={() => setOfflineLimitSheet(false)}
                title={t('offline.limit.title')}
            >
                <Stack gap='md' align='stretch'>
                    <Text variant='body' color='textSecondary' align='center' style={styles.limitBody}>
                        {t('offline.limit.body')}
                    </Text>
                    {canUpsell(ownedIds) && (
                        <Button
                            variant='primary'
                            fullWidth
                            onPress={() => {
                                setOfflineLimitSheet(false);
                                navigation.navigate('Store');
                            }}
                        >
                            {t('offline.limit.cta')}
                        </Button>
                    )}
                    <Button
                        variant={canUpsell(ownedIds) ? 'ghost' : 'primary'}
                        fullWidth
                        onPress={() => setOfflineLimitSheet(false)}
                    >
                        {t('offline.limit.dismiss')}
                    </Button>
                </Stack>
            </BottomSheet>
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/screens/GameSetupScreen.tsx src/game/offline/limit.ts`
Expected: no errors.

- [ ] **Step 8: Run the full limit + progression suites**

Run: `npx jest src/game/offline src/game/progression`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/screens/GameSetupScreen.tsx src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(offline): gate solo Start on the daily run limit with upsell sheet"
```

---

### Task 4: Surface the +N runs reward in the celebration

**Files:**
- Modify: `src/components/molecules/RunCelebration.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/pl.json`

**Interfaces:**
- Consumes: `RecordRunDiff.bonusRunsGranted` (from Task 2).
- Produces: no new exports.

- [ ] **Step 1: Add i18n key (en)**

In `src/i18n/locales/en.json`, inside the existing `"progression"` block, after `"levelUp"`:

```json
        "levelUp": "Level %{n}!",
        "bonusRuns": "+%{n} bonus runs",
```

- [ ] **Step 2: Add i18n key (pl)**

In `src/i18n/locales/pl.json`, inside the `"progression"` block, after its `"levelUp"` entry:

```json
        "bonusRuns": "+%{n} dodatkowych gier",
```

- [ ] **Step 3: Render the bonus-runs line**

In `src/components/molecules/RunCelebration.tsx`, directly after the `diff.leveledUp` block (the one rendering `progression.levelUp` with the `ArrowUpCircle` icon), add:

```tsx
                {diff.bonusRunsGranted > 0 ? (
                    <Stack direction='horizontal' gap='xs' align='center'>
                        <Icon name={Sparkles} size={16} color={accent} />
                        <Text variant='caption' weight='bold' color={accent}>
                            {t('progression.bonusRuns', { n: diff.bonusRunsGranted })}
                        </Text>
                    </Stack>
                ) : null}
```

`Sparkles` is already imported in this file; no new import needed.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/molecules/RunCelebration.tsx src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(progression): show +N bonus runs on level-up in the run celebration"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npx jest`
Expected: PASS (no regressions).

- [ ] **Type-check and lint the whole change**

Run: `npx tsc --noEmit && npx eslint src/game/offline src/screens/GameSetupScreen.tsx src/components/molecules/RunCelebration.tsx src/game/progression/recordRun.ts`
Expected: no errors.

## Notes for the implementer

- **Why the grant lives in `recordRun`, not the screen:** every finished run — solo *or* challenge — flows through `recordRun`. Banking the bonus there means levelling up in any mode rewards solo runs, and `lastBonusLevel` keeps grants one-time even if `recordRun` is somehow called twice.
- **Why `consume` only at the Start button:** challenge play reuses the same play screens but never presses Start, so it must never spend a solo run. It keeps its own create-limit (`challenge/limit.ts`).
- **No retroactive windfall:** `defaultOfflineState` sets `lastBonusLevel: -1`; the first `grantBonus` seeds it to that run's `prevLevel`. An existing level-20 player therefore banks nothing on contact — only levels gained afterward pay out.
- **Tuning:** `BASE_DAILY_RUNS` and `BONUS_RUNS_PER_LEVEL` are the two dials. Solo play is the core loop, so start generous and tighten with data.
