import { themeRegistry } from './registry';

describe('themeRegistry', () => {
    it('exposes live free and premium themes', () => {
        expect(themeRegistry.map((t) => t.value)).toEqual(['default', 'cyberpunk']);
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
