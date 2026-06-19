export interface PurchasePersistencePort {
    getPurchasedItems(): string[];
    savePurchasedItem(id: string): void;
    clearPurchases(): void;
    /** Cached Premium-subscription flag — the offline fallback for `isPremium`. */
    getPremiumActive(): boolean;
    setPremiumActive(active: boolean): void;
}
