import { ancientHistoryEn, ancientHistoryPl } from '../../game/ladder/packs/ancient-history';
import { lostCivilizationsEn, lostCivilizationsPl } from '../../game/ladder/packs/lost-civilizations';
import { worldGeographyEn, worldGeographyPl } from '../../game/drop/packs/world-geography';
import { worldCuisineEn, worldCuisinePl } from '../../game/wheel/packs/world-cuisine';
import { en as worldLandmarksEn, pl as worldLandmarksPl } from '../../game/wheel/packs/world-landmarks';
import { en as ourChangingPlanetEn, pl as ourChangingPlanetPl } from '../../game/drop/packs/our-changing-planet';
import type { LadderPackCard } from '../../game/ladder/buildRuns';
import type { DropPackCard } from '../../game/drop/content';
import type { PuzzleContent } from '../../game/wheel/logic';
import type { PackDefinition } from './types';

/**
 * Premium game packs for sale, one entry per pack. Spread into STORE_CATALOG
 * ahead of the cosmetic themes. New packs start `status: 'hidden'` and are
 * flipped to `'live'` only once their IAP is approved in BOTH stores.
 */
export const gamePacks: PackDefinition[] = [
    {
        id: 'pack-ladder-ancient-history',
        kind: 'pack',
        gameId: 'the-ladder',
        status: 'live',
        tier: 'premium',
        // Store SKUs allow only alphanumerics, underscores, and periods (no
        // hyphens), so the slug is snake_cased here even though the catalog id
        // and i18n keys keep the kebab-case slug.
        //
        // IAP PROVISIONING STATUS (2026-06-16):
        //   App Store Connect — IAP id 6779132129, state READY_TO_SUBMIT (name +
        //     localization + price + review screenshot + worldwide availability all
        //     set). Still needs App Review submission + Apple approval before it can
        //     actually be purchased on iOS.
        //   Google Play       — product created, purchase option ACTIVE (billing
        //     permission cleared 2026-06-16).
        //   Entry is status: 'live' per explicit owner decision (iOS purchases will
        //     fail until Apple approves the IAP).
        sku: 'com.showdown.pack_ladder_ancient_history',
        presentation: {
            titleKey: 'screen.store.item.ladder_ancient-history.title',
            descriptionKey: 'screen.store.item.ladder_ancient-history.desc',
            iconName: 'history',
            accentColor: '#C9A227',
            featuresKey: [
                'screen.store.feature.ladder_ancient-history_1',
                'screen.store.feature.ladder_ancient-history_2',
            ],
            fallbackPrice: '$2.49',
        },
        content: { en: ancientHistoryEn, pl: ancientHistoryPl } satisfies {
            en: LadderPackCard[];
            pl: LadderPackCard[];
        },
    },
    {
        id: 'pack-drop-world-geography',
        kind: 'pack',
        gameId: 'the-drop',
        status: 'live',
        // SKU snake_cased (stores reject hyphens); catalog id and i18n keys keep
        // the kebab slug.
        //
        // IAP PROVISIONING STATUS (2026-06-16):
        //   App Store Connect — IAP id 6779168573 ($1.99), state READY_TO_SUBMIT
        //     (metadata + screenshot + worldwide availability set). Still needs App
        //     Review submission + Apple approval before iOS purchases work.
        //   Google Play       — product created, purchase option ACTIVE.
        //   Entry is status: 'live' per explicit owner decision.
        tier: 'premium',
        sku: 'com.showdown.pack_drop_world_geography',
        presentation: {
            titleKey: 'screen.store.item.drop_world-geography.title',
            descriptionKey: 'screen.store.item.drop_world-geography.desc',
            iconName: 'globe',
            accentColor: '#1E88A8',
            featuresKey: ['screen.store.feature.drop_world-geography_1', 'screen.store.feature.drop_world-geography_2'],
            fallbackPrice: '$1.99',
        },
        content: { en: worldGeographyEn, pl: worldGeographyPl } satisfies {
            en: DropPackCard[];
            pl: DropPackCard[];
        },
    },
    {
        id: 'pack-wheel-world-cuisine',
        kind: 'pack',
        gameId: 'the-wheel',
        status: 'live',
        // SKU snake_cased (stores reject hyphens); catalog id and i18n keys keep
        // the kebab slug.
        //
        // IAP PROVISIONING STATUS (2026-06-16):
        //   App Store Connect — IAP id 6779187237 ($1.99), state READY_TO_SUBMIT
        //     (metadata + screenshot + worldwide availability set). Still needs App
        //     Review submission + Apple approval before iOS purchases work.
        //   Google Play       — product created, purchase option ACTIVE.
        //   Entry is status: 'live' per explicit owner decision.
        tier: 'premium',
        sku: 'com.showdown.pack_wheel_world_cuisine',
        presentation: {
            titleKey: 'screen.store.item.wheel_world-cuisine.title',
            descriptionKey: 'screen.store.item.wheel_world-cuisine.desc',
            iconName: 'flame',
            accentColor: '#D9622B',
            featuresKey: ['screen.store.feature.wheel_world-cuisine_1', 'screen.store.feature.wheel_world-cuisine_2'],
            fallbackPrice: '$1.99',
        },
        content: { en: worldCuisineEn, pl: worldCuisinePl } satisfies {
            en: PuzzleContent[];
            pl: PuzzleContent[];
        },
    },
    {
        id: 'pack-wheel-world-landmarks',
        kind: 'pack',
        gameId: 'the-wheel',
        status: 'live',
        tier: 'premium',
        sku: 'com.showdown.pack_wheel_world_landmarks',
        presentation: {
            titleKey: 'screen.store.item.wheel_world-landmarks.title',
            descriptionKey: 'screen.store.item.wheel_world-landmarks.desc',
            iconName: 'globe',
            accentColor: '#4A90E2',
            featuresKey: [
                'screen.store.feature.wheel_world-landmarks_1',
                'screen.store.feature.wheel_world-landmarks_2',
            ],
            fallbackPrice: '$2.99',
        },
        content: { en: worldLandmarksEn, pl: worldLandmarksPl } satisfies {
            en: PuzzleContent[];
            pl: PuzzleContent[];
        },
    },
    {
        id: 'pack-ladder-lost-civilizations',
        kind: 'pack',
        gameId: 'the-ladder',
        status: 'live',
        // SKU snake_cased (stores reject hyphens); catalog id and i18n keys keep
        // the kebab slug.
        //
        // IAP PROVISIONING STATUS (2026-06-17):
        //   App Store Connect — IAP created (id 6781420948), price $2.99.
        //   Google Play       — product created, purchase option ACTIVE.
        //   Entry is status: 'live' per user request to activate immediately.
        tier: 'premium',
        sku: 'com.showdown.pack_ladder_lost_civilizations',
        presentation: {
            titleKey: 'screen.store.item.ladder_lost-civilizations.title',
            descriptionKey: 'screen.store.item.ladder_lost-civilizations.desc',
            iconName: 'history',
            accentColor: '#8B4513',
            featuresKey: [
                'screen.store.feature.ladder_lost-civilizations_1',
                'screen.store.feature.ladder_lost-civilizations_2',
            ],
            fallbackPrice: '$2.99',
        },
        content: { en: lostCivilizationsEn, pl: lostCivilizationsPl } satisfies {
            en: LadderPackCard[];
            pl: LadderPackCard[];
        },
    },
    {
        id: 'pack-drop-our-changing-planet',
        kind: 'pack',
        gameId: 'the-drop',
        status: 'hidden',
        tier: 'premium',
        sku: 'com.showdown.pack_drop_our_changing_planet',
        presentation: {
            titleKey: 'screen.store.item.drop_our-changing-planet.title',
            descriptionKey: 'screen.store.item.drop_our-changing-planet.desc',
            iconName: 'globe',
            accentColor: '#228B22',
            featuresKey: [
                'screen.store.feature.drop_our-changing-planet_1',
                'screen.store.feature.drop_our-changing-planet_2',
            ],
            fallbackPrice: '$2.99',
        },
        content: { en: ourChangingPlanetEn, pl: ourChangingPlanetPl } satisfies {
            en: DropPackCard[];
            pl: DropPackCard[];
        },
    },
];
