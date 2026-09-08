// The zero state, in its own module so consumers that must not depend on the
// persistence seam (cloud save, which recordRun itself imports) can still reach it
// without creating an import cycle. Re-exported from recordRun for compatibility.

import type { ProgressionStats } from './types';

/** Fresh state for a player who has never played. */
export function defaultStats(): ProgressionStats {
    return {
        lifetimeXp: 0,
        runsPlayed: 0,
        winsByGame: {},
        datesPlayed: [],
        today: '',
        todayGameIds: [],
        bestScoreByGame: {},
        feats: [],
        challengesPlayed: 0,
        completionReceipts: {},
        eventCompletedRuns: {},
        eventRewardGrants: [],
        earnedRewardIds: [],
        eventWinIds: {},
    };
}
