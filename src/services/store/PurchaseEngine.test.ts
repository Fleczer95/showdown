import { PurchaseEngine } from './PurchaseEngine';
import { PurchasePersistencePort } from './PurchasePersistencePort';

function makePersistence(purchased: string[] = [], premium = false): PurchasePersistencePort {
    const items = [...purchased];
    let premiumActive = premium;
    return {
        getPurchasedItems: jest.fn(() => [...items]),
        savePurchasedItem: jest.fn((id) => items.push(id)),
        clearPurchases: jest.fn(),
        getPremiumActive: jest.fn(() => premiumActive),
        setPremiumActive: jest.fn((active: boolean) => {
            premiumActive = active;
        }),
    };
}

describe('PurchaseEngine.isPurchased', () => {
    it('returns false for an item that has not been bought', () => {
        const engine = new PurchaseEngine(makePersistence());
        expect(engine.isPurchased('fw-pack-adults')).toBe(false);
    });

    it('returns true for a previously purchased item', () => {
        const engine = new PurchaseEngine(makePersistence(['fw-pack-adults']));
        expect(engine.isPurchased('fw-pack-adults')).toBe(true);
    });
});

describe('PurchaseEngine.markAsPurchased', () => {
    it('records a new purchase', () => {
        const engine = new PurchaseEngine(makePersistence());
        engine.markAsPurchased('fw-pack-adults');
        expect(engine.isPurchased('fw-pack-adults')).toBe(true);
    });

    it('is a no-op for an already-purchased item but clears processing state', () => {
        const persistence = makePersistence(['fw-pack-adults']);
        const engine = new PurchaseEngine(persistence);
        engine.setProcessing(true);
        engine.markAsPurchased('fw-pack-adults');
        expect(persistence.savePurchasedItem).not.toHaveBeenCalled();
        expect(engine.getState().isProcessing).toBe(false);
    });
});

describe('PurchaseEngine.reconcilePurchasedItem', () => {
    it('records a new entitlement without clearing another operation processing state', () => {
        const engine = new PurchaseEngine(makePersistence());
        engine.setProcessing(true);

        expect(engine.reconcilePurchasedItem('fw-pack-adults')).toBe(true);
        expect(engine.isPurchased('fw-pack-adults')).toBe(true);
        expect(engine.getState().isProcessing).toBe(true);
    });

    it('returns false for an entitlement already recorded and preserves processing state', () => {
        const persistence = makePersistence(['fw-pack-adults']);
        const engine = new PurchaseEngine(persistence);
        engine.setProcessing(true);

        expect(engine.reconcilePurchasedItem('fw-pack-adults')).toBe(false);
        expect(persistence.savePurchasedItem).not.toHaveBeenCalled();
        expect(engine.getState().isProcessing).toBe(true);
    });
});

describe('PurchaseEngine.setPremiumActive', () => {
    it('seeds premiumActive from persistence', () => {
        expect(new PurchaseEngine(makePersistence([], true)).getState().premiumActive).toBe(true);
        expect(new PurchaseEngine(makePersistence()).getState().premiumActive).toBe(false);
    });

    it('persists and broadcasts a status change, but no-ops when unchanged', () => {
        const persistence = makePersistence();
        const engine = new PurchaseEngine(persistence);
        engine.setPremiumActive(true);
        expect(engine.getState().premiumActive).toBe(true);
        expect(persistence.setPremiumActive).toHaveBeenCalledTimes(1);
        engine.setPremiumActive(true); // unchanged
        expect(persistence.setPremiumActive).toHaveBeenCalledTimes(1);
    });
});

describe('PurchaseEngine.setProcessing', () => {
    it('updates the processing state', () => {
        const engine = new PurchaseEngine(makePersistence());
        expect(engine.getState().isProcessing).toBe(false);
        engine.setProcessing(true);
        expect(engine.getState().isProcessing).toBe(true);
        engine.setProcessing(false);
        expect(engine.getState().isProcessing).toBe(false);
    });
});
