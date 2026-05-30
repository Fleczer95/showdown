import type { CatalogEntry, StoreEntryBase } from './types';

export type EntryState = 'playable' | 'locked' | 'hidden';

/**
 * THE one place lock state is decided. Pure: no singletons, no React.
 *   status === 'hidden'            -> 'hidden'   (absent from every surface)
 *   tier === 'free'                -> 'playable'
 *   tier === 'premium' && owned    -> 'playable'
 *   tier === 'premium' && !owned   -> 'locked'
 *
 * `hidden` beats ownership: the resolver intentionally does NOT keep an owned
 * `hidden` entry playable. That is safe ONLY because `hidden` is pre-release-only
 * — never apply it to an item that has been on sale.
 */
export function resolveEntryState(
    entry: Pick<StoreEntryBase, 'id' | 'status' | 'tier'>,
    ownedIds: ReadonlySet<string>,
): EntryState {
    if (entry.status === 'hidden') return 'hidden';
    if (entry.tier === 'free') return 'playable';
    return ownedIds.has(entry.id) ? 'playable' : 'locked';
}

export interface ResolvedEntry<E extends StoreEntryBase = CatalogEntry> {
    entry: E;
    state: EntryState;
    isPlayable: boolean;
    isLocked: boolean;
    isVisible: boolean;
}

function toResolved<E extends StoreEntryBase>(entry: E, ownedIds: ReadonlySet<string>): ResolvedEntry<E> {
    const state = resolveEntryState(entry, ownedIds);
    return {
        entry,
        state,
        isPlayable: state === 'playable',
        isLocked: state === 'locked',
        isVisible: state !== 'hidden',
    };
}

/** Pure batch resolve; drops hidden entries unless `includeHidden`, preserves order. */
export function resolveEntries<E extends StoreEntryBase>(
    entries: readonly E[],
    ownedIds: ReadonlySet<string>,
    opts?: { includeHidden?: boolean },
): ResolvedEntry<E>[] {
    const resolved = entries.map((entry) => toResolved(entry, ownedIds));
    return opts?.includeHidden ? resolved : resolved.filter((r) => r.isVisible);
}
