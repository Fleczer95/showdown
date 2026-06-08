import { rankEntries, qualifies, insertEntry, BOARD_SIZE, type LeaderboardEntry } from './leaderboard';

const entry = (score: number, timestamp: number, nickname = 'P'): LeaderboardEntry => ({
    nickname,
    score,
    timestamp,
});

// Build a full board of BOARD_SIZE entries with descending scores 100,90,...,10.
const fullBoard = (): LeaderboardEntry[] =>
    Array.from({ length: BOARD_SIZE }, (_, i) => entry((BOARD_SIZE - i) * 10, i + 1));

describe('rankEntries', () => {
    it('sorts by score descending', () => {
        const ranked = rankEntries([entry(10, 1), entry(30, 2), entry(20, 3)]);
        expect(ranked.map((e) => e.score)).toEqual([30, 20, 10]);
    });

    it('breaks ties oldest-first (smaller timestamp ranks higher)', () => {
        const ranked = rankEntries([entry(50, 200, 'new'), entry(50, 100, 'old')]);
        expect(ranked.map((e) => e.nickname)).toEqual(['old', 'new']);
    });

    it('does not mutate its input', () => {
        const input = [entry(10, 1), entry(20, 2)];
        rankEntries(input);
        expect(input.map((e) => e.score)).toEqual([10, 20]);
    });
});

describe('qualifies', () => {
    it('qualifies when the board has open slots', () => {
        expect(qualifies([entry(100, 1)], 1)).toBe(true);
    });

    it('qualifies when strictly greater than the lowest on a full board', () => {
        expect(qualifies(fullBoard(), 11)).toBe(true); // lowest is 10
    });

    it('does not qualify when equal to the lowest on a full board', () => {
        expect(qualifies(fullBoard(), 10)).toBe(false);
    });

    it('does not qualify when below the lowest on a full board', () => {
        expect(qualifies(fullBoard(), 5)).toBe(false);
    });
});

describe('insertEntry', () => {
    it('adds the entry and returns its rank index when it qualifies', () => {
        const e = entry(25, 999);
        const { board, index } = insertEntry([entry(30, 1), entry(20, 2)], e);
        expect(board.map((x) => x.score)).toEqual([30, 25, 20]);
        expect(index).toBe(1);
    });

    it('caps the board at BOARD_SIZE and reports -1 for a score that fell off', () => {
        const e = entry(5, 999);
        const { board, index } = insertEntry(fullBoard(), e);
        expect(board).toHaveLength(BOARD_SIZE);
        expect(index).toBe(-1);
    });

    it('places a new equal score after the existing one (older wins ties)', () => {
        const older = entry(50, 100, 'old');
        const e = entry(50, 200, 'new');
        const { board, index } = insertEntry([older], e);
        expect(board.map((x) => x.nickname)).toEqual(['old', 'new']);
        expect(index).toBe(1);
    });
});
