import { useEffect, useRef } from 'react';
import { SafeAnalytics } from '../../utils/firebase/init';
import { gameIdForPack, ownsAllPremiumPacks, premiumPackCount } from '../../data/store/catalog';
import { useStore } from '../store/useStore';

export function useStoreAnalyticsBridge(): void {
    const { purchasedItemIds, isPremium } = useStore();
    const prevPurchased = useRef<Set<string>>(new Set<string>(purchasedItemIds));
    const initRef = useRef(false);
    const prevPremium = useRef<boolean>(isPremium);
    const premiumInitRef = useRef(false);

    // Premium subscription lifecycle: fire when the cached/store-validated status
    // flips. We can't tell a fresh subscribe from a restore here, so both surface
    // as `premium_activated`; a flip to false is a lapse.
    useEffect(() => {
        if (!premiumInitRef.current) {
            premiumInitRef.current = true;
            prevPremium.current = isPremium;
            return;
        }
        if (isPremium !== prevPremium.current) {
            SafeAnalytics.logEvent({
                name: isPremium ? 'premium_activated' : 'premium_lapsed',
                params: {},
            });
            prevPremium.current = isPremium;
        }
    }, [isPremium]);

    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            prevPurchased.current = new Set<string>(purchasedItemIds);
            return;
        }

        const prev = prevPurchased.current;
        const current = new Set<string>(purchasedItemIds);
        // Games whose pack set might have just been completed by a new pack purchase.
        const touchedGames = new Set<string>();
        for (const id of current) {
            if (!prev.has(id)) {
                if (id.startsWith('theme-')) {
                    SafeAnalytics.logEvent({
                        name: 'theme_purchase_completed',
                        params: { theme_id: id.replace('theme-', ''), price_string: '', currency: '' },
                    });
                } else {
                    SafeAnalytics.logEvent({
                        name: 'pack_purchase_completed',
                        params: { pack_id: id, price_string: '', currency: '', store_time_to_purchase_ms: 0 },
                    });
                    const game = gameIdForPack(id);
                    if (game) touchedGames.add(game);
                }
            }
        }

        // For each game a new pack belongs to, fire once if this purchase is what
        // completed the set — owned-all now but not before. Restoring many packs at
        // once still fires at most once per game.
        for (const game of touchedGames) {
            if (!ownsAllPremiumPacks(game, prev) && ownsAllPremiumPacks(game, current)) {
                SafeAnalytics.logEvent({
                    name: 'game_packs_completed',
                    params: { game, pack_count: premiumPackCount(game) },
                });
            }
        }

        prevPurchased.current = current;
    }, [purchasedItemIds]);
}
