import { STORE_CATALOG } from '../../data/store/catalog';

// Daily challenge-creation limit (ADR-0003 follow-up). Honour-based and
// client-side, in keeping with the ADR's existing honour-based dedup: it
// protects the Firestore free tier and gives premium a tangible perk, without a
// server or auth. A determined user clearing app data to reset the count is the
// same accepted threat model as attempt-dedup.
//
// One GLOBAL counter (challenges created today, all games) is checked against a
// cap that grows by one for every premium item owned. Every catalog-derived
// number stays dynamic so new premium entries lift the cap for free; only the
// two policy constants below are literals.

/** Free baseline: challenges any device can create per day across all games. */
export const BASE_DAILY_CAP = 3;
/** Extra daily challenges granted per owned premium item. */
export const BONUS_PER_PREMIUM_ITEM = 1;
/**
 * Extra daily challenges the Premium subscription adds on top of the normal
 * (base + owned items) cap. Additive, not a flat number, so a subscriber who
 * also owns packs/themes is never capped below what their items already grant.
 * Still finite — challenge creation writes to the Firestore free tier, so an
 * unbounded cap would risk the quota.
 */
export const PREMIUM_BONUS_CHALLENGES = 10;

/** Catalog ids of every premium (paid) item — derived, so new items count automatically. */
function premiumItemIds(): string[] {
    return STORE_CATALOG.filter((e) => e.tier === 'premium' && e.status === 'live').map((e) => e.id);
}

/** How many premium items the player owns. */
export function premiumItemsOwned(ownedIds: ReadonlySet<string>): number {
    return premiumItemIds().filter((id) => ownedIds.has(id)).length;
}

/** Total premium items that exist to buy — gates the "owns them all" upsell. */
export function totalPremiumItems(): number {
    return premiumItemIds().length;
}

/**
 * The device's daily challenge-creation cap (global, all games): the base plus
 * one per owned premium item, plus a flat `PREMIUM_BONUS_CHALLENGES` while the
 * Premium subscription is active.
 */
export function dailyCap(ownedIds: ReadonlySet<string>, isPremium = false): number {
    const cap = BASE_DAILY_CAP + premiumItemsOwned(ownedIds) * BONUS_PER_PREMIUM_ITEM;
    return isPremium ? cap + PREMIUM_BONUS_CHALLENGES : cap;
}

/**
 * Whether there's still a premium item left to buy for more daily challenges.
 * Subscribers already get the raised cap, so there's nothing to upsell.
 */
export function canUpsell(ownedIds: ReadonlySet<string>, isPremium = false): boolean {
    if (isPremium) return false;
    return premiumItemsOwned(ownedIds) < totalPremiumItems();
}
