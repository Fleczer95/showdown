import type { BucketId } from './buckets';

export interface LinePool {
    keys: string[];
    escalation?: { thresholds: number[]; keys: string[] };
}

export const LINES: Record<BucketId, LinePool> = {
    'level-up': { keys: ['mascot.levelUp.1', 'mascot.levelUp.2', 'mascot.levelUp.3'] },
    'challenge-win': { keys: ['mascot.challengeWin.1', 'mascot.challengeWin.2', 'mascot.challengeWin.3'] },
    'run-won': { keys: ['mascot.runWon.1', 'mascot.runWon.2', 'mascot.runWon.3', 'mascot.runWon.4'] },
    'run-lost': { keys: ['mascot.runLost.1', 'mascot.runLost.2', 'mascot.runLost.3', 'mascot.runLost.4'] },
    'challenge-in': { keys: ['mascot.challengeIn.1', 'mascot.challengeIn.2'] },
    'offline-limit': { keys: ['mascot.offlineLimit.1', 'mascot.offlineLimit.2'] },
    unlock: { keys: ['mascot.unlock.1', 'mascot.unlock.2'] },
    'look-equipped': { keys: ['mascot.lookEquipped.1', 'mascot.lookEquipped.2', 'mascot.lookEquipped.3'] },
    'challenge-out': { keys: ['mascot.challengeOut.1', 'mascot.challengeOut.2'] },
    // expression-only buckets still carry keys so a future spoken experiment has copy ready
    streak: {
        keys: ['mascot.streak.1'],
        escalation: {
            thresholds: [3, 5, 10],
            keys: ['mascot.streak.tier1', 'mascot.streak.tier2', 'mascot.streak.tier3'],
        },
    },
    clutch: { keys: ['mascot.clutch.1'] },
    'all-in': { keys: ['mascot.allIn.1'] },
    greeting: { keys: ['mascot.greeting.1', 'mascot.greeting.2', 'mascot.greeting.3', 'mascot.greeting.4'] },
    idle: { keys: ['mascot.idle.1', 'mascot.idle.2', 'mascot.idle.3', 'mascot.idle.4', 'mascot.idle.5'] },
};

export function poolFor(id: BucketId): LinePool {
    return LINES[id];
}
