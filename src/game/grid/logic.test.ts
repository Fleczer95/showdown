import {
    buildBoard,
    revealCell,
    applyResult,
    isBoardComplete,
    winningTeam,
    findCell,
    type GridState,
} from './logic';
import { getGridPack, type GridContentPack } from './content';

const pack = getGridPack('all');

// Deterministic rng so column/category order is stable across runs.
const fixedRng = () => 0;

function freshBoard(teams = 2): GridState {
    return buildBoard(pack, teams, fixedRng);
}

describe('buildBoard', () => {
    it('creates a score per team and starts on team 0', () => {
        const state = buildBoard(pack, 3, fixedRng);
        expect(state.scores).toEqual([0, 0, 0]);
        expect(state.activeTeam).toBe(0);
        expect(state.status).toBe('playing');
    });

    it('sorts clues ascending by value within each category', () => {
        const state = freshBoard();
        for (const column of state.cells) {
            const values = column.map((c) => c.value);
            expect(values).toEqual([...values].sort((a, b) => a - b));
        }
    });

    it('throws with fewer than 2 teams', () => {
        expect(() => buildBoard(pack, 1, fixedRng)).toThrow();
    });
});

describe('applyResult', () => {
    it('correct adds the cell value to the active team and advances the turn', () => {
        const state = freshBoard();
        const cell = state.cells[0][2]; // value 300
        const next = applyResult(state, cell.id, true);
        expect(next.scores[0]).toBe(cell.value);
        expect(next.scores[1]).toBe(0);
        expect(next.activeTeam).toBe(1);
        expect(findCell(next, cell.id)?.revealed).toBe(true);
    });

    it('wrong subtracts the cell value from the active team and advances the turn', () => {
        const state = freshBoard();
        const cell = state.cells[0][1]; // value 200
        const next = applyResult(state, cell.id, false);
        expect(next.scores[0]).toBe(-cell.value);
        expect(next.activeTeam).toBe(1);
    });

    it('rotates the turn across all N teams and wraps back to 0', () => {
        let state = buildBoard(pack, 3, fixedRng);
        const ids = state.cells[0].map((c) => c.id);
        state = applyResult(state, ids[0], true);
        expect(state.activeTeam).toBe(1);
        state = applyResult(state, ids[1], true);
        expect(state.activeTeam).toBe(2);
        state = applyResult(state, ids[2], true);
        expect(state.activeTeam).toBe(0);
    });
});

describe('revealCell', () => {
    it('marks a cell revealed without touching scores or turn', () => {
        const state = freshBoard();
        const cell = state.cells[1][0];
        const next = revealCell(state, cell.id);
        expect(findCell(next, cell.id)?.revealed).toBe(true);
        expect(next.scores).toEqual(state.scores);
        expect(next.activeTeam).toBe(state.activeTeam);
    });
});

describe('board completion and winner', () => {
    it('detects board complete and sets status over after the last cell', () => {
        let state = freshBoard();
        const allIds = state.cells.flatMap((col) => col.map((c) => c.id));
        for (const id of allIds) {
            expect(state.status).toBe('playing');
            state = applyResult(state, id, true);
        }
        expect(isBoardComplete(state)).toBe(true);
        expect(state.status).toBe('over');
    });

    it('resolves the winning team by highest score', () => {
        const state: GridState = { ...freshBoard(), scores: [300, 700] };
        expect(winningTeam(state)).toBe(1);
    });

    it('returns null on a draw', () => {
        const state: GridState = { ...freshBoard(), scores: [500, 500] };
        expect(winningTeam(state)).toBeNull();
    });
});

describe('content pack', () => {
    it('falls back to the all board for unknown ids', () => {
        const fallback: GridContentPack = getGridPack('nope');
        expect(fallback.id).toBe('all');
    });

    it('provides 5 categories each with 5 clues', () => {
        expect(pack.categories).toHaveLength(5);
        for (const c of pack.categories) {
            expect(c.clues).toHaveLength(5);
        }
    });
});
