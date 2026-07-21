import {
    getEntryForId,
    hasBuyablePacks,
    getGamePackIds,
    gameIdForPack,
    premiumPackCount,
    ownsAllPremiumPacks,
} from './catalog';

describe('getEntryForId', () => {
    it('returns the matching catalog entry', () => {
        expect(getEntryForId('theme-cyberpunk')?.presentation.titleKey).toBe('screen.store.item.theme_cyberpunk.title');
    });

    it('returns undefined for an unknown id', () => {
        expect(getEntryForId('not-an-entry')).toBeUndefined();
    });
});

describe('hasBuyablePacks', () => {
    it('is true when a game has a live premium pack the player does not own', () => {
        expect(hasBuyablePacks('the-ladder', new Set())).toBe(true);
    });

    it('is false once every pack for the game is owned', () => {
        const ownsAll = new Set(getGamePackIds('the-ladder'));
        expect(hasBuyablePacks('the-ladder', ownsAll)).toBe(false);
    });

    it('is false for a game with no packs', () => {
        expect(hasBuyablePacks('nope', new Set())).toBe(false);
    });
});

describe('gameIdForPack', () => {
    it('returns the gameId for a known pack', () => {
        const [packId] = getGamePackIds('the-ladder');
        expect(gameIdForPack(packId)).toBe('the-ladder');
    });

    it('returns undefined for an unknown id', () => {
        expect(gameIdForPack('not-a-pack')).toBeUndefined();
    });

    it('returns undefined for a theme id', () => {
        expect(gameIdForPack('theme-champion')).toBeUndefined();
    });
});

describe('premiumPackCount', () => {
    it('counts the live premium packs for a game', () => {
        expect(premiumPackCount('the-ladder')).toBeGreaterThan(0);
    });

    it('is 0 for a game with no packs', () => {
        expect(premiumPackCount('nope')).toBe(0);
    });
});

describe('ownsAllPremiumPacks', () => {
    it('is false when the player owns nothing', () => {
        expect(ownsAllPremiumPacks('the-ladder', new Set())).toBe(false);
    });

    it('is true once every pack for the game is owned', () => {
        const ownsAll = new Set(getGamePackIds('the-ladder'));
        expect(ownsAllPremiumPacks('the-ladder', ownsAll)).toBe(true);
    });

    it('is false for a game with no premium packs (nothing to complete)', () => {
        expect(ownsAllPremiumPacks('nope', new Set())).toBe(false);
    });
});
