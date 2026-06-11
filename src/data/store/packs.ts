import { ancientHistoryEn, ancientHistoryPl } from '../../game/ladder/packs/ancient-history';
import type { LadderPackCard } from '../../game/ladder/buildRuns';
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
];
