// Mock the catalog so cap math is deterministic regardless of shipped content:
// a premium theme + a premium pack (both count) + a free theme (never counts).
jest.mock('../../data/store/catalog', () => ({
    STORE_CATALOG: [
        { id: 'theme-a', kind: 'theme', tier: 'premium', status: 'live' },
        { id: 'pack-a', kind: 'pack', tier: 'premium', status: 'live' },
        { id: 'theme-free', kind: 'theme', tier: 'free', status: 'live' },
    ],
}));

import {
    BASE_DAILY_CAP,
    premiumItemsOwned,
    totalPremiumItems,
    dailyCap,
    canUpsell,
} from './limit';

describe('premiumItemsOwned', () => {
    it('counts owned premium items — themes and packs alike, never free entries', () => {
        const owned = new Set(['theme-a', 'pack-a', 'theme-free']);
        expect(premiumItemsOwned(owned)).toBe(2);
    });

    it('is zero with nothing owned', () => {
        expect(premiumItemsOwned(new Set())).toBe(0);
    });
});

describe('dailyCap', () => {
    it('is the base cap with no premium items', () => {
        expect(dailyCap(new Set())).toBe(BASE_DAILY_CAP);
    });

    it('adds one per owned premium item, theme or pack', () => {
        expect(dailyCap(new Set(['theme-a']))).toBe(BASE_DAILY_CAP + 1);
        expect(dailyCap(new Set(['theme-a', 'pack-a']))).toBe(BASE_DAILY_CAP + 2);
    });

    it('never counts a free item', () => {
        expect(dailyCap(new Set(['theme-free']))).toBe(BASE_DAILY_CAP);
    });
});

describe('canUpsell', () => {
    it('totalPremiumItems reflects the catalog', () => {
        expect(totalPremiumItems()).toBe(2);
    });

    it('is true while a premium item remains unowned', () => {
        expect(canUpsell(new Set(['theme-a']))).toBe(true);
    });

    it('is false once every premium item is owned', () => {
        expect(canUpsell(new Set(['theme-a', 'pack-a']))).toBe(false);
    });
});
