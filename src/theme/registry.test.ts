import { themeRegistry } from './registry';

describe('themeRegistry', () => {
    it('exposes live store themes then earned progression themes', () => {
        const values = themeRegistry.map((t) => t.value);
        // Earned (progression) themes are always appended after every store theme.
        expect(values.slice(-2)).toEqual(['champion', 'legend']);
        const firstEarned = values.indexOf('champion');
        expect(values.indexOf('default')).toBeLessThan(firstEarned);
        expect(values.indexOf('cyberpunk')).toBeLessThan(firstEarned);
    });

    it('tags earned themes with their reward id and not as premium', () => {
        const champion = themeRegistry.find((theme) => theme.value === 'champion');
        expect(champion?.isEarned).toBe(true);
        expect(champion?.rewardId).toBe('theme-champion');
        expect(champion?.isPremium).toBeUndefined();
    });

    it('the default theme is free and has a label + tokens', () => {
        const def = themeRegistry[0];
        expect(def.value).toBe('default');
        expect(def.isPremium).toBe(false);
        expect(def.labelKey).toBe('screen.settings.theme.default');
        expect(def.theme).toBeDefined();
    });

    it('marks cyberpunk as premium and uses store copy', () => {
        const cyberpunk = themeRegistry.find((theme) => theme.value === 'cyberpunk');
        expect(cyberpunk?.isPremium).toBe(true);
        expect(cyberpunk?.labelKey).toBe('screen.store.item.theme_cyberpunk.title');
        expect(cyberpunk?.theme).toBeDefined();
    });
});
