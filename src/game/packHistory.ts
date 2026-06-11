import { getPackSeedTargets } from '../data/store/catalog';
import { seedHistory } from './history';

/**
 * When a premium pack is unlocked, seed its questions to the owning game's
 * current pool floor so the new (paid) content blends into rotation instead of
 * starving the base pool — count-0 questions would otherwise monopolize every
 * deck until they caught up. See `seedDeck`.
 *
 * Safe for every unlock path (purchase, mock buy, restore) and on app restart:
 * `getPackSeedTargets` ignores non-pack ids (themes) and `seedHistory` only
 * writes when a question is genuinely new, so already-seeded packs are a no-op.
 */
export function seedUnlockedPack(itemId: string): void {
    const target = getPackSeedTargets(itemId);
    if (!target) return;
    seedHistory(target.gameId, target.ids);
}
