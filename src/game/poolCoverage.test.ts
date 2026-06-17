import { countSeen, poolCoverage } from './poolCoverage';
import { getHistory } from './history';
import { ownedQuestionIds } from './challenge/resolve';

jest.mock('./history', () => ({ getHistory: jest.fn() }));
jest.mock('./challenge/resolve', () => ({ ownedQuestionIds: jest.fn() }));

const mockHistory = getHistory as jest.MockedFunction<typeof getHistory>;
const mockOwned = ownedQuestionIds as jest.MockedFunction<typeof ownedQuestionIds>;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('countSeen', () => {
    it('counts only ids shown at least once', () => {
        const history = { a: 3, b: 0, c: 1 };
        expect(countSeen(['a', 'b', 'c', 'd'], history)).toBe(2);
    });

    it('is zero against an empty history', () => {
        expect(countSeen(['a', 'b'], {})).toBe(0);
    });
});

describe('poolCoverage', () => {
    it('reports seen distinct questions out of the full owned pool', () => {
        mockOwned.mockReturnValue(new Set(['a', 'b', 'c', 'd']));
        mockHistory.mockReturnValue({ a: 2, c: 5 });
        expect(poolCoverage('the-ladder', new Set())).toEqual({ seen: 2, total: 4 });
    });

    it('ignores history for ids outside the owned pool', () => {
        // An unowned premium pack's questions can sit in history (e.g. seen via a
        // challenge) but must not inflate the count beyond the pool size.
        mockOwned.mockReturnValue(new Set(['a', 'b']));
        mockHistory.mockReturnValue({ a: 1, b: 1, premiumOnly: 9 });
        expect(poolCoverage('the-ladder', new Set())).toEqual({ seen: 2, total: 2 });
    });
});
