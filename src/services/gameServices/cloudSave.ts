// Cloud save on top of Play Saved Games. Restore is deliberately a MERGE, never a
// replace: a player who played offline on a second device must not lose that run
// just because the cloud slot is older. mergeStats makes that safe — every field
// of ProgressionStats is monotonic, so the union is always a state the player
// genuinely reached.
//
// This module takes and returns stats rather than reading them: recordRun imports
// it to push after every run, so reaching back into recordRun's persistence would
// be an import cycle. Loading and saving stays the caller's job.
//
// An absent or unreadable payload yields null, never a reset. Local MMKV is the one
// thing we are certain about; the cloud is a mirror, not the source of truth.

import { readCloudSave, writeCloudSave } from '../../../modules/game-services';
import { mergeStats, preservesProgress } from '../../game/progression/merge';
import { defaultStats } from '../../game/progression/defaults';
import type { ProgressionStats } from '../../game/progression/types';
import { SafeSentry } from '../../utils/sentry/init';

/** Serialize and store the given stats. False when the write didn't land. */
export function pushToCloud(stats: ProgressionStats): Promise<boolean> {
    return writeCloudSave(JSON.stringify(stats));
}

/** Narrow enough to know mergeStats won't be handed a string, array, or null. */
function isStatsShaped(value: unknown): value is Partial<ProgressionStats> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pull the cloud slot and merge it into `local`, pushing the union back so both
 * devices converge. Returns the merged stats for the caller to persist, or null
 * when there was nothing usable to merge and local state should stand.
 */
export async function restoreFromCloud(local: ProgressionStats): Promise<ProgressionStats | null> {
    const payload = await readCloudSave();
    if (!payload) return null;

    let remote: unknown;
    try {
        remote = JSON.parse(payload);
    } catch {
        remote = undefined;
    }

    if (!isStatsShaped(remote)) {
        // Not ordinary: the only writer of this slot is us. Worth knowing about,
        // but never worth destroying local progress over.
        SafeSentry.captureMessage('Cloud save payload was unreadable', {
            level: 'warning',
            tags: { area: 'game-services' },
        });
        return null;
    }

    // Defaults — not local values — fill any field an older app version never
    // wrote: zero and the empty set are the identity elements for the max/sum/union
    // merge, so a missing remote field leaves local untouched. Filling from local
    // instead would double every counter.
    const merged = mergeStats(local, { ...defaultStats(), ...remote });
    await pushToCloud(merged);
    return merged;
}

/**
 * Restore and persist in one step, reading local state twice: once as merge input
 * and once at write time. That second read is the point — the cloud round-trip is
 * slow enough for a run to land while it is in flight, and writing a merge built
 * from pre-flight state would erase that run. Merging again is free because
 * mergeStats is idempotent.
 *
 * Takes its persistence as callbacks: recordRun imports this module, so importing
 * its store back would be a cycle.
 */
/**
 * What a restore actually did. The caller needs the distinction to tell the player
 * something true: "we pulled your progress across" and "we refused to write" are
 * different events, and "the cloud had nothing new" must stay silent — otherwise the
 * message would fire on every single launch.
 */
export type RestoreOutcome =
    | { status: 'restored'; stats: ProgressionStats }
    | { status: 'unchanged' }
    | { status: 'blocked' }
    | { status: 'none' };

export async function restoreAndPersist(
    load: () => ProgressionStats,
    save: (stats: ProgressionStats) => void,
): Promise<RestoreOutcome> {
    const merged = await restoreFromCloud(load());
    if (!merged) return { status: 'none' };

    const local = load();
    const next = mergeStats(local, merged);

    // The one destructive write in this feature: it overwrites a real player's
    // progress, and MMKV has no undo. The merge cannot produce a worse state by
    // construction, so reaching this branch means the invariant broke — refuse the
    // write and keep what the player has rather than trust the arithmetic.
    if (!preservesProgress(local, next)) {
        SafeSentry.captureMessage('Cloud restore would have lost progress — write refused', {
            level: 'error',
            tags: { area: 'game-services' },
            extra: {
                localXp: local.lifetimeXp,
                nextXp: next.lifetimeXp,
                localRuns: local.runsPlayed,
                nextRuns: next.runsPlayed,
            },
        });
        return { status: 'blocked' };
    }

    // "Neither is worse than the other" is equality on everything that counts, and
    // it reuses the guard rather than inventing a second comparison. Skipping the
    // write here also removes a pointless MMKV round-trip on every quiet launch.
    if (preservesProgress(next, local)) return { status: 'unchanged' };

    save(next);
    return { status: 'restored', stats: next };
}
