import { PurchaseEngine } from './PurchaseEngine';
import { PurchasePersistencePort } from './PurchasePersistencePort';

function makePersistence(purchased: string[] = []): PurchasePersistencePort {
    const items = [...purchased];
    return {
        getPurchasedItems: jest.fn(() => [...items]),
        savePurchasedItem: jest.fn((id) => items.push(id)),
        clearPurchases: jest.fn(),
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
