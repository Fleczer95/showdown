import type { LadderRun } from '../../ladder/logic';
import { reachedRung, RUN_LENGTH } from '../../ladder/logic';
import type { DropState } from '../../drop/logic';
import type { GameState } from '../../wheel/logic';
import { ladderScore, dropScore, wheelScore } from '../../scoring';
import type { ChallengeResult } from '../ChallengeHandoff';

export interface LadderCheckpoint {
    run: LadderRun;
    hidden: number[];
    audience: number[] | null;
    base: number;
    speed: number;
    quickWit: boolean;
}
export interface DropCheckpoint {
    state: DropState;
    allocation: number[];
    speed: number;
    next?: DropState;
}
export interface WheelCheckpoint {
    game: GameState;
    phase: 'awaitSpin' | 'awaitGuess' | 'resolving';
    spinValue: number;
    filled: string[];
    solveMode: boolean;
    pendingNext: GameState | null;
    wrongGuess: string | null;
    speed: number;
    clean: number;
    boughtVowel: boolean;
    solved: number;
    sawBankrupt: boolean;
    bankruptRecovered: boolean;
}
export function ladderResult(c: LadderCheckpoint): ChallengeResult | undefined {
    if (c.run.status === 'active') return;
    return {
        progress: c.run.status === 'won' ? RUN_LENGTH : c.run.currentIndex,
        run: {
            gameId: 'the-ladder',
            score: ladderScore({ base: c.base, speed: c.speed, usedLifelines: c.run.usedLifelines.length }).total,
            won: c.run.status === 'won',
            rungReached: reachedRung(c.run),
            lifelinesUsed: c.run.usedLifelines.length,
            quickWit: c.quickWit,
        },
    };
}
export function dropResult(c: DropCheckpoint): ChallengeResult | undefined {
    const state = c.next ?? c.state;
    if (state.status !== 'over') return;
    const won = state.bank > 0;
    const roundsSurvived = Math.max(0, won ? state.round : state.round - 1);
    return {
        progress: roundsSurvived,
        run: {
            gameId: 'the-drop',
            score: dropScore({ bank: state.bank, roundsSurvived, speed: c.speed }).total,
            won,
            finalBank: state.bank,
            roundsSurvived,
        },
    };
}
export function wheelResult(c: WheelCheckpoint): ChallengeResult | undefined {
    const game = c.pendingNext ?? c.game;
    if (game.status !== 'over' && game.status !== 'lost') return;
    return {
        progress: c.solved,
        run: {
            gameId: 'the-wheel',
            score: wheelScore({ bankedCash: game.score, speed: c.speed, cleanPuzzles: c.clean }).total,
            won: game.status === 'over',
            puzzlesSolved: c.solved,
            cleanPuzzles: c.clean,
            bankruptRecovered: c.bankruptRecovered,
        },
    };
}
