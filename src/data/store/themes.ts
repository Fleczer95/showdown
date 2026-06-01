import { defaultTokens } from '../../theme/defaults';
import { cyberpunkTheme } from '../../theme/themes';
import type { ThemeDefinition } from './types';

/**
 * Theme catalog — MOCKED until ShowDown's visual design (the 2.5D "Studio
 * Interface") is introduced. We expose a single neutral default theme built from
 * the framework's `defaultTokens`, which keeps the theme provider and picker
 * working without committing to any palette.
 *
 * When the design lands, register the real ShowDown themes here (and any paid
 * `com.showdown.*` theme SKUs + `screen.store.item` / `screen.store.feature`
 * copy). The full theme-token library still lives in `src/theme/themes/`.
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
];
