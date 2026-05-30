import { useMemo } from 'react';
import { STORE_CATALOG } from '../../data/store/catalog';
import { resolveEntries, type ResolvedEntry } from '../../data/store/resolver';
import type { CatalogEntry, PackDefinition, ThemeDefinition } from '../../data/store/types';
import { useStore } from './useStore';

/**
 * The thin React bridge to the Store Catalog. Ownership is the only thing
 * these hooks touch: they read `purchasedItemIds` off the reactive `useStore()`
 * context, wrap it in a `ReadonlySet`, and hand it to the pure resolver — so
 * they re-render on purchase. All lock/visibility logic lives in the resolver.
 */

/** Every catalog entry (packs + themes), resolved. Hidden entries dropped by default. */
export function useResolvedStoreEntries(opts?: { includeHidden?: boolean }): ResolvedEntry<CatalogEntry>[] {
    const { purchasedItemIds } = useStore();
    const includeHidden = opts?.includeHidden ?? false;
    return useMemo(
        () => resolveEntries(STORE_CATALOG, new Set(purchasedItemIds), { includeHidden }),
        [purchasedItemIds, includeHidden],
    );
}

/**
 * The packs for one game, resolved. Generic over the game's card type so
 * migrated callers keep strict typing; un-migrated games still flow through
 * as legacy entries, hence the cast — safe because no caller reads `content`
 * until its game owns a native registry.
 */
export function useResolvedPacks<TCard = unknown>(
    gameId: string,
    opts?: { includeHidden?: boolean },
): ResolvedEntry<PackDefinition<TCard>>[] {
    const { purchasedItemIds } = useStore();
    const includeHidden = opts?.includeHidden ?? false;
    return useMemo(() => {
        const packs = STORE_CATALOG.filter((entry) => entry.kind === 'pack' && entry.gameId === gameId);
        return resolveEntries(packs, new Set(purchasedItemIds), { includeHidden }) as ResolvedEntry<
            PackDefinition<TCard>
        >[];
    }, [purchasedItemIds, gameId, includeHidden]);
}

/** Every theme entry, resolved. Hidden entries dropped by default. */
export function useResolvedThemes(opts?: { includeHidden?: boolean }): ResolvedEntry<ThemeDefinition>[] {
    const { purchasedItemIds } = useStore();
    const includeHidden = opts?.includeHidden ?? false;
    return useMemo(() => {
        const themeEntries = STORE_CATALOG.filter((entry): entry is ThemeDefinition => entry.kind === 'theme');
        return resolveEntries(themeEntries, new Set(purchasedItemIds), { includeHidden });
    }, [purchasedItemIds, includeHidden]);
}
