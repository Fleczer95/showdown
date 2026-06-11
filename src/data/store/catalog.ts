import { gamePacks } from './packs';
import { resolveEntryState } from './resolver';
import { themes } from './themes';
import type { CatalogEntry } from './types';

/**
 * Every purchasable entry across all games + themes, typed as the discriminated
 * union. Ordered games-first, then themes.
 *
 * ShowDown skeleton: game packs are added per-game during the content phase
 * (e.g. `...theLadderPacks`). Today only cosmetic themes ship.
 */
export const STORE_CATALOG: readonly CatalogEntry[] = [...gamePacks, ...(themes ?? [])];

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
