// Game Stats event shaping. Two events carry everything; the individual STATS are
// defined console-side as aggregations over these properties (see
// .agents/game-services/game_stats/), which is why this file stays this small —
// adding a stat is usually a CSV row, not code.
//
// Every property is always present, never conditionally omitted: PGS validates each
// event against the console schema and silently drops mismatches, so a missing
// property would cost the player that stat with no error anywhere.

import { recordStatsEvent } from '../../../modules/game-services';
import { level } from '../../game/progression/map';
import type { GameRunResult, ProgressionStats } from '../../game/progression/types';

export interface StatsEvent {
    name: string;
    properties: Record<string, string | number | boolean>;
}

/** Repetitive event — one per finished run, whatever the game. */
export function runCompletedEvent(result: GameRunResult): StatsEvent {
    return {
        name: 'runCompleted',
        properties: {
            gameId: result.gameId,
            score: result.score,
            isWinner: result.won,
            rungReached: result.rungReached ?? 0,
            lifelinesUsed: result.lifelinesUsed ?? 0,
            isChallenge: result.challenge ?? false,
        },
    };
}

/** Progression event — where the player stands on the Level Map right now. */
export function progressUpdateEvent(stats: ProgressionStats): StatsEvent {
    return {
        name: 'progressUpdate',
        properties: { currentProgress: level(stats.lifetimeXp) },
    };
}

/**
 * Report both events for a finished run. Called from the progression seam so every
 * run reports exactly once, and both events go together — the progress update is
 * what keeps the Level stat honest even for a run that changed nothing else.
 */
export async function reportRunStats(result: GameRunResult, stats: ProgressionStats): Promise<void> {
    const run = runCompletedEvent(result);
    const progress = progressUpdateEvent(stats);
    await recordStatsEvent(run.name, run.properties);
    await recordStatsEvent(progress.name, progress.properties);
}
