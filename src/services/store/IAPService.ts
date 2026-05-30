import { requestPurchase, getAvailablePurchases } from 'react-native-iap';
import { getSkuForId, getIdForSku } from '../../data/store/catalog';

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
