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
    };
}
