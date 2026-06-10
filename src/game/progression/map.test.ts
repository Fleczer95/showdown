import { LEVEL_MAP, level, xpForLevel, unlockedRewards, levelProgress } from './map';

describe('LEVEL_MAP', () => {
    it('has 15 levels following the approved cumulative curve', () => {
        expect(LEVEL_MAP).toHaveLength(15);
        expect(LEVEL_MAP.map((n) => n.xp)).toEqual([
            0, 150, 400, 750, 1200, 1800, 2600, 3600, 4900, 6500, 8500, 11000, 14000, 17500, 22000,
        ]);
    });

    it('pins the two v1 earned themes to L8 and L15', () => {
        expect(LEVEL_MAP.find((n) => n.level === 8)?.rewardId).toBe('theme-champion');
        expect(LEVEL_MAP.find((n) => n.level === 15)?.rewardId).toBe('theme-legend');
    });

    it('marks L5 / L11 / L14 reserved with no reward yet', () => {
        for (const lv of [5, 11, 14]) {
            const node = LEVEL_MAP.find((n) => n.level === lv);
            expect(node?.reserved).toBe(true);
            expect(node?.rewardId).toBeUndefined();
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
        expect(level(22000)).toBe(15);
        expect(level(999_999)).toBe(15);
    });
});

describe('xpForLevel', () => {
    it('returns the cumulative threshold for a level', () => {
        expect(xpForLevel(1)).toBe(0);
        expect(xpForLevel(8)).toBe(3600);
        expect(xpForLevel(15)).toBe(22000);
    });
});

describe('unlockedRewards', () => {
    it('is empty below the first reward threshold', () => {
        expect(unlockedRewards(3599)).toEqual(new Set());
    });

    it('grants the L8 theme at its threshold', () => {
        expect(unlockedRewards(3600)).toEqual(new Set(['theme-champion']));
    });

    it('grants both earned themes once past the capstone — retroactively', () => {
        expect(unlockedRewards(22000)).toEqual(new Set(['theme-champion', 'theme-legend']));
        expect(unlockedRewards(50_000)).toEqual(new Set(['theme-champion', 'theme-legend']));
    });
});

describe('levelProgress', () => {
    it('reports fill within the current level band', () => {
        expect(levelProgress(0)).toEqual({ level: 1, intoLevel: 0, span: 150, nextLevelXp: 150 });
    });

    it('reports a full, capped band at max level', () => {
        const p = levelProgress(22000);
        expect(p.level).toBe(15);
        expect(p.nextLevelXp).toBeNull();
        expect(p.span).toBe(0);
    });
});
