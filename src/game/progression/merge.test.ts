import { mergeStats, preservesProgress } from './merge';
import { defaultStats } from './recordRun';
import type { ProgressionStats } from './types';

const stats = (over: Partial<ProgressionStats>): ProgressionStats => ({ ...defaultStats(), ...over });

describe('mergeStats', () => {
    it('takes the higher lifetimeXp', () => {
        expect(mergeStats(stats({ lifetimeXp: 500 }), stats({ lifetimeXp: 1200 })).lifetimeXp).toBe(1200);
    });

    it('maxes lifetimeXp rather than summing, so a re-merge is idempotent', () => {
        const a = stats({ lifetimeXp: 500 });
        expect(mergeStats(mergeStats(a, a), a).lifetimeXp).toBe(500);
    });

    it('unions the date set without duplicates and keeps it sorted', () => {
        const a = stats({ datesPlayed: ['2026-08-01', '2026-08-03'] });
        const b = stats({ datesPlayed: ['2026-08-02', '2026-08-03'] });
        expect(mergeStats(a, b).datesPlayed).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    });

    it('unions feats', () => {
        const a = stats({ feats: ['spotless'] });
        const b = stats({ feats: ['survivor', 'spotless'] });
        expect(mergeStats(a, b).feats.sort()).toEqual(['spotless', 'survivor']);
    });

    it('maxes per-game bests key by key, keeping keys only one side has', () => {
        const a = stats({ bestScoreByGame: { 'the-ladder': 8000, 'the-drop': 100 } });
        const b = stats({ bestScoreByGame: { 'the-ladder': 5000, 'the-wheel': 900 } });
        expect(mergeStats(a, b).bestScoreByGame).toEqual({
            'the-ladder': 8000,
            'the-drop': 100,
            'the-wheel': 900,
        });
    });

    it('maxes wins per game rather than summing', () => {
        const a = stats({ winsByGame: { 'the-ladder': 3 } });
        const b = stats({ winsByGame: { 'the-ladder': 2, 'the-drop': 1 } });
        expect(mergeStats(a, b).winsByGame).toEqual({ 'the-ladder': 3, 'the-drop': 1 });
    });

    it('maxes the run and challenge counters', () => {
        const a = stats({ runsPlayed: 10, challengesPlayed: 2 });
        const b = stats({ runsPlayed: 4, challengesPlayed: 1 });
        const merged = mergeStats(a, b);
        expect(merged.runsPlayed).toBe(10);
        expect(merged.challengesPlayed).toBe(2);
    });

    // The restore path merges local state with a cloud slot holding the SAME
    // history. Summing any counter here doubles it on every launch (10 → 20 → 40),
    // which silently corrupts levels and achievements. Idempotence is the guard.
    it('is idempotent — repeated restores of the same history change nothing', () => {
        const start = stats({
            lifetimeXp: 3600,
            runsPlayed: 10,
            winsByGame: { 'the-ladder': 4 },
            challengesPlayed: 2,
            bestScoreByGame: { 'the-ladder': 8000 },
            datesPlayed: ['2026-08-01', '2026-08-02'],
            feats: ['spotless'],
        });

        let local = start;
        for (let launch = 0; launch < 5; launch++) local = mergeStats(local, { ...local });

        expect(local).toEqual(start);
    });

    it("keeps the later day and only that day's gameIds", () => {
        const a = stats({ today: '2026-08-04', todayGameIds: ['the-ladder'] });
        const b = stats({ today: '2026-08-05', todayGameIds: ['the-drop'] });
        expect(mergeStats(a, b).today).toBe('2026-08-05');
        expect(mergeStats(a, b).todayGameIds).toEqual(['the-drop']);
    });

    it('unions todayGameIds when both sides are on the same day', () => {
        const a = stats({ today: '2026-08-05', todayGameIds: ['the-ladder'] });
        const b = stats({ today: '2026-08-05', todayGameIds: ['the-drop'] });
        expect(mergeStats(a, b).todayGameIds.sort()).toEqual(['the-drop', 'the-ladder']);
    });

    it('never returns a state worse than either input', () => {
        const a = stats({ lifetimeXp: 900, runsPlayed: 5, feats: ['spotless'], datesPlayed: ['2026-08-01'] });
        const b = stats({ lifetimeXp: 400, runsPlayed: 9, feats: ['survivor'], datesPlayed: ['2026-08-02'] });
        const merged = mergeStats(a, b);
        expect(preservesProgress(a, merged)).toBe(true);
        expect(preservesProgress(b, merged)).toBe(true);
    });

    it('is commutative on every field', () => {
        const a = stats({
            lifetimeXp: 900,
            runsPlayed: 5,
            winsByGame: { 'the-ladder': 2 },
            datesPlayed: ['2026-08-01'],
            today: '2026-08-05',
            todayGameIds: ['the-ladder'],
            bestScoreByGame: { 'the-ladder': 8000 },
            feats: ['spotless'],
        });
        const b = stats({
            lifetimeXp: 400,
            runsPlayed: 3,
            winsByGame: { 'the-drop': 1 },
            datesPlayed: ['2026-08-02'],
            today: '2026-08-05',
            todayGameIds: ['the-drop'],
            bestScoreByGame: { 'the-wheel': 900 },
            feats: ['survivor'],
        });
        expect(mergeStats(a, b)).toEqual(mergeStats(b, a));
    });
});

