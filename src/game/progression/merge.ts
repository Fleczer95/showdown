// Cross-device conflict resolution for cloud save. Legal because ProgressionStats
// is monotonic: nothing it holds ever decreases, so the union/max of two devices
// is always a state the player genuinely reached. That is what lets cloud save
// skip timestamps, "last write wins", and any conflict UI.
//
// Two fields are counters rather than high-water marks (runsPlayed, challengesPlayed,
// and the per-game win tallies) and therefore sum. lifetimeXp deliberately does NOT
// sum: both devices have already been credited the shared history, so summing would
// inflate levels and hand out rewards the player never earned.

import type { ProgressionStats } from './types';

const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])].sort();

function maxByKey(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = Math.max(out[key] ?? 0, value);
    return out;
}

function sumByKey(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = (out[key] ?? 0) + value;
    return out;
}

/** Merge two devices' raw stats. Commutative, and idempotent on the maxed fields. */
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
        runsPlayed: a.runsPlayed + b.runsPlayed,
        winsByGame: sumByKey(a.winsByGame, b.winsByGame),
        datesPlayed: union(a.datesPlayed, b.datesPlayed),
        today,
        todayGameIds,
        bestScoreByGame: maxByKey(a.bestScoreByGame, b.bestScoreByGame),
        feats: union(a.feats, b.feats),
        challengesPlayed: a.challengesPlayed + b.challengesPlayed,
    };
}
