// Per-run XP: floor + skill + breadth. Pure; unit-tested in isolation.

import { RUN_XP_FLOOR, SKILL_CAP, BREADTH_BONUS } from './constants';
import type { GameRunResult } from './types';

/**
 * Each game's own normalized result, in 0..1, so games are comparable despite
 * wildly different raw scales. Missing facts read as 0. An unrecognized gameId is
 * a wiring bug (a new game added without an XP rule here) — throw so it surfaces in
 * tests/dev rather than silently paying that game 0 XP forever.
 */
export function performanceFraction(result: GameRunResult): number {
    let raw: number;
    switch (result.gameId) {
        case 'the-ladder':
            raw = (result.rungReached ?? 0) / 15;
            break;
        case 'the-drop':
            raw = (result.finalBank ?? 0) / 1_000_000;
            break;
        case 'the-wheel':
            raw = (result.puzzlesSolved ?? 0) / 3;
            break;
        default:
            throw new Error(`performanceFraction: no XP rule for gameId "${result.gameId}"`);
    }
    return Math.max(0, Math.min(1, raw));
}

/** Skill term: 0..SKILL_CAP scaled by the run's normalized performance. */
export function skillXp(result: GameRunResult): number {
    return Math.round(SKILL_CAP * performanceFraction(result));
}

/**
 * XP earned by a single run. The breadth bonus is paid only on the first play of
 * this game on the current local day, so the caller passes whether it was already
 * played today.
 */
export function runXp(result: GameRunResult, alreadyPlayedTodayThisGame: boolean): number {
    // A run that achieved nothing earns nothing — no floor, no breadth. You have to
    // put something on the board (a rung, a bank, a solved puzzle) to gain XP.
    if (performanceFraction(result) === 0) return 0;
    const breadth = alreadyPlayedTodayThisGame ? 0 : BREADTH_BONUS;
    return RUN_XP_FLOOR + skillXp(result) + breadth;
}
