import type { MascotSkinDefinition } from './types';

/**
 * Mascot skin catalog. We sell each costume preset (Arctic, Emerald, Plum) as
 * an independent SKU (plan §5).
 * Earned mascot elements (e.g. a gold mic via level progression) live in
 * `src/game/progression/` and are NEVER sold, so they are absent from this catalog.
 */
export const mascotSkins: MascotSkinDefinition[] = [
    {
        id: 'mascot-arctic',
        kind: 'mascotSkin',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.mascot_arctic',
        presentation: {
            titleKey: 'screen.store.item.mascot_arctic.title',
            descriptionKey: 'screen.store.item.mascot_arctic.desc',
            iconName: 'drama',
            accentColor: '#E2E8F0',
            featuresKey: ['screen.store.feature.mascot_arctic_1', 'screen.store.feature.mascot_arctic_2'],
            fallbackPrice: '$0.99',
        },
        unlocks: ['fur.arctic', 'accent.teal', 'mic.silver'],
    },
    {
        id: 'mascot-emerald',
        kind: 'mascotSkin',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.mascot_emerald',
        presentation: {
            titleKey: 'screen.store.item.mascot_emerald.title',
            descriptionKey: 'screen.store.item.mascot_emerald.desc',
            iconName: 'drama',
            accentColor: '#047857',
            featuresKey: ['screen.store.feature.mascot_emerald_1', 'screen.store.feature.mascot_emerald_2'],
            fallbackPrice: '$0.99',
        },
        unlocks: ['suit.emerald', 'accent.gold'],
    },
    {
        id: 'mascot-plum',
        kind: 'mascotSkin',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.mascot_plum',
        presentation: {
            titleKey: 'screen.store.item.mascot_plum.title',
            descriptionKey: 'screen.store.item.mascot_plum.desc',
            iconName: 'drama',
            accentColor: '#7E22CE',
            featuresKey: ['screen.store.feature.mascot_plum_1', 'screen.store.feature.mascot_plum_2'],
            fallbackPrice: '$0.99',
        },
        unlocks: ['fur.rust', 'suit.plum', 'mic.rose'],
    },
];
