import {
    speedBonus,
    ladderScore,
    dropScore,
    wheelScore,
    SPEED_WINDOW_SECONDS,
    LADDER_LIFELINE_BONUS,
    WHEEL_NO_VOWEL_BONUS,
    DROP_ROUND_SURVIVAL_POINTS,
} from './scoring';
import { BUNDLE, TOTAL_ROUNDS } from './drop/logic';

describe('speedBonus', () => {
    it('awards the full base value for an instant answer', () => {
        expect(speedBonus(1000, 0)).toBe(1000);
    });

    it('awards half the base value at the midpoint of the window', () => {
        expect(speedBonus(1000, SPEED_WINDOW_SECONDS / 2)).toBe(500);
    });

    it('awards nothing at the edge of the window', () => {
        expect(speedBonus(1000, SPEED_WINDOW_SECONDS)).toBe(0);
    });

    it('awards nothing past the window (no negative bonus)', () => {
        expect(speedBonus(1000, SPEED_WINDOW_SECONDS + 50)).toBe(0);
    });

    it('rounds to the nearest whole point', () => {
        // 101 * 0.5 = 50.5 → 51
        expect(speedBonus(101, 50)).toBe(51);
    });

    it('never exceeds the base value, even for negative elapsed time', () => {
        expect(speedBonus(1000, -50)).toBe(1000);
    });

    it('scales with the base value so fast late answers are worth more', () => {
        expect(speedBonus(1500, 20)).toBeGreaterThan(speedBonus(100, 20));
    });
});

describe('ladderScore', () => {
    it('adds the full lifeline bonus when no lifelines were used', () => {
        expect(ladderScore({ base: 300, speed: 50, usedLifelines: 0 })).toEqual({
            base: 300,
            speed: 50,
            bonus: 3 * LADDER_LIFELINE_BONUS,
            total: 300 + 50 + 3 * LADDER_LIFELINE_BONUS,
        });
    });

    it('gives partial credit for fewer used lifelines', () => {
        expect(ladderScore({ base: 100, speed: 0, usedLifelines: 1 }).bonus).toBe(2 * LADDER_LIFELINE_BONUS);
    });

    it('gives no lifeline bonus when all three were used', () => {
        expect(ladderScore({ base: 100, speed: 0, usedLifelines: 3 }).bonus).toBe(0);
    });

    it('scores a run that answered nothing correctly at zero — no phantom lifeline bonus', () => {
        // A first-question miss: no base, no speed, no lifelines spent. The unused
        // lifelines must not bank a bonus, or a failed run lands 1500 on the board.
        expect(ladderScore({ base: 0, speed: 0, usedLifelines: 0 })).toEqual({
            base: 0,
            speed: 0,
            bonus: 0,
            total: 0,
        });
    });
});

describe('dropScore', () => {
    it('sums money kept, banked timing, and a flat reward per round survived', () => {
        expect(dropScore({ bank: 1_000_000, roundsSurvived: 9, speed: 4_500 })).toEqual({
            base: 1_000_000,
            speed: 4_500,
            bonus: 9 * DROP_ROUND_SURVIVAL_POINTS,
            total: 1_000_000 + 4_500 + 9 * DROP_ROUND_SURVIVAL_POINTS,
        });
    });

    it('still rewards a busted run for the rounds it survived (and their timing)', () => {
        // Busted, so no money kept — but four rounds survived still score.
        expect(dropScore({ bank: 0, roundsSurvived: 4, speed: 1_200 })).toEqual({
            base: 0,
            speed: 1_200,
            bonus: 4 * DROP_ROUND_SURVIVAL_POINTS,
            total: 1_200 + 4 * DROP_ROUND_SURVIVAL_POINTS,
        });
    });

    it('scores a first-round bust at zero — nothing survived', () => {
        expect(dropScore({ bank: 0, roundsSurvived: 0, speed: 0 }).total).toBe(0);
    });

    it('keeps any survivor above any loser — even a final-round bust at full speed', () => {
        // Worst survivor: minimum possible bank, slowest possible (no timing).
        const lowestSurvivor = dropScore({ bank: BUNDLE, roundsSurvived: TOTAL_ROUNDS, speed: 0 });
        // Best loser: busts on the final round having survived every prior round
        // at maximum timing (each round's bonus capped at the per-round award).
        const lostRounds = TOTAL_ROUNDS - 1;
        const bestLoser = dropScore({
            bank: 0,
            roundsSurvived: lostRounds,
            speed: lostRounds * DROP_ROUND_SURVIVAL_POINTS,
        });
        expect(bestLoser.total).toBeLessThan(lowestSurvivor.total);
    });
});

describe('wheelScore', () => {
    it('adds a no-vowel bonus per clean puzzle', () => {
        expect(wheelScore({ bankedCash: 800, speed: 30, cleanPuzzles: 2 })).toEqual({
            base: 800,
            speed: 30,
            bonus: 2 * WHEEL_NO_VOWEL_BONUS,
            total: 800 + 30 + 2 * WHEEL_NO_VOWEL_BONUS,
        });
    });

    it('has no bonus when every puzzle bought a vowel', () => {
        expect(wheelScore({ bankedCash: 500, speed: 0, cleanPuzzles: 0 }).bonus).toBe(0);
    });
});
