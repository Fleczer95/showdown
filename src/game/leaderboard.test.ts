import { rankEntries, qualifies, insertEntry, BOARD_SIZE, type LeaderboardEntry } from './leaderboard';

const entry = (score: number, timestamp: number, nickname = 'P', progress = 0): LeaderboardEntry => ({
    nickname,
    progress,
    score,
    timestamp,
});

// Build a full board of BOARD_SIZE entries with descending scores 100,90,...,10
// (all at equal progress, so the score tiebreak is what's under test).
const fullBoard = (): LeaderboardEntry[] =>
    Array.from({ length: BOARD_SIZE }, (_, i) => entry((BOARD_SIZE - i) * 10, i + 1));

describe('rankEntries', () => {
    it('ranks by progress descending before score', () => {
        const ranked = rankEntries([entry(9999, 1, 'shallow', 1), entry(100, 2, 'deep', 5), entry(500, 3, 'mid', 3)]);
        expect(ranked.map((e) => e.nickname)).toEqual(['deep', 'mid', 'shallow']);
    });

    it('breaks equal progress by score descending', () => {
        const ranked = rankEntries([entry(10, 1, 'lo', 3), entry(30, 2, 'hi', 3), entry(20, 3, 'mid', 3)]);
        expect(ranked.map((e) => e.score)).toEqual([30, 20, 10]);
    });

    it('breaks equal progress and score oldest-first (smaller timestamp ranks higher)', () => {
        const ranked = rankEntries([entry(50, 200, 'new', 3), entry(50, 100, 'old', 3)]);
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
        expect(qualifies([entry(100, 1)], 0, 1)).toBe(true);
    });

    it('qualifies with more progress even when the score is lower', () => {
        // Full board, all progress 0; a deeper run with a tiny score still gets in.
        expect(qualifies(fullBoard(), 1, 1)).toBe(true);
    });

    it('does not qualify with less progress even when the score is higher', () => {
        const board = Array.from({ length: BOARD_SIZE }, (_, i) => entry(10, i + 1, 'P', 5));
        expect(qualifies(board, 4, 99999)).toBe(false);
    });

    it('qualifies when strictly greater than the lowest at equal progress', () => {
        expect(qualifies(fullBoard(), 0, 11)).toBe(true); // lowest is 10
    });

    it('does not qualify when equal to the lowest at equal progress', () => {
        expect(qualifies(fullBoard(), 0, 10)).toBe(false);
    });

    it('does not qualify when below the lowest at equal progress', () => {
        expect(qualifies(fullBoard(), 0, 5)).toBe(false);
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
