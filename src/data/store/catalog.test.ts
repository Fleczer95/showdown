import { getPackSeedTargets } from './catalog';

describe('getPackSeedTargets', () => {
    it('returns the owning game id and every question id for a real pack', () => {
        const target = getPackSeedTargets('pack-ladder-ancient-history');
        expect(target?.gameId).toBe('the-ladder');
        expect(target?.ids).toContain('ladder-ancient-history-001');
        expect(target?.ids.every((id) => typeof id === 'string')).toBe(true);
    });

    it('returns undefined for a theme', () => {
        expect(getPackSeedTargets('theme-cyberpunk')).toBeUndefined();
    });

    it('returns undefined for an unknown id', () => {
        expect(getPackSeedTargets('nope')).toBeUndefined();
    });
});
