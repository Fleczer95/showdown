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
