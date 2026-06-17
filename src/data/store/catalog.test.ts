import { hasBuyablePacks, getGamePackIds } from './catalog';

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
