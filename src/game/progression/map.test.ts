import { LEVEL_MAP, level, xpForLevel, unlockedRewards, levelProgress, MAX_LEVEL, isApproachingMaxLevel } from './map';
import { NEAR_MAX_LEVEL_BAND } from './constants';
import { SIGNATURES } from './signatures';

describe('LEVEL_MAP', () => {
    it('has 50 levels following the approved cumulative curve', () => {
        expect(LEVEL_MAP).toHaveLength(50);
        expect(LEVEL_MAP.map((n) => n.xp)).toEqual([
            0, 150, 400, 750, 1200, 1800, 2600, 3600, 4900, 6500, 8500, 11000, 14000, 17500, 22000, 27500, 34000, 41500,
            50500, 61000, 73000, 87000, 103000, 121500, 143000, 168000, 197000, 230500, 269000, 313000, 363000, 419000,
            482000, 552000, 630000, 717000, 814000, 922000, 1042000, 1176000, 1326000, 1494000, 1682000, 1892000,
            2127000, 2390000, 2685000, 3016000, 3387000, 3803000,
        ]);
    });

    it('pins the two earned themes to L15 and L30', () => {
        expect(LEVEL_MAP.find((n) => n.level === 15)?.rewardId).toBe('theme-champion');
        expect(LEVEL_MAP.find((n) => n.level === 30)?.rewardId).toBe('theme-legend');
    });

    it('pins the signatures to their nodes', () => {
        expect(LEVEL_MAP.find((n) => n.level === 5)?.rewardId).toBe('signature-sprout');
        expect(LEVEL_MAP.find((n) => n.level === 10)?.rewardId).toBe('signature-spark');
        expect(LEVEL_MAP.find((n) => n.level === 20)?.rewardId).toBe('signature-fire');
        expect(LEVEL_MAP.find((n) => n.level === 25)?.rewardId).toBe('signature-gem');
        expect(LEVEL_MAP.find((n) => n.level === 40)?.rewardId).toBe('signature-star');
        expect(LEVEL_MAP.find((n) => n.level === 50)?.rewardId).toBe('signature-crown');
    });

    it('binds every signature reward to a matching level node', () => {
        for (const sig of SIGNATURES) {
            const node = LEVEL_MAP.find((n) => n.level === sig.level);
            expect(node?.rewardId).toBe(sig.id);
        }
    });

    it('has no reserved levels', () => {
        for (const node of LEVEL_MAP) {
            expect(node.reserved).toBeUndefined();
        }
    });
});

describe('level', () => {
    it('starts at 1 with no XP and never drops below 1', () => {
        expect(level(0)).toBe(1);
        expect(level(-100)).toBe(1);
    });

    it('returns the highest level whose threshold is reached', () => {
        expect(level(149)).toBe(1);
        expect(level(150)).toBe(2);
        expect(level(3599)).toBe(7);
        expect(level(3600)).toBe(8);
    });

    it('caps at the final level', () => {
        expect(level(3803000)).toBe(50);
        expect(level(9_999_999)).toBe(50);
    });
});

describe('xpForLevel', () => {
    it('returns the cumulative threshold for a level', () => {
        expect(xpForLevel(1)).toBe(0);
        expect(xpForLevel(8)).toBe(3600);
        expect(xpForLevel(15)).toBe(22000);
        expect(xpForLevel(30)).toBe(313000);
        expect(xpForLevel(50)).toBe(3803000);
    });
});

describe('unlockedRewards', () => {
    it('is empty below the first reward threshold (L5)', () => {
        expect(unlockedRewards(1199)).toEqual(new Set());
    });

    it('grants the first signature at L5 and the L15 theme at its threshold', () => {
        expect(unlockedRewards(1200)).toEqual(new Set(['signature-sprout']));
        expect(unlockedRewards(22000)).toEqual(new Set(['signature-sprout', 'signature-spark', 'theme-champion']));
    });

    it('grants every reward once past the capstone — retroactively', () => {
        const all = new Set([
            'signature-sprout',
            'signature-spark',
            'theme-champion',
            'signature-fire',
            'signature-gem',
            'theme-legend',
            'mascot-mic-platinum',
            'signature-star',
            'signature-crown',
        ]);
        expect(unlockedRewards(3803000)).toEqual(all);
        expect(unlockedRewards(9_999_999)).toEqual(all);
    });
});

describe('levelProgress', () => {
    it('reports fill within the current level band', () => {
        expect(levelProgress(0)).toEqual({ level: 1, intoLevel: 0, span: 150, nextLevelXp: 150 });
    });

    it('reports a full, capped band at max level', () => {
        const p = levelProgress(3803000);
        expect(p.level).toBe(50);
        expect(p.nextLevelXp).toBeNull();
        expect(p.span).toBe(0);
    });
});

describe('MAX_LEVEL', () => {
    it('tracks the last node of the level map', () => {
        expect(MAX_LEVEL).toBe(LEVEL_MAP[LEVEL_MAP.length - 1].level);
        expect(MAX_LEVEL).toBe(50);
    });
});

describe('isApproachingMaxLevel', () => {
    it('is false below the near-max band', () => {
        expect(isApproachingMaxLevel(MAX_LEVEL - NEAR_MAX_LEVEL_BAND - 1)).toBe(false);
        expect(isApproachingMaxLevel(1)).toBe(false);
    });

    it('is true on the first level inside the band', () => {
        expect(isApproachingMaxLevel(MAX_LEVEL - NEAR_MAX_LEVEL_BAND)).toBe(true);
    });

    it('is true throughout the band up to one below the cap', () => {
        expect(isApproachingMaxLevel(MAX_LEVEL - 1)).toBe(true);
    });

    it('is false at the cap itself — reached, not approaching', () => {
        expect(isApproachingMaxLevel(MAX_LEVEL)).toBe(false);
    });
});
