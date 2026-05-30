import { themeRegistry } from './registry';

describe('themeRegistry', () => {
    it('exposes a single neutral default theme while themes are mocked', () => {
        // Themes are mocked until ShowDown's visual design is introduced.
        expect(themeRegistry.map((t) => t.value)).toEqual(['default']);
    });

    it('the mocked default theme is free and has a label + tokens', () => {
        const def = themeRegistry[0];
        expect(def.value).toBe('default');
        expect(def.isPremium).toBe(false);
        expect(def.labelKey).toBe('screen.settings.theme.default');
        expect(def.theme).toBeDefined();
    });
});
