import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import type { Purchase } from 'react-native-iap';

const mockGetPurchasesFromStore = jest.fn();
const mockBuyItem = jest.fn();
const mockBuySubscription = jest.fn();
const mockFinishTransaction = jest.fn();
const mockFetchProducts = jest.fn();
let mockIapCallbacks: {
    onPurchaseSuccess: (purchase: Purchase) => Promise<void>;
    onPurchaseError: (error: unknown) => void;
};

jest.mock('react-native-iap', () => ({
    useIAP: jest.fn((callbacks) => {
        mockIapCallbacks = callbacks;
        return {
            connected: true,
            products: [],
            subscriptions: [],
            fetchProducts: mockFetchProducts,
            finishTransaction: mockFinishTransaction,
        };
    }),
}));

jest.mock('../../services/store/IAPService', () => ({
    IAPService: {
        getInstance: () => ({
            getPurchasesFromStore: mockGetPurchasesFromStore,
            buyItem: mockBuyItem,
            buySubscription: mockBuySubscription,
        }),
    },
}));

jest.mock('../../services/store/MMKVPurchaseAdapter', () => ({
    MMKVPurchaseAdapter: class {
        private items: string[] = [];
        private premium = false;

        getPurchasedItems() {
            return [...this.items];
        }
        savePurchasedItem(itemId: string) {
            if (!this.items.includes(itemId)) this.items.push(itemId);
        }
        clearPurchases() {
            this.items = [];
        }
        getPremiumActive() {
            return this.premium;
        }
        setPremiumActive(active: boolean) {
            this.premium = active;
        }
    },
}));

const runtimeGlobal = globalThis as typeof globalThis & { __DEV__: boolean };
const originalDev = runtimeGlobal.__DEV__;
Object.defineProperty(runtimeGlobal, '__DEV__', { value: false, configurable: true });
const { StoreProvider, useStore } = jest.requireActual<typeof import('./useStore')>('./useStore');

type StoreValue = ReturnType<typeof useStore>;
let currentStore: StoreValue;
let appStateListener: ((state: AppStateStatus) => void) | undefined;

function purchase(productId: string): Purchase {
    return { productId, purchaseState: 'purchased' } as Purchase;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function Probe() {
    currentStore = useStore();
    return null;
}

function renderStore() {
    return render(
        <StoreProvider>
            <Probe />
        </StoreProvider>,
    );
}

describe('StoreProvider purchase synchronization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        appStateListener = undefined;
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
            appStateListener = listener;
            return { remove: jest.fn() };
        });
        mockFinishTransaction.mockResolvedValue(undefined);
        mockFetchProducts.mockResolvedValue([]);
        mockBuyItem.mockResolvedValue(undefined);
        mockBuySubscription.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        Object.defineProperty(runtimeGlobal, '__DEV__', { value: originalDev, configurable: true });
    });

    it('runs a fresh store query when foregrounding during an older sync', async () => {
        const firstQuery = deferred<Purchase[] | null>();
        mockGetPurchasesFromStore
            .mockReturnValueOnce(firstQuery.promise)
            .mockResolvedValueOnce([purchase('com.showdown.theme_cyberpunk')]);

        const view = renderStore();
        await waitFor(() => expect(mockGetPurchasesFromStore).toHaveBeenCalledTimes(1));

        act(() => appStateListener?.('active'));
        await act(async () => firstQuery.resolve([]));

        await waitFor(() => expect(mockGetPurchasesFromStore).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(currentStore.autoSyncNotice).toEqual({ itemIds: ['theme-cyberpunk'], premium: false }),
        );
        view.unmount();
    });

    it('returns the actual result when manual restore overlaps a silent sync', async () => {
        const firstQuery = deferred<Purchase[] | null>();
        mockGetPurchasesFromStore.mockReturnValueOnce(firstQuery.promise);

        const view = renderStore();
        await waitFor(() => expect(mockGetPurchasesFromStore).toHaveBeenCalledTimes(1));

        const restoreResult = currentStore.restorePurchases();
        firstQuery.resolve(null);

        await expect(restoreResult).resolves.toBe(false);
        expect(mockGetPurchasesFromStore).toHaveBeenCalledTimes(1);
        view.unmount();
    });

    it('does not let an older empty query undo a newer Premium callback', async () => {
        const firstQuery = deferred<Purchase[] | null>();
        mockGetPurchasesFromStore.mockReturnValueOnce(firstQuery.promise);

        const view = renderStore();
        await waitFor(() => expect(mockGetPurchasesFromStore).toHaveBeenCalledTimes(1));

        await act(async () => mockIapCallbacks.onPurchaseSuccess(purchase('com.showdown.premium_monthly')));
        expect(currentStore.isPremium).toBe(true);

        await act(async () => firstQuery.resolve([]));
        await waitFor(() => expect(currentStore.isPremium).toBe(true));
        view.unmount();
    });

    it('keeps an in-app checkout out of the automatic sync notice', async () => {
        mockGetPurchasesFromStore.mockResolvedValue([]);
        const view = renderStore();
        await waitFor(() => expect(mockGetPurchasesFromStore).toHaveBeenCalledTimes(1));

        await act(async () => currentStore.purchaseItem('theme-cyberpunk'));
        expect(currentStore.isProcessing).toBe(true);

        await act(async () => mockIapCallbacks.onPurchaseSuccess(purchase('com.showdown.theme_cyberpunk')));
        expect(currentStore.purchasedItemIds).toContain('theme-cyberpunk');
        expect(currentStore.isProcessing).toBe(false);
        expect(currentStore.autoSyncNotice).toBeNull();
        view.unmount();
    });
});
