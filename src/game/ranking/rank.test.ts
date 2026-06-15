import { sortByScore, visibleBoard, qualifies, resolveDisplayedMonth } from './rank';
import { monthBucketId, previousMonthBucketId, DISPLAY_SIZE, STORE_CAP, ROLLOVER_THRESHOLD } from './config';
import type { RankingEntry } from './types';

const e = (score: number, nickname = 'P'): RankingEntry => ({ nickname, score });

describe('sortByScore', () => {
    it('ranks by score descending', () => {
        expect(sortByScore([e(10), e(30), e(20)]).map((x) => x.score)).toEqual([30, 20, 10]);
    });

    it('keeps incoming order for equal scores (stable)', () => {
        const ranked = sortByScore([e(50, 'a'), e(50, 'b'), e(50, 'c')]);
        expect(ranked.map((x) => x.nickname)).toEqual(['a', 'b', 'c']);
    });
});

describe('visibleBoard', () => {
    it('caps at DISPLAY_SIZE', () => {
        const many = Array.from({ length: DISPLAY_SIZE + 25 }, (_, i) => e(i));
        expect(visibleBoard(many)).toHaveLength(DISPLAY_SIZE);
    });
});

describe('qualifies', () => {
    it('always qualifies when the bucket has room', () => {
        expect(qualifies(STORE_CAP - 1, 999, 1)).toBe(true);
    });

    it('on a full bucket, only a strictly higher score qualifies', () => {
        expect(qualifies(STORE_CAP, 100, 101)).toBe(true);
        expect(qualifies(STORE_CAP, 100, 100)).toBe(false);
        expect(qualifies(STORE_CAP, 100, 99)).toBe(false);
    });
});

describe('resolveDisplayedMonth', () => {
    it('shows current once it reaches the threshold', () => {
        expect(resolveDisplayedMonth({ currentCount: ROLLOVER_THRESHOLD, previousCount: 50 })).toBe('current');
    });

    it('shows previous while current is below threshold and previous has entries', () => {
        expect(resolveDisplayedMonth({ currentCount: ROLLOVER_THRESHOLD - 1, previousCount: 30 })).toBe('previous');
    });

    it('keeps showing previous even once the current month has a few (< threshold) entries', () => {
        expect(resolveDisplayedMonth({ currentCount: 1, previousCount: 30 })).toBe('previous');
    });

    it('shows current (sparse) when neither month qualifies — at most one month back', () => {
        expect(resolveDisplayedMonth({ currentCount: 2, previousCount: 0 })).toBe('current');
    });
});

describe('month bucket helpers', () => {
    it('formats a UTC YYYY-MM bucket id', () => {
        expect(monthBucketId(Date.UTC(2026, 5, 15))).toBe('2026-06');
        expect(monthBucketId(Date.UTC(2026, 0, 1))).toBe('2026-01');
    });

    it('steps back a month, including across a year boundary', () => {
        expect(previousMonthBucketId('2026-06')).toBe('2026-05');
        expect(previousMonthBucketId('2026-01')).toBe('2025-12');
    });
});
