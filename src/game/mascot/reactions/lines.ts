import type { BucketId } from './buckets';

export interface LinePool {
    keys: string[];
    escalation?: { thresholds: number[]; keys: string[] };
}

const range = (key: string, from: number, to: number): string[] =>
    Array.from({ length: to - from + 1 }, (_, i) => `mascot.${key}.${from + i}`);

export const LINES: Record<BucketId, LinePool> = {
    'level-up': { keys: range('levelUp', 1, 8) },
    'challenge-win': { keys: range('challengeWin', 1, 8) },
    'run-won': { keys: range('runWon', 1, 13) },
    'run-lost': { keys: range('runLost', 1, 13) },
    'challenge-in': { keys: range('challengeIn', 1, 7) },
    'offline-limit': { keys: range('offlineLimit', 1, 5) },
    unlock: { keys: range('unlock', 1, 7) },
    'look-equipped': { keys: range('lookEquipped', 1, 8) },
    'challenge-out': { keys: range('challengeOut', 1, 7) },
    // expression-only buckets still carry keys so a future spoken experiment has copy ready
    streak: {
        keys: range('streak', 1, 6),
        escalation: {
            thresholds: [3, 5, 10],
            keys: ['mascot.streak.tier1', 'mascot.streak.tier2', 'mascot.streak.tier3'],
        },
    },
    clutch: { keys: range('clutch', 1, 6) },
    'all-in': { keys: range('allIn', 1, 6) },
    greeting: { keys: range('greeting', 1, 13) },
    idle: { keys: range('idle', 1, 16) },
    tip: { keys: range('tip', 1, 11) },
};

export function poolFor(id: BucketId): LinePool {
    return LINES[id];
}
