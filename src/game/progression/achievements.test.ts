import {
    ACHIEVEMENTS,
    ACHIEVEMENT_FAMILIES,
    achievementsUnlocked,
    detectFeats,
    familyProgress,
    isQuickWit,
} from './achievements';
import { ACHIEVEMENT_XP_ONE_OFF, ACHIEVEMENT_XP_TIERS } from './constants';
import type { GameRunResult, ProgressionStats } from './types';

function stats(overrides: Partial<ProgressionStats> = {}): ProgressionStats {
    return {
        lifetimeXp: 0,
        runsPlayed: 0,
        winsByGame: {},
        datesPlayed: [],
        today: '2026-06-10',
        todayGameIds: [],
        bestSingleRunScore: 0,
        feats: [],
        ...overrides,
    };
}

function result(overrides: Partial<GameRunResult> & Pick<GameRunResult, 'gameId'>): GameRunResult {
    return { score: 0, progress: 0, won: false, ...overrides };
}

describe('ACHIEVEMENTS catalog', () => {
    it('defines exactly 25 achievements with unique ids', () => {
        expect(ACHIEVEMENTS).toHaveLength(25);
        expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(25);
    });

    it('pays tier and one-off XP per the spec', () => {
        expect(ACHIEVEMENTS.find((a) => a.id === 'contestant-bronze')?.xp).toBe(ACHIEVEMENT_XP_TIERS.bronze);
        expect(ACHIEVEMENTS.find((a) => a.id === 'contestant-gold')?.xp).toBe(ACHIEVEMENT_XP_TIERS.gold);
        expect(ACHIEVEMENTS.find((a) => a.id === 'clean-sweep')?.xp).toBe(ACHIEVEMENT_XP_ONE_OFF);
    });
});

describe('achievementsUnlocked — tiered families', () => {
    it('Contestant unlocks at 10 / 50 / 200 runs', () => {
        expect(achievementsUnlocked(stats({ runsPlayed: 9 })).has('contestant-bronze')).toBe(false);
        expect(achievementsUnlocked(stats({ runsPlayed: 10 })).has('contestant-bronze')).toBe(true);
        expect(achievementsUnlocked(stats({ runsPlayed: 200 })).has('contestant-gold')).toBe(true);
        expect(achievementsUnlocked(stats({ runsPlayed: 199 })).has('contestant-gold')).toBe(false);
    });

    it('On a Roll unlocks on the longest streak (3 / 7 / 30)', () => {
        const sevenDays = Array.from({ length: 7 }, (_, i) => `2026-06-0${i + 1}`);
        const unlocked = achievementsUnlocked(stats({ datesPlayed: sevenDays }));
        expect(unlocked.has('on-a-roll-bronze')).toBe(true);
        expect(unlocked.has('on-a-roll-silver')).toBe(true);
        expect(unlocked.has('on-a-roll-gold')).toBe(false);
    });

    it('Regular unlocks on distinct days played (5 / 15 / 40)', () => {
        const fiveScattered = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'];
        expect(achievementsUnlocked(stats({ datesPlayed: fiveScattered })).has('regular-bronze')).toBe(true);
        expect(achievementsUnlocked(stats({ datesPlayed: fiveScattered })).has('on-a-roll-bronze')).toBe(false);
    });

    it('Winner unlocks on total wins across games (5 / 25 / 100)', () => {
        expect(achievementsUnlocked(stats({ winsByGame: { 'the-ladder': 5 } })).has('winner-bronze')).toBe(true);
        expect(
            achievementsUnlocked(stats({ winsByGame: { 'the-ladder': 13, 'the-drop': 12 } })).has('winner-silver'),
        ).toBe(true);
    });

    it('Big Scorer unlocks on best single-run score (5k / 20k / 50k)', () => {
        expect(achievementsUnlocked(stats({ bestSingleRunScore: 5000 })).has('big-scorer-bronze')).toBe(true);
        expect(achievementsUnlocked(stats({ bestSingleRunScore: 49999 })).has('big-scorer-gold')).toBe(false);
        expect(achievementsUnlocked(stats({ bestSingleRunScore: 50000 })).has('big-scorer-gold')).toBe(true);
    });
});

describe('achievementsUnlocked — Well-Rounded (derived from wins)', () => {
    it('needs a win in each of the 3 games', () => {
        expect(
            achievementsUnlocked(stats({ winsByGame: { 'the-ladder': 1, 'the-drop': 1 } })).has('well-rounded'),
        ).toBe(false);
        expect(
            achievementsUnlocked(stats({ winsByGame: { 'the-ladder': 1, 'the-drop': 1, 'the-wheel': 1 } })).has(
                'well-rounded',
            ),
        ).toBe(true);
    });
});

