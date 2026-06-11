import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useIAP } from 'react-native-iap';
import { PurchaseEngine, StoreState } from '../../services/store/PurchaseEngine';
import { MMKVPurchaseAdapter } from '../../services/store/MMKVPurchaseAdapter';
import { IAPService } from '../../services/store/IAPService';
import { ALL_SKUS, getIdForSku } from '../../data/store/catalog';
import { seedUnlockedPack } from '../../game/packHistory';

// Toggle this flag to switch between mock buying and real IAP
// In a real app, you might want to use an environment variable or a developer setting
const USE_MOCK_IAP = process.env.EXPO_PUBLIC_USE_MOCK_IAP === 'true' || __DEV__;

interface StoreContextValue extends StoreState {
    purchaseItem: (itemId: string) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    /** Localized store prices keyed by SKU. Empty until products load or in mock mode. */
    priceBySku: Record<string, string>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
    const engineRef = useRef<PurchaseEngine | null>(null);
    if (!engineRef.current) {
        engineRef.current = new PurchaseEngine(new MMKVPurchaseAdapter());
    }
    const engine = engineRef.current;

    const [state, setState] = useState<StoreState>(() => engine.getState());

    // --- IAP Integration ---
    const { connected, products, fetchProducts, finishTransaction } = useIAP({
        onPurchaseSuccess: async (purchase) => {
            console.log('[StoreProvider] Purchase success:', purchase.productId);
            const itemId = getIdForSku(purchase.productId);
            if (itemId) {
                engine.markAsPurchased(itemId);
            } else {
                // If we can't map the SKU back to an item, at least stop the loading indicator
                engine.setProcessing(false);
            }
            await finishTransaction({ purchase, isConsumable: false });
        },
        onPurchaseError: (error) => {
            console.error('[StoreProvider] Purchase error:', error);
            engine.setProcessing(false);
        },
    });

    // Fetch IAP product metadata once connected. Required so the store can
    // launch a purchase (Google Play needs cached ProductDetails) and so real
    // localized prices replace the catalog's display-only fallbackPrice.
    useEffect(() => {
        if (!USE_MOCK_IAP && connected && ALL_SKUS.length > 0) {
            fetchProducts({ skus: ALL_SKUS, type: 'in-app' }).catch((error) => {
                console.error('[StoreProvider] fetchProducts failed:', error);
            });
        }
    }, [connected, fetchProducts]);

    const priceBySku = useMemo(() => {
        const map: Record<string, string> = {};
        for (const product of products) {
            if (product.displayPrice) {
                map[product.id] = product.displayPrice;
            }
        }
        return map;
    }, [products]);

    useEffect(() => {
        return engine.subscribe(setState);
    }, [engine]);

    // Seed each owned pack's question history to its game's current pool floor so
    // freshly-unlocked paid content blends into rotation instead of starving the
    // base pool. One subscription covers purchase, mock buy and restore; `seen`
    // starts empty so the initial fire also seeds packs owned before this shipped.
    useEffect(() => {
        const seen = new Set<string>();
        return engine.subscribe((s) => {
            for (const id of s.purchasedItemIds) {
                if (!seen.has(id)) {
                    seen.add(id);
                    seedUnlockedPack(id);
                }
            }
        });
    }, [engine]);

    const purchaseItem = useCallback(
        async (itemId: string) => {
            if (USE_MOCK_IAP) {
                console.log('[StoreProvider] Using mock purchase for:', itemId);
                return await engine.purchaseItem(itemId);
            }

            try {
                console.log('[StoreProvider] Using real IAP purchase for:', itemId);
                engine.setProcessing(true);
                await IAPService.getInstance().buyItem(itemId);
                // We return true because requestPurchase was successful.
                // The actual unlock happens in onPurchaseSuccess.
                return true;
            } catch (error) {
                console.error('[StoreProvider] Purchase failed:', error);
                engine.setProcessing(false);
                return false;
            }
        },
        [engine],
    );

    const restorePurchases = useCallback(async () => {
        try {
            engine.setProcessing(true);
            if (USE_MOCK_IAP) {
                engine.restorePurchases();
                return true;
            }

            const items = await IAPService.getInstance().getPurchasedItemsFromStore();
            items.forEach((itemId) => engine.markAsPurchased(itemId));
            return true;
        } catch (error) {
            console.error('[StoreProvider] Restore failed:', error);
            return false;
        } finally {
            engine.setProcessing(false);
        }
    }, [engine]);

    return (
        <StoreContext.Provider
            value={{
                ...state,
                purchaseItem,
                restorePurchases,
                priceBySku,
            }}
        >
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
}
