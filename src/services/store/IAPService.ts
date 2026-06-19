import { requestPurchase, getAvailablePurchases } from 'react-native-iap';
import { getSkuForId, getIdForSku } from '../../data/store/catalog';
import { isSubscriptionProductId } from '../../data/store/subscription';

/**
 * Imperative IAP operations (purchase + restore). The store connection
 * lifecycle is owned by the `useIAP` hook in StoreProvider — do not init or
 * tear down the connection here.
 */
export class IAPService {
    private static instance: IAPService;

    private constructor() {}

    public static getInstance(): IAPService {
        if (!IAPService.instance) {
            IAPService.instance = new IAPService();
        }
        return IAPService.instance;
    }

    public async buyItem(itemId: string): Promise<void> {
        const sku = getSkuForId(itemId);
        if (!sku) {
            throw new Error(`No SKU found for item ID: ${itemId}`);
        }

        console.log(`[IAPService] Requesting purchase for SKU: ${sku}`);
        await requestPurchase({
            type: 'in-app',
            request: {
                apple: { sku, andDangerouslyFinishTransactionAutomatically: false },
                google: { skus: [sku] },
            },
        });
    }

    /**
     * Start an auto-renewable subscription purchase. Apple takes the per-plan
     * product id; Google takes the single subscription product id plus the
     * chosen base plan's offer token (resolved from the fetched product).
     */
    public async buySubscription(params: {
        appleSku: string;
        googleProductId: string;
        googleOfferToken?: string;
    }): Promise<void> {
        console.log(`[IAPService] Requesting subscription: ${params.appleSku} / ${params.googleProductId}`);
        await requestPurchase({
            type: 'subs',
            request: {
                apple: { sku: params.appleSku, andDangerouslyFinishTransactionAutomatically: false },
                google: {
                    skus: [params.googleProductId],
                    subscriptionOffers: params.googleOfferToken
                        ? [{ sku: params.googleProductId, offerToken: params.googleOfferToken }]
                        : [],
                },
            },
        });
    }

    /**
     * Store-validated Premium status. Returns `null` when the store can't be
     * reached so the caller keeps the cached flag rather than downgrading an
     * offline subscriber to free.
     */
    public async getActivePremium(): Promise<boolean | null> {
        try {
            const purchases = await getAvailablePurchases();
            return purchases.some((p) => isSubscriptionProductId(p.productId));
        } catch (error) {
            console.error('[IAPService] Error checking subscription status:', error);
            return null;
        }
    }

    public async getPurchasedItemsFromStore(): Promise<string[]> {
        try {
            console.log('[IAPService] Fetching available purchases...');
            const purchases = await getAvailablePurchases();
            console.log(`[IAPService] Found ${purchases.length} purchases`);

            return purchases.map((p) => getIdForSku(p.productId)).filter((id): id is string => !!id);
        } catch (error) {
            console.error('[IAPService] Error getting available purchases:', error);
            return [];
        }
    }
}
