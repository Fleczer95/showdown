import { createMMKV } from 'react-native-mmkv';
import { premiumItemsOwned, canUpsell } from '../challenge/limit';
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
