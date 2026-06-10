import { defaultTokens } from '../../theme/defaults';
import { cyberpunkTheme, oceanTheme, forestTheme } from '../../theme/themes';
import type { ThemeDefinition } from './types';

/**
 * Theme catalog. One free `default` theme built from the framework's
 * `defaultTokens`, plus the premium themes for sale. Earned (level-reward)
 * themes live in `src/game/progression/themes.ts`, outside the commercial
 * catalog. The full theme-token library lives in `src/theme/themes/`.
 *
 * To add a paid theme: register it here with a `com.showdown.*` SKU and the
 * `screen.store.item` / `screen.store.feature` copy in the locale files.
 */
export const themes: ThemeDefinition[] = [
    {
        id: 'theme-default',
        kind: 'theme',
        status: 'live',
        tier: 'free',
        presentation: {
            titleKey: 'screen.settings.theme.default',
            descriptionKey: 'screen.settings.theme.default',
            iconName: 'themes',
            accentColor: '#A855F7',
        },
        tokens: defaultTokens,
    },
    {
        id: 'theme-cyberpunk',
        kind: 'theme',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.theme_cyberpunk',
        presentation: {
            titleKey: 'screen.store.item.theme_cyberpunk.title',
            descriptionKey: 'screen.store.item.theme_cyberpunk.desc',
            iconName: 'zap',
            accentColor: '#00f3ff',
            featuresKey: ['screen.store.feature.theme_cyberpunk_1', 'screen.store.feature.theme_cyberpunk_2'],
            fallbackPrice: '$2.49',
        },
        tokens: cyberpunkTheme,
    },
    {
        id: 'theme-ocean',
        kind: 'theme',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.theme_ocean',
        presentation: {
            titleKey: 'screen.store.item.theme_ocean.title',
            descriptionKey: 'screen.store.item.theme_ocean.desc',
            iconName: 'sparkles',
            accentColor: '#38bdf8',
            featuresKey: ['screen.store.feature.theme_ocean_1', 'screen.store.feature.theme_ocean_2'],
            fallbackPrice: '$1.99',
        },
        tokens: oceanTheme,
    },
    {
        id: 'theme-forest',
        kind: 'theme',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.theme_forest',
        presentation: {
            titleKey: 'screen.store.item.theme_forest.title',
            descriptionKey: 'screen.store.item.theme_forest.desc',
            iconName: 'trees',
            accentColor: '#22c55e',
            featuresKey: ['screen.store.feature.theme_forest_1', 'screen.store.feature.theme_forest_2'],
            fallbackPrice: '$1.99',
        },
        tokens: forestTheme,
    },
];
