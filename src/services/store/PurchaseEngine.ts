import { PurchasePersistencePort } from './PurchasePersistencePort';

export interface StoreState {
    purchasedItemIds: string[];
    /** Whether the Premium subscription is active (cached; store-validated on launch). */
    premiumActive: boolean;
    isProcessing: boolean;
}

export class PurchaseEngine {
    private state: StoreState;
    private persistence: PurchasePersistencePort;
    private listeners: Set<(state: StoreState) => void>;

    constructor(persistence: PurchasePersistencePort) {
        this.persistence = persistence;
        this.state = {
            purchasedItemIds: this.persistence.getPurchasedItems(),
            premiumActive: this.persistence.getPremiumActive(),
            isProcessing: false,
        };
        this.listeners = new Set();
    }

    /** Whether the item has been bought. Free entries are resolved by the catalog, not here. */
    public isPurchased(itemId: string): boolean {
        return this.state.purchasedItemIds.includes(itemId);
    }

    public markAsPurchased(itemId: string) {
        if (this.isPurchased(itemId)) {
            // Even if already purchased, we want to clear processing state
            this.updateState({ isProcessing: false });
            return;
        }

        this.persistence.savePurchasedItem(itemId);
        const updatedItems = this.persistence.getPurchasedItems();
        this.updateState({
            purchasedItemIds: updatedItems,
            isProcessing: false,
        });
    }

    public setProcessing(isProcessing: boolean) {
        this.updateState({ isProcessing });
    }

    /** Persist + broadcast the Premium subscription status (store-validated or restored). */
    public setPremiumActive(active: boolean) {
        if (this.state.premiumActive === active) return;
        this.persistence.setPremiumActive(active);
        this.updateState({ premiumActive: active });
    }

    public async purchaseItem(itemId: string): Promise<boolean> {
        if (this.isPurchased(itemId)) {
            return true;
        }

        this.updateState({ isProcessing: true });

        try {
            // Mock purchase delay - in reality this would talk to an IAP adapter/backend
            await new Promise((resolve) => setTimeout(resolve, 1500));

            this.persistence.savePurchasedItem(itemId);

            const updatedItems = this.persistence.getPurchasedItems();
            this.updateState({
                purchasedItemIds: updatedItems,
                isProcessing: false,
            });

            return true;
        } catch {
            this.updateState({ isProcessing: false });
            return false;
        }
    }

    public restorePurchases() {
        // In a real app, this would query the App Store / Play Store
        const items = this.persistence.getPurchasedItems();
        this.updateState({ purchasedItemIds: items });
    }

    public subscribe(listener: (state: StoreState) => void): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getState(): StoreState {
        return this.state;
    }

    private updateState(partialState: Partial<StoreState>) {
        this.state = { ...this.state, ...partialState };
        this.notifyListeners();
    }

    private notifyListeners() {
        this.listeners.forEach((listener) => listener(this.state));
    }
}
