import { applyRun, defaultStats, recordRun } from './recordRun';
import { RUN_XP_FLOOR, SKILL_CAP, BREADTH_BONUS, ACHIEVEMENT_XP_TIERS } from './constants';
import type { GameRunResult, ProgressionStats } from './types';
import { SafeAnalytics } from '../../utils/firebase/init';

jest.mock('../../utils/firebase/init', () => ({
    SafeAnalytics: { logEvent: jest.fn() },
}));

function stats(overrides: Partial<ProgressionStats> = {}): ProgressionStats {
    return { ...defaultStats(), today: '2026-06-10', ...overrides };
}

function result(overrides: Partial<GameRunResult> & Pick<GameRunResult, 'gameId'>): GameRunResult {
    return { score: 0, won: false, ...overrides };
}

const TODAY = '2026-06-10';

describe('applyRun — XP and stats', () => {
    it('awards floor + skill + breadth on the first run of the day and records the play', () => {
        // Rung 6 (no feat) → skill = round(100 * 6/15) = 40.
        const skill = Math.round(SKILL_CAP * (6 / 15));
        const { stats: next, diff } = applyRun(stats(), result({ gameId: 'the-ladder', rungReached: 6 }), TODAY);

        expect(diff.xpGained).toBe(RUN_XP_FLOOR + skill + BREADTH_BONUS);
        expect(next.lifetimeXp).toBe(RUN_XP_FLOOR + skill + BREADTH_BONUS);
        expect(next.runsPlayed).toBe(1);
        expect(next.datesPlayed).toEqual([TODAY]);
        expect(next.todayGameIds).toEqual(['the-ladder']);
    });

    it('drops the breadth bonus on a second run of the same game that day', () => {
        // finalBank 1000 → skill rounds to 0 but performance is non-zero, so the floor applies.
        const first = applyRun(stats(), result({ gameId: 'the-drop', finalBank: 1000 }), TODAY).stats;
        const { diff } = applyRun(first, result({ gameId: 'the-drop', finalBank: 1000 }), TODAY);
        expect(diff.xpGained).toBe(RUN_XP_FLOOR);
    });

    it('resets the day set and re-awards breadth when the date rolls over', () => {
        const yesterday = applyRun(stats(), result({ gameId: 'the-drop', finalBank: 1000 }), TODAY).stats;
        const { stats: next, diff } = applyRun(
            yesterday,
            result({ gameId: 'the-drop', finalBank: 1000 }),
            '2026-06-11',
        );
        expect(diff.xpGained).toBe(RUN_XP_FLOOR + BREADTH_BONUS);
        expect(next.todayGameIds).toEqual(['the-drop']);
        expect(next.datesPlayed).toEqual([TODAY, '2026-06-11']);
    });

    it('records wins and best single-run score per game', () => {
        const { stats: next } = applyRun(stats(), result({ gameId: 'the-drop', won: true, score: 12345 }), TODAY);
        expect(next.winsByGame).toEqual({ 'the-drop': 1 });
        expect(next.bestScoreByGame).toEqual({ 'the-drop': 12345 });
    });

    it('does not lower the best score on a weaker later run', () => {
        const strong = applyRun(stats(), result({ gameId: 'the-drop', score: 9000 }), TODAY).stats;
        const { stats: next } = applyRun(strong, result({ gameId: 'the-drop', score: 100 }), TODAY);
        expect(next.bestScoreByGame['the-drop']).toBe(9000);
    });
});

describe('applyRun — level-ups and rewards', () => {
    it('reports a level-up and the crossed level', () => {
        const { diff } = applyRun(
            stats({ lifetimeXp: 140, todayGameIds: ['the-drop'] }),
            result({ gameId: 'the-drop', finalBank: 1000 }),
            TODAY,
        );
        expect(diff.previousLevel).toBe(1);
        expect(diff.level).toBe(2); // 140 + 50 floor = 190 ≥ 150
        expect(diff.leveledUp).toBe(true);
    });

    it('reports newly-unlocked earned-theme rewards on the crossing run', () => {
        // 21950 + (floor 50) = 22000 → crosses the L15 champion theme node.
        const { diff } = applyRun(
            stats({ lifetimeXp: 21950, today: TODAY, todayGameIds: ['the-drop'] }),
            result({ gameId: 'the-drop', finalBank: 1000 }),
            TODAY,
        );
        expect(diff.newRewards).toEqual(['theme-champion']);
    });
});

