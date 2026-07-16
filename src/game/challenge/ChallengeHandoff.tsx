import { useEffect, useRef } from 'react';
import type { GameRunResult } from '../progression';

/**
 * Bridges a game's play screen back to the Challenge orchestrator. When a run
 * ends in challenge mode, the play screen renders this instead of its normal
 * game-over view: it reports the rankable result exactly once, then renders
 * nothing while the Challenge screen takes over (submit → reveal).
 */
export interface ChallengeResult {
    /** How far the run got — the leaderboard's primary ranking key. */
    progress: number;
    /** The run's full facts: the unified points score (the tie-breaker, as
     * `run.score`) plus everything the progression engine records. */
    run: GameRunResult;
}

export function ChallengeHandoff({
    progress,
    run,
    onComplete,
}: {
    progress: number;
    run: GameRunResult;
    onComplete: (result: ChallengeResult) => void;
}) {
    const reported = useRef(false);
    useEffect(() => {
        if (reported.current) return;
        reported.current = true;
        onComplete({ progress, run });
        // Report once; the score is fixed the moment the run ends.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

/** Shared shape a play screen accepts to run a frozen challenge round instead of a fresh deck. */
export interface ChallengePlay<TInitial> {
    /** The frozen, locale-resolved initial state to play. */
    initial: TInitial;
    /** Question ids the player owns; only these are marked shown during the run. */
    ownedIds: ReadonlySet<string>;
    /** Called once with the run's result when it ends. */
    onComplete: (result: ChallengeResult) => void;
}
