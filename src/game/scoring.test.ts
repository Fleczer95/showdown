import {
    speedBonus,
    ladderScore,
    dropScore,
    wheelScore,
    SPEED_WINDOW_SECONDS,
    LADDER_LIFELINE_BONUS,
    WHEEL_NO_VOWEL_BONUS,
} from './scoring';

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
        expect(ladderScore({ base: 0, speed: 0, usedLifelines: 1 }).bonus).toBe(2 * LADDER_LIFELINE_BONUS);
    });

    it('gives no lifeline bonus when all three were used', () => {
        expect(ladderScore({ base: 100, speed: 0, usedLifelines: 3 }).bonus).toBe(0);
    });
});

describe('dropScore', () => {
    it('scales the speed bonus by the final bank and average decision time, with no clean bonus', () => {
        // 1,000,000 kept to the end, averaging 50 s/round → half the bank as speed.
        expect(dropScore({ bank: 1_000_000, avgSeconds: SPEED_WINDOW_SECONDS / 2 })).toEqual({
            base: 1_000_000,
            speed: 500_000,
            bonus: 0,
            total: 1_500_000,
        });
    });

    it('scores a busted run at zero — no speed survives a zero bank', () => {
        expect(dropScore({ bank: 0, avgSeconds: 1 })).toEqual({
            base: 0,
            speed: 0,
            bonus: 0,
            total: 0,
        });
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
