import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useIAP } from 'react-native-iap';
import { PurchaseEngine, StoreState } from '../../services/store/PurchaseEngine';
import { MMKVPurchaseAdapter } from '../../services/store/MMKVPurchaseAdapter';
import { IAPService } from '../../services/store/IAPService';
import { ALL_SKUS, getIdForSku } from '../../data/store/catalog';
import {
    SUBSCRIPTION_SKUS,
    SUBSCRIPTION_PLANS,
    GOOGLE_SUBSCRIPTION_ID,
    isSubscriptionProductId,
} from '../../data/store/subscription';

// Toggle this flag to switch between mock buying and real IAP
// In a real app, you might want to use an environment variable or a developer setting
const USE_MOCK_IAP = process.env.EXPO_PUBLIC_USE_MOCK_IAP === 'true' || __DEV__;

interface StoreContextValue extends StoreState {
    purchaseItem: (itemId: string) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    /** Localized store prices keyed by SKU. Empty until products load or in mock mode. */
    priceBySku: Record<string, string>;
    /** Whether the Premium subscription is active. Gates the perks + exclusive theme. */
    isPremium: boolean;
    /** Start the Premium subscription for a plan. The unlock lands via `onPurchaseSuccess`. */
    subscribePremium: (planId: 'monthly' | 'annual') => Promise<boolean>;
    /** Dev-only Premium toggle (mock mode); no-op against the real store. */
    devSetPremium: (active: boolean) => void;
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
            if (isSubscriptionProductId(purchase.productId)) {
                engine.setPremiumActive(true);
                engine.setProcessing(false);
            } else {
                const itemId = getIdForSku(purchase.productId);
                if (itemId) {
                    engine.markAsPurchased(itemId);
                } else {
                    // If we can't map the SKU back to an item, at least stop the loading indicator
                    engine.setProcessing(false);
                }
            }
            await finishTransaction({ purchase, isConsumable: false });
        },
        onPurchaseError: (error) => {
            console.error('[StoreProvider] Purchase error:', error);
            engine.setProcessing(false);
        },
    });

    // Pull store-validated Premium status into the engine. A `null` result means
    // the store was unreachable, so the cached flag is kept rather than
    // downgrading an offline subscriber. Shared by the launch refresh and Restore.
    const refreshPremiumStatus = useCallback(async () => {
        if (USE_MOCK_IAP) return;
        const active = await IAPService.getInstance().getActivePremium();
        if (active !== null) engine.setPremiumActive(active);
    }, [engine]);

    // Fetch IAP product metadata once connected. Required so the store can
    // launch a purchase (Google Play needs cached ProductDetails) and so real
    // localized prices replace the catalog's display-only fallbackPrice.
    useEffect(() => {
        if (!USE_MOCK_IAP && connected && ALL_SKUS.length > 0) {
            fetchProducts({ skus: ALL_SKUS, type: 'in-app' }).catch((error) => {
                console.error('[StoreProvider] fetchProducts failed:', error);
            });
            // Subscriptions are a separate `type:'subs'` query (prices + Android offer tokens).
            fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' }).catch((error) => {
                console.error('[StoreProvider] fetchProducts(subs) failed:', error);
            });
        }
    }, [connected, fetchProducts]);

    // Store-validated Premium status, refreshed once the store connects. The
    // cached MMKV flag covers offline sessions until this resolves.
    useEffect(() => {
        if (!connected) return;
        refreshPremiumStatus().catch((error) =>
            console.error('[StoreProvider] premium status check failed:', error),
        );
    }, [connected, refreshPremiumStatus]);

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
            // Restore the subscription too — a flip to inactive correctly downgrades.
            await refreshPremiumStatus();
            return true;
        } catch (error) {
            console.error('[StoreProvider] Restore failed:', error);
            return false;
        } finally {
            engine.setProcessing(false);
        }
    }, [engine, refreshPremiumStatus]);

    const subscribePremium = useCallback(
        async (planId: 'monthly' | 'annual') => {
            const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
            if (!plan) return false;

            if (USE_MOCK_IAP) {
                console.log('[StoreProvider] Using mock subscription for:', planId);
                engine.setProcessing(true);
                await new Promise((resolve) => setTimeout(resolve, 1200));
                engine.setPremiumActive(true);
                engine.setProcessing(false);
                return true;
            }

            try {
                engine.setProcessing(true);
                // Android needs the chosen base plan's offer token from the fetched product.
                let googleOfferToken: string | undefined;
                if (Platform.OS === 'android') {
                    const product = products.find((p) => p.id === GOOGLE_SUBSCRIPTION_ID) as
                        | { subscriptionOfferDetailsAndroid?: { basePlanId: string; offerToken: string }[] }
                        | undefined;
                    const offers = product?.subscriptionOfferDetailsAndroid ?? [];
                    const match = offers.find((o) => o.basePlanId === plan.googleBasePlanId) ?? offers[0];
                    googleOfferToken = match?.offerToken;
                }
                await IAPService.getInstance().buySubscription({
                    appleSku: plan.appleSku,
                    googleProductId: GOOGLE_SUBSCRIPTION_ID,
                    googleOfferToken,
                });
                // The actual unlock lands in onPurchaseSuccess.
                return true;
            } catch (error) {
                console.error('[StoreProvider] Subscription failed:', error);
                engine.setProcessing(false);
                return false;
            }
        },
        [engine, products],
    );

    const devSetPremium = useCallback(
        (active: boolean) => {
            if (!USE_MOCK_IAP) return;
            engine.setPremiumActive(active);
        },
        [engine],
    );

    return (
        <StoreContext.Provider
            value={{
                ...state,
                purchaseItem,
                restorePurchases,
                priceBySku,
                isPremium: state.premiumActive,
                subscribePremium,
                devSetPremium,
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
