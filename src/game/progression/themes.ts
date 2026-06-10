// Earned cosmetic definitions. These live OUTSIDE the commercial STORE_CATALOG so
// IAP flows, SKUs and `is_paying_user` analytics stay uncontaminated. The theme
// TOKENS themselves live in src/theme/themes/ like every other theme; here we only
// bind a reward id (matching a LEVEL_MAP node) to its picker presentation.

import { championTheme, legendTheme } from '../../theme/themes';
import type { Theme } from '../../theme/contract';

export interface ProgressionTheme {
    /** Reward id — matches a LEVEL_MAP node `rewardId` and `unlockedRewards()`. */
    id: string;
    /** Picker value (the theme id without the 'theme-' prefix). */
    value: string;
    titleKey: string;
    iconName: string;
    accentColor: string;
    tokens: Theme;
}

export const PROGRESSION_THEMES: readonly ProgressionTheme[] = [
    {
        id: 'theme-champion',
        value: 'champion',
        titleKey: 'progression.themes.champion',
        iconName: 'trophy',
        accentColor: '#34D399',
        tokens: championTheme,
    },
    {
        id: 'theme-legend',
        value: 'legend',
        titleKey: 'progression.themes.legend',
        iconName: 'crown',
        accentColor: '#FACC15',
        tokens: legendTheme,
    },
];