describe('preservesProgress — the guard at the destructive write', () => {
    const base = stats({
        lifetimeXp: 3600,
        runsPlayed: 10,
        challengesPlayed: 2,
        winsByGame: { 'the-ladder': 4 },
        bestScoreByGame: { 'the-ladder': 8000 },
        datesPlayed: ['2026-08-01', '2026-08-02'],
        feats: ['spotless'],
    });

    it('accepts an identical state', () => {
        expect(preservesProgress(base, { ...base })).toBe(true);
    });

    it('accepts a strictly better state', () => {
        expect(
            preservesProgress(base, {
                ...base,
                lifetimeXp: 5000,
                runsPlayed: 12,
                feats: ['spotless', 'survivor'],
                datesPlayed: ['2026-08-01', '2026-08-02', '2026-08-03'],
            }),
        ).toBe(true);
    });

    it.each([
        ['lower lifetimeXp', { lifetimeXp: 3599 }],
        ['lower runsPlayed', { runsPlayed: 9 }],
        ['lower challengesPlayed', { challengesPlayed: 1 }],
        ['a lost win', { winsByGame: { 'the-ladder': 3 } }],
        ['a dropped game key', { winsByGame: {} }],
        ['a lowered best score', { bestScoreByGame: { 'the-ladder': 7999 } }],
        ['a lost date', { datesPlayed: ['2026-08-01'] }],
        ['a lost feat', { feats: [] }],
    ])('rejects %s', (_label, worse) => {
        expect(preservesProgress(base, { ...base, ...worse })).toBe(false);
    });

    // The day-roll legitimately clears these, so they are deliberately not guarded:
    // yesterday's game set must not suppress today's breadth bonus.
    it('ignores today and todayGameIds', () => {
        const rolled = { ...base, today: '2026-08-03', todayGameIds: [] };
        expect(preservesProgress({ ...base, today: '2026-08-02', todayGameIds: ['the-ladder'] }, rolled)).toBe(true);
    });
});

describe('event wins', () => {
    it('event wins union across devices without double counting', () => {
        const a = { ...stats({}), eventWinIds: { 'halloween-2026': ['c1', 'c2'] } };
        const b = { ...stats({}), eventWinIds: { 'halloween-2026': ['c2', 'c3'] } };
        const merged = mergeStats(a, b);
        expect(merged.eventWinIds?.['halloween-2026']).toEqual(['c1', 'c2', 'c3']);
        expect(preservesProgress(a, merged)).toBe(true);
        expect(preservesProgress(b, merged)).toBe(true);
    });

    it('merging is idempotent for event wins', () => {
        const a = { ...stats({}), eventWinIds: { 'halloween-2026': ['c1', 'c2'] } };
        const b = { ...stats({}), eventWinIds: { 'halloween-2026': ['c2', 'c3'] } };
        const once = mergeStats(a, b);
        expect(mergeStats(once, b)).toEqual(once);
        expect(mergeStats(once, a)).toEqual(once);
    });

    it('event wins merge commutatively even for an edition only one side knows', () => {
        const a = { ...stats({}), eventWinIds: { 'halloween-2026': ['c3', 'c1'] } };
        const b = stats({});
        expect(mergeStats(a, b).eventWinIds).toEqual(mergeStats(b, a).eventWinIds);
        expect(mergeStats(a, b).eventWinIds?.['halloween-2026']).toEqual(['c1', 'c3']);
    });

    it('dropping an event win fails the progress tripwire', () => {
        const prev = { ...stats({}), eventWinIds: { 'halloween-2026': ['c1', 'c2'] } };
        const next = { ...stats({}), eventWinIds: { 'halloween-2026': ['c1'] } };
        expect(preservesProgress(prev, next)).toBe(false);
    });

    it('an old save with no event wins merges cleanly', () => {
        const old = stats({});
        const withWins = { ...stats({}), eventWinIds: { 'halloween-2026': ['c1'] } };
        expect(mergeStats(old, withWins).eventWinIds?.['halloween-2026']).toEqual(['c1']);
    });
});