describe('achievementsUnlocked — feats come from stats.feats', () => {
    it('reflects a recorded momentary feat', () => {
        expect(achievementsUnlocked(stats({ feats: ['clean-sweep'] })).has('clean-sweep')).toBe(true);
        expect(achievementsUnlocked(stats()).has('clean-sweep')).toBe(false);
    });
});

describe('detectFeats', () => {
    it('To the Top — reach rung 15 on the Ladder', () => {
        expect(detectFeats(result({ gameId: 'the-ladder', rungReached: 15 }))).toContain('to-the-top');
        expect(detectFeats(result({ gameId: 'the-ladder', rungReached: 14 }))).not.toContain('to-the-top');
    });

    it('Spotless — win the Ladder using zero lifelines', () => {
        expect(detectFeats(result({ gameId: 'the-ladder', won: true, lifelinesUsed: 0 }))).toContain('spotless');
        expect(detectFeats(result({ gameId: 'the-ladder', won: true, lifelinesUsed: 1 }))).not.toContain('spotless');
        expect(detectFeats(result({ gameId: 'the-ladder', won: false, lifelinesUsed: 0 }))).not.toContain('spotless');
    });

    it('Survivor — survive all 9 Drop rounds', () => {
        expect(detectFeats(result({ gameId: 'the-drop', roundsSurvived: 9 }))).toContain('survivor');
        expect(detectFeats(result({ gameId: 'the-drop', roundsSurvived: 8 }))).not.toContain('survivor');
    });

    it('Iron Bank — finish the Drop keeping at least half the starting bank', () => {
        expect(detectFeats(result({ gameId: 'the-drop', finalBank: 500_000 }))).toContain('iron-bank');
        expect(detectFeats(result({ gameId: 'the-drop', finalBank: 499_999 }))).not.toContain('iron-bank');
    });

    it('Vowel-Free and Clean Sweep on the Wheel', () => {
        expect(detectFeats(result({ gameId: 'the-wheel', cleanPuzzles: 1 }))).toContain('vowel-free');
        expect(detectFeats(result({ gameId: 'the-wheel', puzzlesSolved: 3 }))).toContain('clean-sweep');
        expect(detectFeats(result({ gameId: 'the-wheel', puzzlesSolved: 2 }))).not.toContain('clean-sweep');
    });

    it('Quick Wit and Comeback from their flags', () => {
        expect(detectFeats(result({ gameId: 'the-ladder', quickWit: true }))).toContain('quick-wit');
        expect(detectFeats(result({ gameId: 'the-wheel', bankruptRecovered: true }))).toContain('comeback');
    });
});

describe('isQuickWit', () => {
    it('is true for a fast answer at or above the high rung', () => {
        expect(isQuickWit(10, 5)).toBe(true);
        expect(isQuickWit(15, 1)).toBe(true);
    });

    it('is false for a low rung or a slow answer', () => {
        expect(isQuickWit(9, 1)).toBe(false);
        expect(isQuickWit(15, 5.1)).toBe(false);
    });

    it('does not award cross-game feats', () => {
        expect(detectFeats(result({ gameId: 'the-drop', rungReached: 15 }))).not.toContain('to-the-top');
    });
});

describe('familyProgress', () => {
    const contestant = ACHIEVEMENT_FAMILIES.find((f) => f.family === 'contestant')!; // [10, 50, 200]

    it('reports zero progress at the start', () => {
        const p = familyProgress(contestant, stats({ runsPlayed: 0 }));
        expect(p).toEqual({ earnedTiers: 0, current: 0, nextTarget: 10, fraction: 0 });
    });

    it('counts earned tiers and points the bar at the next threshold', () => {
        const p = familyProgress(contestant, stats({ runsPlayed: 37 }));
        expect(p.earnedTiers).toBe(1); // bronze (10) cleared, silver (50) not
        expect(p.nextTarget).toBe(50);
        expect(p.fraction).toBeCloseTo(37 / 50);
    });

    it('counts a tier reached exactly at its threshold', () => {
        expect(familyProgress(contestant, stats({ runsPlayed: 50 })).earnedTiers).toBe(2);
    });

    it('maxes out a fully-earned family', () => {
        const p = familyProgress(contestant, stats({ runsPlayed: 999 }));
        expect(p).toEqual({ earnedTiers: 3, current: 999, nextTarget: null, fraction: 1 });
    });
});
