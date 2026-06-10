import { performanceFraction, skillXp, runXp } from './xp';
import { RUN_XP_FLOOR, SKILL_CAP, BREADTH_BONUS } from './constants';
import type { GameRunResult } from './types';

function result(overrides: Partial<GameRunResult> & Pick<GameRunResult, 'gameId'>): GameRunResult {
    return { score: 0, won: false, ...overrides };
}

describe('performanceFraction', () => {
    it('normalizes the Ladder on rungReached / 15', () => {
        expect(performanceFraction(result({ gameId: 'the-ladder', rungReached: 0 }))).toBe(0);
        expect(performanceFraction(result({ gameId: 'the-ladder', rungReached: 15 }))).toBe(1);
        expect(performanceFraction(result({ gameId: 'the-ladder', rungReached: 6 }))).toBeCloseTo(0.4);
    });

    it('normalizes the Drop on finalBank / 1,000,000', () => {
        expect(performanceFraction(result({ gameId: 'the-drop', finalBank: 0 }))).toBe(0);
        expect(performanceFraction(result({ gameId: 'the-drop', finalBank: 1_000_000 }))).toBe(1);
        expect(performanceFraction(result({ gameId: 'the-drop', finalBank: 250_000 }))).toBeCloseTo(0.25);
    });

    it('normalizes the Wheel on puzzlesSolved / 3', () => {
        expect(performanceFraction(result({ gameId: 'the-wheel', puzzlesSolved: 0 }))).toBe(0);
        expect(performanceFraction(result({ gameId: 'the-wheel', puzzlesSolved: 3 }))).toBe(1);
    });

    it('clamps to 0..1 and treats missing facts as 0', () => {
        expect(performanceFraction(result({ gameId: 'the-ladder' }))).toBe(0);
        expect(performanceFraction(result({ gameId: 'the-drop', finalBank: 2_000_000 }))).toBe(1);
        expect(performanceFraction(result({ gameId: 'unknown-game', score: 999 }))).toBe(0);
    });
});

describe('skillXp', () => {
    it('is 0..SKILL_CAP, rounded', () => {
        expect(skillXp(result({ gameId: 'the-ladder', rungReached: 15 }))).toBe(SKILL_CAP);
        expect(skillXp(result({ gameId: 'the-ladder', rungReached: 0 }))).toBe(0);
        expect(skillXp(result({ gameId: 'the-wheel', puzzlesSolved: 1 }))).toBe(Math.round(SKILL_CAP / 3));
    });
});

describe('runXp', () => {
    it('is floor + skill + breadth on the first play of a game today', () => {
        const xp = runXp(result({ gameId: 'the-ladder', rungReached: 15 }), false);
        expect(xp).toBe(RUN_XP_FLOOR + SKILL_CAP + BREADTH_BONUS);
    });

    it('drops the breadth term when the game was already played today', () => {
        const xp = runXp(result({ gameId: 'the-ladder', rungReached: 15 }), true);
        expect(xp).toBe(RUN_XP_FLOOR + SKILL_CAP);
    });

    it('pays no XP for a zero-performance run', () => {
        expect(runXp(result({ gameId: 'the-drop', finalBank: 0 }), false)).toBe(0);
        expect(runXp(result({ gameId: 'the-wheel', puzzlesSolved: 0 }), false)).toBe(0);
    });

    it('pays the floor for a low- but non-zero-performance run', () => {
        // Tiny bank: skill rounds to 0 but the floor still applies because the run
        // put something on the board.
        expect(runXp(result({ gameId: 'the-drop', finalBank: 1000 }), true)).toBe(RUN_XP_FLOOR);
    });
});
