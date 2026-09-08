import { challengeOutcome } from './outcome';
import type { LeaderboardEntry } from '../leaderboard';

const entry = (progress: number, score: number, timestamp: number): LeaderboardEntry => ({
    nickname: 'P',
    progress,
    score,
    timestamp,
});

test('one attempt is still pending — nobody to beat yet', () => {
    expect(challengeOutcome([entry(5, 500, 100)], 100)).toBe('pending');
});

test('no attempts at all is pending', () => {
    expect(challengeOutcome([], 100)).toBe('pending');
});

test('an unplayed device is pending even with two attempts', () => {
    expect(challengeOutcome([entry(9, 900, 200), entry(5, 500, 100)], null)).toBe('pending');
});

test('the top attempt wins when it is mine', () => {
    expect(challengeOutcome([entry(9, 900, 200), entry(5, 500, 100)], 200)).toBe('won');
});

test('the top attempt wins when it is theirs', () => {
    expect(challengeOutcome([entry(9, 900, 200), entry(5, 500, 100)], 100)).toBe('lost');
});

test('equal progress and equal score is a draw, not a win', () => {
    expect(challengeOutcome([entry(5, 500, 100), entry(5, 500, 200)], 100)).toBe('draw');
    expect(challengeOutcome([entry(5, 500, 100), entry(5, 500, 200)], 200)).toBe('draw');
});

test('a zero-zero round is a draw for both players', () => {
    expect(challengeOutcome([entry(0, 0, 100), entry(0, 0, 200)], 100)).toBe('draw');
});

test('equal progress but a higher score is a win', () => {
    expect(challengeOutcome([entry(5, 700, 200), entry(5, 500, 100)], 200)).toBe('won');
});
