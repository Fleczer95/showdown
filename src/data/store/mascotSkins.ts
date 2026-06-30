import { MASCOT_PALETTE, DEFAULT_LOOK } from '../../game/mascot/look';
import { EARNED_MASCOT_COLOR_IDS } from '../../game/progression/mascotColors';
import type { MascotSkinDefinition } from './types';

/**
 * Mascot skin catalog. A SINGLE bundle SKU (`com.showdown.mascot_skinpack`,
 * ~$2.99) unlocks every non-default recolor swatch at once — avoids cheapening
 * individual recolors and keeps the store clean (plan §5). Earned mascot elements
 * (e.g. a gold mic via level progression) live in `src/game/progression/` and are
 * NEVER sold, so they are absent from this catalog.
 *
 * NOT YET wired into `STORE_CATALOG` — Phase 3 registers it there when the buy
 * path + standalone-store surfacing land (so the unprovisioned SKU isn't queried
 * before the commerce path exists). The `screen.store.*` i18n copy is added then.
 *
 * `unlocks` is derived from the placeholder palette: every swatch that isn't the
 * free slot default. Once real art designates earned colors, exclude those here.
 */
const DEFAULT_IDS = new Set(Object.values(DEFAULT_LOOK));

const BUNDLED_COLOR_IDS = Object.values(MASCOT_PALETTE)
    .flat()
    .map((swatch) => swatch.id)
    .filter((id) => !DEFAULT_IDS.has(id) && !EARNED_MASCOT_COLOR_IDS.has(id));

export const mascotSkins: MascotSkinDefinition[] = [
    {
        id: 'mascot-skinpack',
        kind: 'mascotSkin',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.mascot_skinpack',
        presentation: {
            titleKey: 'screen.store.item.mascot_skinpack.title',
            descriptionKey: 'screen.store.item.mascot_skinpack.desc',
            iconName: 'drama',
            accentColor: '#F2780C',
            featuresKey: ['screen.store.feature.mascot_skinpack_1', 'screen.store.feature.mascot_skinpack_2'],
            fallbackPrice: '$2.99',
        },
        unlocks: BUNDLED_COLOR_IDS,
    },
];
