export interface PurchasePersistencePort {
    getPurchasedItems(): string[];
    savePurchasedItem(id: string): void;
    clearPurchases(): void;
}