describe('applyRun — achievements pay XP into the spine', () => {
    it('completes Contestant Bronze on the 10th run and adds its XP', () => {
        const nine = stats({ runsPlayed: 9, today: TODAY, todayGameIds: ['the-drop'] });
        const { stats: next, diff } = applyRun(nine, result({ gameId: 'the-drop', finalBank: 1000 }), TODAY);
        expect(diff.newAchievements).toContain('contestant-bronze');
        // floor only (already played today) + the bronze achievement XP
        expect(diff.xpGained).toBe(RUN_XP_FLOOR + ACHIEVEMENT_XP_TIERS.bronze);
        expect(next.runsPlayed).toBe(10);
    });

    it('records momentary feats and surfaces them as new achievements', () => {
        const { stats: next, diff } = applyRun(stats(), result({ gameId: 'the-ladder', rungReached: 15 }), TODAY);
        expect(next.feats).toContain('to-the-top');
        expect(diff.newAchievements).toContain('to-the-top');
    });

    it('awards Triple Threat once all three games are played in one day', () => {
        let s = applyRun(stats(), result({ gameId: 'the-ladder' }), TODAY).stats;
        s = applyRun(s, result({ gameId: 'the-drop' }), TODAY).stats;
        const { stats: next, diff } = applyRun(s, result({ gameId: 'the-wheel' }), TODAY);
        expect(next.feats).toContain('triple-threat');
        expect(diff.newAchievements).toContain('triple-threat');
    });

    it('does not re-award an already-recorded feat', () => {
        const had = stats({ feats: ['to-the-top'] });
        const { diff } = applyRun(had, result({ gameId: 'the-ladder', rungReached: 15 }), TODAY);
        expect(diff.newAchievements).not.toContain('to-the-top');
    });
});

describe('applyRun — bonus runs field', () => {
    it('reports zero bonusRunsGranted from the pure reducer (the grant is a side effect)', () => {
        const { diff } = applyRun(stats(), result({ gameId: 'the-ladder', rungReached: 6 }), TODAY);
        expect(diff.bonusRunsGranted).toBe(0);
    });
});

describe('applyRun — challenge runs', () => {
    it('increments challengesPlayed and unlocks Challenger Bronze on the first challenge', () => {
        const { stats: next, diff } = applyRun(
            stats(),
            result({ gameId: 'the-ladder', rungReached: 6, challenge: true }),
            TODAY,
        );
        expect(next.challengesPlayed).toBe(1);
        expect(diff.newAchievements).toContain('challenger-bronze');
    });

    it('leaves challengesPlayed untouched on a solo run', () => {
        const { stats: next, diff } = applyRun(
            stats(),
            result({ gameId: 'the-ladder', rungReached: 6 }),
            TODAY,
        );
        expect(next.challengesPlayed).toBe(0);
        expect(diff.newAchievements).not.toContain('challenger-bronze');
    });

    it('unlocks Challenger Silver and Gold at 10 and 30 challenges', () => {
        const silver = applyRun(
            stats({ challengesPlayed: 9 }),
            result({ gameId: 'the-ladder', rungReached: 6, challenge: true }),
            TODAY,
        );
        expect(silver.diff.newAchievements).toContain('challenger-silver');
        const gold = applyRun(
            stats({ challengesPlayed: 29 }),
            result({ gameId: 'the-ladder', rungReached: 6, challenge: true }),
            TODAY,
        );
        expect(gold.diff.newAchievements).toContain('challenger-gold');
    });

    it('seeds challengesPlayed to 0 for fresh (and legacy spread-merged) stats', () => {
        expect(defaultStats().challengesPlayed).toBe(0);
    });
});

describe('recordRun — level-up telemetry', () => {
    it('logs level_up at the recording seam, independent of any celebration UI', () => {
        (SafeAnalytics.logEvent as jest.Mock).mockClear();
        // Fresh stats + a rung-15 run: 50 floor + 100 skill + 75 breadth + feat XP
        // crosses the level-2 threshold (150), so the run levels up.
        recordRun(result({ gameId: 'the-ladder', rungReached: 15 }));
        expect(SafeAnalytics.logEvent).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'level_up' }),
        );
    });

    it('stays silent on a run that does not level up', () => {
        (SafeAnalytics.logEvent as jest.Mock).mockClear();
        // Fresh stats + a weak run (floor + small skill + breadth = 130 < 150).
        recordRun(result({ gameId: 'the-drop', finalBank: 1000 }));
        expect(SafeAnalytics.logEvent).not.toHaveBeenCalled();
    });
});
