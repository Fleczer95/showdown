import { gamePacks } from './packs';
import { mascotSkins } from './mascotSkins';
import { resolveEntryState } from './resolver';
import { themes } from './themes';
import type { CatalogEntry } from './types';

/**
 * Every purchasable entry across all games + themes + mascot skins, typed as the
 * discriminated union. Ordered games-first, then themes, then mascot skins.
 *
 * ShowDown skeleton: game packs are added per-game during the content phase
 * (e.g. `...theLadderPacks`).
 */
export const STORE_CATALOG: readonly CatalogEntry[] = [...gamePacks, ...(themes ?? []), ...mascotSkins];

const idToEntry = new Map<string, CatalogEntry>();
const idToSku = new Map<string, string>();
const skuToId = new Map<string, string>();
for (const entry of STORE_CATALOG) {
    idToEntry.set(entry.id, entry);
    if (entry.sku) {
        idToSku.set(entry.id, entry.sku);
        skuToId.set(entry.sku, entry.id);
    }
}

/** Canonical id → SKU lookup, derived from the catalog. */
export function getSkuForId(id: string): string | undefined {
    return idToSku.get(id);
}

/** Canonical SKU → id lookup, derived from the catalog. */
export function getIdForSku(sku: string): string | undefined {
    return skuToId.get(sku);
}

/** Every SKU in the catalog. */
export const ALL_SKUS: string[] = STORE_CATALOG.flatMap((entry) => (entry.sku ? [entry.sku] : []));

/** Locale-selected card content for a pack. Empty array for unknown / non-pack ids. */
export function getPackContent<TCard>(packId: string, locale: string): TCard[] {
    const entry = idToEntry.get(packId);
    if (!entry || entry.kind !== 'pack') return [];
    const localized = locale.startsWith('pl') ? entry.content.pl : entry.content.en;
    return localized as TCard[];
}

/**
 * Every pack id for a game, owned or not. Used to resolve an Async Challenge's
 * frozen question ids: all packs ship bundled on-device, so a challenge can pin
 * a premium pack's question even for a player who hasn't bought it.
 */
export function getGamePackIds(gameId: string): string[] {
    return STORE_CATALOG.filter((entry) => entry.kind === 'pack' && entry.gameId === gameId).map((entry) => entry.id);
}

/**
 * The pack ids a player can actually use for a game: free packs plus owned
 * premium packs. This is what the `all` category selector expands to.
 */
export function getPlayablePackIds(gameId: string, ownedIds: ReadonlySet<string>): string[] {
    return STORE_CATALOG.filter(
        (entry) =>
            entry.kind === 'pack' && entry.gameId === gameId && resolveEntryState(entry, ownedIds) === 'playable',
    ).map((entry) => entry.id);
}

/** Whether an id refers to a premium (paid) catalog entry. Free categories return false. */
export function isPremiumCatalogId(id: string): boolean {
    return idToEntry.get(id)?.tier === 'premium';
}

/**
 * Whether a game still has a premium pack the player can buy (live + unowned).
 * Gates the setup-screen "get more packs" nudge so it never appears once there
 * is nothing left to sell for that game.
 */
export function hasBuyablePacks(gameId: string, ownedIds: ReadonlySet<string>): boolean {
    return STORE_CATALOG.some(
        (entry) => entry.kind === 'pack' && entry.gameId === gameId && resolveEntryState(entry, ownedIds) === 'locked',
    );
}

/** The game a pack id belongs to, or undefined for theme / unknown ids. */
export function gameIdForPack(id: string): string | undefined {
    const entry = idToEntry.get(id);
    return entry?.kind === 'pack' ? entry.gameId : undefined;
}

/**
 * Count of live, premium packs for a game — the denominator of "owns all packs".
 * Hidden (unreleased) packs are excluded so a held-back pack never inflates the
 * total, and free packs don't count because owning them is automatic.
 */
export function premiumPackCount(gameId: string): number {
    return STORE_CATALOG.filter(
        (entry) =>
            entry.kind === 'pack' && entry.gameId === gameId && entry.tier === 'premium' && entry.status === 'live',
    ).length;
}

/**
 * True iff the game has at least one live premium pack AND the player owns every
 * one of them. Free-only games never qualify (nothing to complete), and a game
 * with a still-locked premium pack returns false via `hasBuyablePacks`.
 */
export function ownsAllPremiumPacks(gameId: string, ownedIds: ReadonlySet<string>): boolean {
    return premiumPackCount(gameId) > 0 && !hasBuyablePacks(gameId, ownedIds);
}
