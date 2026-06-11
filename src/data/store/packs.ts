import { ancientHistoryEn, ancientHistoryPl } from '../../game/ladder/packs/ancient-history';
import { worldGeographyEn, worldGeographyPl } from '../../game/drop/packs/world-geography';
import { worldCuisineEn, worldCuisinePl } from '../../game/wheel/packs/world-cuisine';
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
        status: 'hidden',
        tier: 'premium',
        // Store SKUs allow only alphanumerics, underscores, and periods (no
        // hyphens), so the slug is snake_cased here even though the catalog id
        // and i18n keys keep the kebab-case slug.
        //
        // IAP PROVISIONING STATUS (2026-06-11):
        //   App Store Connect — DRAFT created (id 6779132129, FUTURE/unsubmitted).
        //   Google Play       — PENDING: config verified correct (auth + read +
        //     non-financial writes all succeed via API); only financial-WRITE
        //     (product creation) returns "request billing permission". Admin +
        //     payments set, so this is Google-side: financial-permission changes
        //     for service accounts can take up to ~24h to propagate, and/or the
        //     payments/merchant profile must be fully APPROVED (not just submitted).
        //     Just re-run periodically until it succeeds:
        //     PYTHONPATH=<deps> /usr/bin/python3 .agents/google-play-iap/create_iap.py
        //   Keep this entry status: 'hidden' until BOTH stores approve, then 'live'.
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
        status: 'hidden',
        // SKU snake_cased (stores reject hyphens); catalog id and i18n keys keep
        // the kebab slug. Stays status: 'hidden' until the IAP is approved in
        // BOTH stores, then flip to 'live'.
        //
        // IAP PROVISIONING STATUS (2026-06-11):
        //   App Store Connect — DRAFT created (id 6779168573, FUTURE/unsubmitted, $1.99).
        //   Google Play       — PENDING: same account-level "request billing
        //     permission" block that holds the Ancient History pack. Not a
        //     code/sku issue — the google-play-key.json service account needs the
        //     financial/billing grant in Play Console (and the payments profile
        //     fully approved). Re-run once granted:
        //     PYTHONPATH=<deps> /usr/bin/python3 .agents/google-play-iap/create_iap.py
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
        status: 'hidden',
        // SKU snake_cased (stores reject hyphens); catalog id and i18n keys keep
        // the kebab slug. Stays status: 'hidden' until the IAP is approved in
        // BOTH stores, then flip to 'live'.
        //
        // IAP PROVISIONING STATUS (2026-06-11):
        //   App Store Connect — DRAFT created (id 6779187237, FUTURE/unsubmitted, $1.99).
        //   Google Play       — NOT YET PROVISIONED: skipped at user request. Will
        //     likely hit the same account-level "request billing permission" block
        //     as the Ancient History / World Geography packs. Provision once ready:
        //     PYTHONPATH=<deps> /usr/bin/python3 .agents/google-play-iap/create_iap.py
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
];
