import { computeCoverage, poolCoverage } from './poolCoverage';
import { getHistory } from './history';
import { ownedQuestionIds } from './challenge/resolve';

jest.mock('./history', () => ({ getHistory: jest.fn() }));
jest.mock('./challenge/resolve', () => ({ ownedQuestionIds: jest.fn() }));

const mockHistory = getHistory as jest.MockedFunction<typeof getHistory>;
const mockOwned = ownedQuestionIds as jest.MockedFunction<typeof ownedQuestionIds>;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('computeCoverage', () => {
    it('reports seen, floor, and reseen mid first lap', () => {
        // a,c shown; b,d unshown → floor 0, seen 2, reseen (count > 0) 2.
        expect(computeCoverage(['a', 'b', 'c', 'd'], { a: 3, b: 0, c: 1 })).toEqual({
            seen: 2,
            total: 4,
            floor: 0,
            reseen: 2,
        });
    });

    it('reports laps once the pool is fully cycled', () => {
        // Every id shown ≥1 → floor 1 (one full lap); reseen (count > 1) = just `a`.
        expect(computeCoverage(['a', 'b', 'c'], { a: 2, b: 1, c: 1 })).toEqual({
            seen: 3,
            total: 3,
            floor: 1,
            reseen: 1,
        });
    });

    it('is empty for an empty pool', () => {
        expect(computeCoverage([], {})).toEqual({ seen: 0, total: 0, floor: 0, reseen: 0 });
    });
});

describe('poolCoverage', () => {
    it('measures coverage against the full owned pool', () => {
        mockOwned.mockReturnValue(new Set(['a', 'b', 'c', 'd']));
        mockHistory.mockReturnValue({ a: 2, c: 5 });
        expect(poolCoverage('the-ladder', new Set())).toEqual({ seen: 2, total: 4, floor: 0, reseen: 2 });
    });

    it('ignores history for ids outside the owned pool', () => {
        // An unowned premium pack's questions can sit in history (e.g. seen via a
        // challenge) but must not inflate the count beyond the pool size.
        mockOwned.mockReturnValue(new Set(['a', 'b']));
        mockHistory.mockReturnValue({ a: 1, b: 1, premiumOnly: 9 });
        expect(poolCoverage('the-ladder', new Set())).toEqual({ seen: 2, total: 2, floor: 1, reseen: 0 });
    });
});
