import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import { useIAP, type Purchase } from 'react-native-iap';
import { PurchaseEngine, StoreState } from '../../services/store/PurchaseEngine';
import { MMKVPurchaseAdapter } from '../../services/store/MMKVPurchaseAdapter';
import { IAPService } from '../../services/store/IAPService';
import { ALL_SKUS, getIdForSku, getSkuForId } from '../../data/store/catalog';
import {
    SUBSCRIPTION_SKUS,
    SUBSCRIPTION_PLANS,
    GOOGLE_SUBSCRIPTION_ID,
    isSubscriptionProductId,
    resolveSubscriptionPrice,
    resolveGoogleOfferToken,
} from '../../data/store/subscription';

// Toggle this flag to switch between mock buying and real IAP
// In a real app, you might want to use an environment variable or a developer setting
const USE_MOCK_IAP = process.env.EXPO_PUBLIC_USE_MOCK_IAP === 'true' || __DEV__;

interface AutoSyncNotice {
    itemIds: string[];
    premium: boolean;
}

type ReconciledEntitlement =
    | { kind: 'item'; itemId: string; newlyGranted: boolean }
    | { kind: 'premium'; newlyGranted: boolean };

interface StoreContextValue extends StoreState {
    purchaseItem: (itemId: string) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    /** Entitlements discovered by the latest silent sync, or null when dismissed. */
    autoSyncNotice: AutoSyncNotice | null;
    dismissAutoSyncNotice: () => void;
    /** Localized store prices keyed by SKU. Empty until products load or in mock mode. */
    priceBySku: Record<string, string>;
    /** Localized subscription prices keyed by plan id. Empty until subs products load. */
    subscriptionPriceByPlanId: Record<string, string>;
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
    const [autoSyncNotice, setAutoSyncNotice] = useState<AutoSyncNotice | null>(null);
    const syncInFlightRef = useRef<Promise<boolean> | null>(null);
    const purchasesStartedInAppRef = useRef(new Set<string>());
    const premiumPurchaseEventRevisionRef = useRef(0);

    const addAutoSyncNotice = useCallback((itemIds: string[], premium: boolean) => {
        if (itemIds.length === 0 && !premium) return;

        setAutoSyncNotice((current) => ({
            itemIds: [...new Set([...(current?.itemIds ?? []), ...itemIds])],
            premium: (current?.premium ?? false) || premium,
        }));
    }, []);

    const reconcilePurchase = useCallback(
        (purchase: Purchase): ReconciledEntitlement | null => {
            if (isSubscriptionProductId(purchase.productId)) {
                const newlyGranted = !engine.getState().premiumActive;
                engine.setPremiumActive(true);
                return { kind: 'premium', newlyGranted };
            }

            const itemId = getIdForSku(purchase.productId);
            if (!itemId) return null;
            return { kind: 'item', itemId, newlyGranted: engine.reconcilePurchasedItem(itemId) };
        },
        [engine],
    );

