import { currentStreak, longestStreak } from './streak';

describe('longestStreak', () => {
    it('is 0 for no days', () => {
        expect(longestStreak([])).toBe(0);
    });

    it('counts the longest consecutive run, ignoring order and duplicates', () => {
        expect(longestStreak(['2026-06-01', '2026-06-02', '2026-06-03'])).toBe(3);
        expect(longestStreak(['2026-06-03', '2026-06-01', '2026-06-02', '2026-06-02'])).toBe(3);
    });

    it('resets across gaps and keeps the best run', () => {
        // run of 2, gap, run of 4
        expect(
            longestStreak(['2026-06-01', '2026-06-02', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13']),
        ).toBe(4);
    });

    it('handles month boundaries', () => {
        expect(longestStreak(['2026-05-30', '2026-05-31', '2026-06-01'])).toBe(3);
    });
});

describe('currentStreak', () => {
    it('counts consecutive days ending today', () => {
        expect(currentStreak(['2026-06-08', '2026-06-09', '2026-06-10'], '2026-06-10')).toBe(3);
    });

    it('stays alive on a new day if yesterday was played but today is not yet', () => {
        expect(currentStreak(['2026-06-08', '2026-06-09'], '2026-06-10')).toBe(2);
    });

    it('is 0 when neither today nor yesterday was played', () => {
        expect(currentStreak(['2026-06-01', '2026-06-02'], '2026-06-10')).toBe(0);
    });

    it('is 0 for no days', () => {
        expect(currentStreak([], '2026-06-10')).toBe(0);
    });
});
