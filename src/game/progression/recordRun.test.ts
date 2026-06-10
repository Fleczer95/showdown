import { applyRun, defaultStats } from './recordRun';
import { RUN_XP_FLOOR, SKILL_CAP, BREADTH_BONUS, ACHIEVEMENT_XP_TIERS } from './constants';
import type { GameRunResult, ProgressionStats } from './types';

function stats(overrides: Partial<ProgressionStats> = {}): ProgressionStats {
    return { ...defaultStats(), today: '2026-06-10', ...overrides };
}

function result(overrides: Partial<GameRunResult> & Pick<GameRunResult, 'gameId'>): GameRunResult {
    return { score: 0, progress: 0, won: false, ...overrides };
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
        const first = applyRun(stats(), result({ gameId: 'the-ladder', rungReached: 0 }), TODAY).stats;
        const { diff } = applyRun(first, result({ gameId: 'the-ladder', rungReached: 0 }), TODAY);
        expect(diff.xpGained).toBe(RUN_XP_FLOOR);
    });

    it('resets the day set and re-awards breadth when the date rolls over', () => {
        const yesterday = applyRun(stats(), result({ gameId: 'the-ladder', rungReached: 0 }), TODAY).stats;
        const { stats: next, diff } = applyRun(
            yesterday,
            result({ gameId: 'the-ladder', rungReached: 0 }),
            '2026-06-11',
        );
        expect(diff.xpGained).toBe(RUN_XP_FLOOR + BREADTH_BONUS);
        expect(next.todayGameIds).toEqual(['the-ladder']);
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
        const { diff } = applyRun(stats({ lifetimeXp: 140 }), result({ gameId: 'the-drop', finalBank: 0 }), TODAY);
        expect(diff.previousLevel).toBe(1);
        expect(diff.level).toBe(2); // 140 + 50 floor = 190 ≥ 150
        expect(diff.leveledUp).toBe(true);
    });

    it('reports newly-unlocked earned-theme rewards on the crossing run', () => {
        // 3550 + (floor 50) = 3600 → crosses the L8 champion theme node.
        const { diff } = applyRun(
            stats({ lifetimeXp: 3550, today: TODAY, todayGameIds: ['the-drop'] }),
            result({ gameId: 'the-drop', finalBank: 0 }),
            TODAY,
        );
        expect(diff.newRewards).toEqual(['theme-champion']);
    });
});

describe('applyRun — achievements pay XP into the spine', () => {
    it('completes Contestant Bronze on the 10th run and adds its XP', () => {
        const nine = stats({ runsPlayed: 9, today: TODAY, todayGameIds: ['the-ladder'] });
        const { stats: next, diff } = applyRun(nine, result({ gameId: 'the-ladder', rungReached: 0 }), TODAY);
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
