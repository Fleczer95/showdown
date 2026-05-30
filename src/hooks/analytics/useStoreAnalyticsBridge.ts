import { useEffect, useRef } from 'react';
import { SafeAnalytics } from '../../utils/firebase/init';
import { useStore } from '../store/useStore';

export function useStoreAnalyticsBridge(): void {
    const { purchasedItemIds } = useStore();
    const prevPurchased = useRef<Set<string>>(new Set<string>(purchasedItemIds));
    const initRef = useRef(false);

    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            prevPurchased.current = new Set<string>(purchasedItemIds);
            return;
        }

        const current = new Set<string>(purchasedItemIds);
        for (const id of current) {
            if (!prevPurchased.current.has(id)) {
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
                }
            }
        }
        prevPurchased.current = current;
    }, [purchasedItemIds]);
}
