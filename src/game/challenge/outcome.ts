import { rankEntries, type LeaderboardEntry } from '../leaderboard';

export type ChallengeOutcome = 'won' | 'lost' | 'draw' | 'pending';

/**
 * The verdict for one async round. `attempts` may arrive in any order —
 * callers must not be trusted to rank first (the Worker's own query orders by
 * progress only), so this ranks its own copy before reading a winner.
 *
 * A genuine tie on the ranking key (same progress AND same score) is a draw,
 * not a win — the timestamp tiebreak in rankEntries only fixes row order, it
 * shouldn't crown anyone (e.g. both players score 0). Applies to every game.
 */
export function challengeOutcome(attempts: readonly LeaderboardEntry[], myTimestamp: number | null): ChallengeOutcome {
    // One attempt means this device is the only one that has played — there is
    // no opponent to beat yet.
    if (myTimestamp === null || attempts.length <= 1) return 'pending';
    const ranked = rankEntries([...attempts]);
    const winner = ranked[0];
    const runnerUp = ranked[1];
    if (runnerUp.progress === winner.progress && runnerUp.score === winner.score) return 'draw';
    return winner.timestamp === myTimestamp ? 'won' : 'lost';
}
