// Cross-device conflict resolution for cloud save. Legal because ProgressionStats
// is monotonic: nothing it holds ever decreases, so the union/max of two devices
// is always a state the player genuinely reached. That is what lets cloud save
// skip timestamps, "last write wins", and any conflict UI.
//
// EVERY field merges with max or union — nothing sums. That is not a stylistic
// choice: restore merges local state with a cloud slot that already contains the
// same history, so a summed counter doubles on every launch (10 → 20 → 40 → 80).
// Idempotence is the hard requirement here, and only max and union have it.
//
// The cost is real and accepted: runs played offline on a second device are not
// added to the first device's tally, they are compared against it. Under-counting
// a player's runs is recoverable; inflating them silently corrupts the whole
// progression spine, since achievements and levels derive from these numbers.

import type { ProgressionStats } from './types';

const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])].sort();

function maxByKey(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = Math.max(out[key] ?? 0, value);
    return out;
}

function unionByKey(a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = union(a[key] ?? [], b[key] ?? []);
    return out;
}

/**
 * Whether `next` keeps everything `prev` had earned. The merge cannot violate this
 * by construction — every field goes through max or union, and `max(a,b) >= a` — so
 * this is not a proof, it is a tripwire at the one place that overwrites a real
 * player's progress. If someone later adds a field that can decrease, or breaks the
 * merge, this turns silent data loss into a refused write.
 *
 * `today` and `todayGameIds` are deliberately unguarded: the day-roll legitimately
 * clears them, and yesterday's game set must not suppress today's breadth bonus.
 */
export function preservesProgress(prev: ProgressionStats, next: ProgressionStats): boolean {
    if (next.lifetimeXp < prev.lifetimeXp) return false;
    if (next.runsPlayed < prev.runsPlayed) return false;
    if (next.challengesPlayed < prev.challengesPlayed) return false;

    for (const [key, value] of Object.entries(prev.winsByGame)) {
        if ((next.winsByGame[key] ?? 0) < value) return false;
    }
    for (const [key, value] of Object.entries(prev.bestScoreByGame)) {
        if ((next.bestScoreByGame[key] ?? 0) < value) return false;
    }

    const dates = new Set(next.datesPlayed);
    if (prev.datesPlayed.some((d) => !dates.has(d))) return false;
    const feats = new Set(next.feats);
    if (prev.feats.some((f) => !feats.has(f))) return false;

    for (const [id, count] of Object.entries(prev.eventCompletedRuns ?? {})) {
        if ((next.eventCompletedRuns?.[id] ?? 0) < count) return false;
    }
    for (const [id, won] of Object.entries(prev.eventWinIds ?? {})) {
        const kept = new Set(next.eventWinIds?.[id] ?? []);
        if (won.some((challengeId) => !kept.has(challengeId))) return false;
    }
    if ((prev.eventRewardGrants ?? []).some((id) => !next.eventRewardGrants?.includes(id))) return false;
    if ((prev.earnedRewardIds ?? []).some((id) => !next.earnedRewardIds?.includes(id))) return false;
    if (Object.keys(prev.completionReceipts ?? {}).some((id) => !next.completionReceipts?.[id])) return false;
    return true;
}

/** Merge two devices' raw stats. Commutative, associative, and idempotent. */
export function mergeStats(a: ProgressionStats, b: ProgressionStats): ProgressionStats {
    const today = a.today >= b.today ? a.today : b.today;
    // Only the later day's game set survives: the breadth bonus asks "which games
    // has this player already played *today*", and yesterday's answer would wrongly
    // suppress today's bonus.
    const todayGameIds =
        a.today === b.today
            ? union(a.todayGameIds, b.todayGameIds)
            : [...(a.today === today ? a.todayGameIds : b.todayGameIds)];

    return {
        lifetimeXp: Math.max(a.lifetimeXp, b.lifetimeXp),
        runsPlayed: Math.max(a.runsPlayed, b.runsPlayed),
        winsByGame: maxByKey(a.winsByGame, b.winsByGame),
        datesPlayed: union(a.datesPlayed, b.datesPlayed),
        today,
        todayGameIds,
        bestScoreByGame: maxByKey(a.bestScoreByGame, b.bestScoreByGame),
        feats: union(a.feats, b.feats),
        challengesPlayed: Math.max(a.challengesPlayed, b.challengesPlayed),
        eventCompletedRuns: maxByKey(a.eventCompletedRuns ?? {}, b.eventCompletedRuns ?? {}),
        eventRewardGrants: union(a.eventRewardGrants ?? [], b.eventRewardGrants ?? []),
        earnedRewardIds: union(a.earnedRewardIds ?? [], b.earnedRewardIds ?? []),
        eventWinIds: unionByKey(a.eventWinIds ?? {}, b.eventWinIds ?? {}),
        completionReceipts: { ...a.completionReceipts, ...b.completionReceipts },
    };
}
