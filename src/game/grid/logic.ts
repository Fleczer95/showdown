// Pure game logic for "The Grid" (Jeopardy-style, team pass-and-play).
// No React / react-native imports.

import type { GridContentPack, LocalizedString } from './content';

export interface GridCell {
    /** Stable id: `${categoryIndex}-${rowIndex}`. */
    id: string;
    categoryIndex: number;
    value: number;
    clue: LocalizedString;
    answer: LocalizedString;
    revealed: boolean;
}

export interface GridCategory {
    title: LocalizedString;
}

export interface GridState {
    categories: GridCategory[];
    /** Column-major: cells[categoryIndex][rowIndex]. */
    cells: GridCell[][];
    /** Score per team, indexed by team number (0-based). */
    scores: number[];
    /** Index of the team whose turn it is. */
    activeTeam: number;
    status: 'playing' | 'over';
}

/** Fisher-Yates shuffle returning a new array. */
function shuffle<T>(items: T[], rng: () => number): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Build a fresh board from a content pack for the given number of teams.
 * Categories are shuffled (column order); within each category clues are
 * sorted ascending by value so point rows line up across columns.
 */
export function buildBoard(pack: GridContentPack, teams: number, rng: () => number = Math.random): GridState {
    if (teams < 2) {
        throw new Error(`Need at least 2 teams, got ${teams}`);
    }
    const categories = shuffle(pack.categories, rng);
    const cells = categories.map((category, categoryIndex) => {
        const clues = category.clues.slice().sort((a, b) => a.value - b.value);
        return clues.map((clue, rowIndex) => ({
            id: `${categoryIndex}-${rowIndex}`,
            categoryIndex,
            value: clue.value,
            clue: clue.clue,
            answer: clue.answer,
            revealed: false,
        }));
    });
    return {
        categories: categories.map((c) => ({ title: c.title })),
        cells,
        scores: new Array(teams).fill(0),
        activeTeam: 0,
        status: 'playing',
    };
}

/** Find a cell by id, or undefined. */
export function findCell(state: GridState, cellId: string): GridCell | undefined {
    for (const column of state.cells) {
        for (const cell of column) {
            if (cell.id === cellId) {
                return cell;
            }
        }
    }
    return undefined;
}

/** Mark a cell as revealed (the clue is shown). No score change here. */
export function revealCell(state: GridState, cellId: string): GridState {
    if (state.status !== 'playing') {
        return state;
    }
    return updateCell(state, cellId, (cell) => ({ ...cell, revealed: true }));
}

/**
 * Resolve the active team's answer for a cell.
 * Correct → add the cell value to the active team's score.
 * Wrong → subtract the cell value (scores may go negative).
 * Either way the cell stays revealed and the turn advances to the next team.
 */
export function applyResult(state: GridState, cellId: string, correct: boolean): GridState {
    if (state.status !== 'playing') {
        return state;
    }
    const cell = findCell(state, cellId);
    if (!cell) {
        return state;
    }
    const delta = correct ? cell.value : -cell.value;
    const scores = state.scores.slice();
    scores[state.activeTeam] += delta;
    const revealed = updateCell(state, cellId, (c) => ({ ...c, revealed: true }));
    const nextTeam = (state.activeTeam + 1) % state.scores.length;
    const next: GridState = { ...revealed, scores, activeTeam: nextTeam };
    return isBoardComplete(next) ? { ...next, status: 'over' } : next;
}

/** True when every cell has been revealed. */
export function isBoardComplete(state: GridState): boolean {
    return state.cells.every((column) => column.every((cell) => cell.revealed));
}

/**
 * Winning team index, or null for a draw (tie at the top score).
 */
export function winningTeam(state: GridState): number | null {
    let best = -Infinity;
    let winner = -1;
    let tie = false;
    state.scores.forEach((score, team) => {
        if (score > best) {
            best = score;
            winner = team;
            tie = false;
        } else if (score === best) {
            tie = true;
        }
    });
    return tie ? null : winner;
}

function updateCell(state: GridState, cellId: string, fn: (cell: GridCell) => GridCell): GridState {
    const cells = state.cells.map((column) =>
        column.map((cell) => (cell.id === cellId ? fn(cell) : cell)),
    );
    return { ...state, cells };
}
