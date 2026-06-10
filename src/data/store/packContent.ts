// Bridge: turn owned premium packs into content the games can play.
//
// The store catalog (PackDefinition) handles purchase + lock state; these
// accessors are the ONLY path that feeds an owned pack's cards into a run.
// Free content still lives in each game's content.ts and is merged separately
// by the game's own adapter — these functions return ONLY the owned-pack cards.

import { getPackContent, getPlayablePackIds } from './catalog';

/**
 * Already-localized cards from every pack the player can use for a game (free
 * packs + owned premium packs). Used by games that localize content up front
 * (The Ladder, The Wheel). Returns an empty array when nothing is owned.
 */
export function getOwnedPackContent<TCard>(
    gameId: string,
    locale: string,
    ownedIds: ReadonlySet<string>,
): TCard[] {
    return getPlayablePackIds(gameId, ownedIds).flatMap((id) => getPackContent<TCard>(id, locale));
}

/**
 * Bilingual cards reconstructed from a pack's parallel en/pl arrays, for games
 * that keep bilingual content and localize at render time (The Drop). `zip`
 * combines the i-th English and Polish card into the game's bilingual shape.
 *
 * Cards are authored content, so parity (same length, same order) is expected
 * but not enforced upstream. A pack whose en/pl arrays disagree is skipped
 * whole — a missing translation would otherwise crash the run as `zip` reads an
 * undefined card — and warned about so the bad pack is diagnosable.
 */
export function getOwnedPackContentBilingual<TMono, TCard>(
    gameId: string,
    ownedIds: ReadonlySet<string>,
    zip: (en: TMono, pl: TMono) => TCard,
): TCard[] {
    return getPlayablePackIds(gameId, ownedIds).flatMap((id) => {
        const en = getPackContent<TMono>(id, 'en');
        const pl = getPackContent<TMono>(id, 'pl');
        if (en.length !== pl.length) {
            console.warn(
                `[packContent] Skipping pack "${id}": en/pl length mismatch (${en.length} vs ${pl.length}).`,
            );
            return [];
        }
        return en.map((card, i) => zip(card, pl[i]));
    });
}