    // --- IAP Integration ---
    const { connected, products, subscriptions, fetchProducts, finishTransaction } = useIAP({
        onPurchaseSuccess: async (purchase) => {
            console.log('[StoreProvider] Purchase success:', purchase.productId);
            const startedInApp = purchasesStartedInAppRef.current.delete(purchase.productId);
            if (isSubscriptionProductId(purchase.productId)) premiumPurchaseEventRevisionRef.current += 1;
            const entitlement = reconcilePurchase(purchase);

            // Only the matching in-app checkout owns the global processing flag.
            if (startedInApp) engine.setProcessing(false);

            // StoreKit / Play Billing can publish purchases redeemed outside the app
            // before the launch sync query completes. Include that path in the notice,
            // while purchases explicitly started in ShowDown keep their normal UI flow.
            if (!startedInApp && entitlement?.newlyGranted) {
                addAutoSyncNotice(
                    entitlement.kind === 'item' ? [entitlement.itemId] : [],
                    entitlement.kind === 'premium',
                );
            }

            await finishTransaction({ purchase, isConsumable: false });
        },
        onPurchaseError: (error) => {
            console.error('[StoreProvider] Purchase error:', error);
            purchasesStartedInAppRef.current.clear();
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
            // Subscriptions are a separate `type:'subs'` query (prices + Android offer tokens).
            fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' }).catch((error) => {
                console.error('[StoreProvider] fetchProducts(subs) failed:', error);
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

    // Subscription prices resolve per plan, not by SKU: iOS keys on the per-plan
    // product id, Android reads each base plan's price out of one shared product.
    const subscriptionPriceByPlanId = useMemo(() => {
        const map: Record<string, string> = {};
        for (const plan of SUBSCRIPTION_PLANS) {
            const price = resolveSubscriptionPrice(plan, subscriptions);
            if (price) map[plan.id] = price;
        }
        return map;
    }, [subscriptions]);

    useEffect(() => {
        return engine.subscribe(setState);
    }, [engine]);

    // One reconciliation path powers both the visible Restore action and silent
    // launch/foreground syncs. This catches purchases redeemed outside the app.
    const syncPurchasesFromStore = useCallback(
        ({ showProcessing }: { showProcessing: boolean }): Promise<boolean> => {
            // A manual restore that overlaps a silent sync must await the real result,
            // rather than reporting success before the store request has completed.
            if (syncInFlightRef.current) return syncInFlightRef.current;

            const syncRequest = (async () => {
                try {
                    if (showProcessing) engine.setProcessing(true);

                    if (USE_MOCK_IAP) {
                        engine.restorePurchases();
                        return true;
                    }

                    const premiumEventRevisionBeforeQuery = premiumPurchaseEventRevisionRef.current;
                    const purchases = await IAPService.getInstance().getPurchasesFromStore();
                    if (purchases === null) return false;

                    const completedPurchases = purchases.filter((purchase) => purchase.purchaseState !== 'pending');
                    const newlySyncedItemIds = new Set<string>();
                    let premiumFound = false;
                    let premiumSynced = false;

                    for (const purchase of completedPurchases) {
                        const startedInApp = purchasesStartedInAppRef.current.delete(purchase.productId);
                        const entitlement = reconcilePurchase(purchase);
                        if (!entitlement) continue;

                        if (startedInApp) engine.setProcessing(false);
                        if (entitlement.kind === 'premium') premiumFound = true;

                        if (!startedInApp && entitlement.newlyGranted) {
                            if (entitlement.kind === 'item') newlySyncedItemIds.add(entitlement.itemId);
                            else premiumSynced = true;
                        }

                        const shouldFinish =
                            Platform.OS !== 'android' ||
                            !('isAcknowledgedAndroid' in purchase) ||
                            purchase.isAcknowledgedAndroid !== true;
                        if (!shouldFinish) continue;

                        try {
                            await finishTransaction({ purchase, isConsumable: false });
                        } catch (error) {
                            console.error('[StoreProvider] Failed to finish restored purchase:', error);
                        }
                    }

                    // A successful store response is authoritative for recurring access,
                    // unless a newer subscription callback arrived while this snapshot
                    // was in flight. Never let an older empty response undo that event.
                    if (!premiumFound && premiumPurchaseEventRevisionRef.current === premiumEventRevisionBeforeQuery) {
                        engine.setPremiumActive(false);
                    }
                    if (!showProcessing) addAutoSyncNotice([...newlySyncedItemIds], premiumSynced);
                    return true;
                } catch (error) {
                    console.error('[StoreProvider] Restore failed:', error);
                    return false;
                } finally {
                    if (showProcessing) engine.setProcessing(false);
                }
            })();

            syncInFlightRef.current = syncRequest;
            const clearInFlight = () => {
                if (syncInFlightRef.current === syncRequest) syncInFlightRef.current = null;
            };
            void syncRequest.then(clearInFlight, clearInFlight);
            return syncRequest;
        },
        [addAutoSyncNotice, engine, finishTransaction, reconcilePurchase],
    );

    const autoSyncPurchases = useCallback(async () => {
        if (USE_MOCK_IAP || !connected) return;

        // A foreground event means the store may have changed. If an older query
        // is still running, wait for it and then issue a fresh query instead of
        // letting single-flight deduplication discard the foreground refresh.
        const olderSync = syncInFlightRef.current;
        if (olderSync) await olderSync;
        await syncPurchasesFromStore({ showProcessing: false });
    }, [connected, syncPurchasesFromStore]);

    useEffect(() => {
        autoSyncPurchases();
    }, [autoSyncPurchases]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') autoSyncPurchases();
        });
        return () => subscription.remove();
    }, [autoSyncPurchases]);

    const purchaseItem = useCallback(
        async (itemId: string) => {
            if (USE_MOCK_IAP) {
                console.log('[StoreProvider] Using mock purchase for:', itemId);
                return await engine.purchaseItem(itemId);
            }

            const sku = getSkuForId(itemId);
            try {
                console.log('[StoreProvider] Using real IAP purchase for:', itemId);
                engine.setProcessing(true);
                if (sku) purchasesStartedInAppRef.current.add(sku);
                await IAPService.getInstance().buyItem(itemId);
                // We return true because requestPurchase was successful.
                // The actual unlock happens in onPurchaseSuccess.
                return true;
            } catch (error) {
                if (sku) purchasesStartedInAppRef.current.delete(sku);
                console.error('[StoreProvider] Purchase failed:', error);
                engine.setProcessing(false);
                return false;
            }
        },
        [engine],
    );

    const restorePurchases = useCallback(async () => {
        return await syncPurchasesFromStore({ showProcessing: true });
    }, [syncPurchasesFromStore]);

    const dismissAutoSyncNotice = useCallback(() => setAutoSyncNotice(null), []);

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
                    googleOfferToken = resolveGoogleOfferToken(plan, subscriptions);
                    if (!googleOfferToken) {
                        // The subs product hasn't loaded yet (slow/failed fetch). Launching
                        // now would send an empty offer list Google rejects, so fail fast
                        // and let the caller surface it instead of a silent no-op.
                        console.warn('[StoreProvider] Subscription not ready: missing Android offer token');
                        engine.setProcessing(false);
                        return false;
                    }
                }
                const productId = Platform.OS === 'android' ? GOOGLE_SUBSCRIPTION_ID : plan.appleSku;
                purchasesStartedInAppRef.current.add(productId);
                await IAPService.getInstance().buySubscription({
                    appleSku: plan.appleSku,
                    googleProductId: GOOGLE_SUBSCRIPTION_ID,
                    googleOfferToken,
                });
                // The actual unlock lands in onPurchaseSuccess.
                return true;
            } catch (error) {
                const productId = Platform.OS === 'android' ? GOOGLE_SUBSCRIPTION_ID : plan.appleSku;
                purchasesStartedInAppRef.current.delete(productId);
                console.error('[StoreProvider] Subscription failed:', error);
                engine.setProcessing(false);
                return false;
            }
        },
        [engine, subscriptions],
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
                autoSyncNotice,
                dismissAutoSyncNotice,
                priceBySku,
                subscriptionPriceByPlanId,
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
