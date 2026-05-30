import { createMMKV } from 'react-native-mmkv';
import { PurchasePersistencePort } from './PurchasePersistencePort';

const storage = createMMKV({ id: 'showdown-store' });
const PURCHASED_ITEMS_KEY = 'purchased_items';

export class MMKVPurchaseAdapter implements PurchasePersistencePort {
    getPurchasedItems(): string[] {
        const data = storage.getString(PURCHASED_ITEMS_KEY);
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    savePurchasedItem(id: string): void {
        const items = this.getPurchasedItems();
        if (!items.includes(id)) {
            items.push(id);
            storage.set(PURCHASED_ITEMS_KEY, JSON.stringify(items));
        }
    }

    clearPurchases(): void {
        storage.remove(PURCHASED_ITEMS_KEY);
    }
}
