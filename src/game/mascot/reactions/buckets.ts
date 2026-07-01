import type { EventName, Surface } from './events';
import type { MascotExpression } from './expressions';

export type BucketId =
    | 'level-up'
    | 'challenge-win'
    | 'run-won'
    | 'run-lost'
    | 'challenge-in'
    | 'offline-limit'
    | 'unlock'
    | 'look-equipped'
    | 'challenge-out'
    | 'streak'
    | 'clutch'
    | 'all-in'
    | 'greeting'
    | 'idle';

export interface BucketDef {
    id: BucketId;
    priority: number;
    spoken: boolean;
    expression: MascotExpression;
    surfaces: Surface[] | 'all';
    escalates?: boolean;
}

const TABLE: Record<EventName, BucketDef> = {
    'level-up': { id: 'level-up', priority: 90, spoken: true, expression: 'happy', surfaces: 'all' },
    'challenge-beaten': { id: 'challenge-win', priority: 85, spoken: true, expression: 'smug', surfaces: ['challenge', 'home'] },
    'run-won': { id: 'run-won', priority: 80, spoken: true, expression: 'happy', surfaces: ['game'] },
    'run-lost': { id: 'run-lost', priority: 78, spoken: true, expression: 'worried', surfaces: ['game'] },
    'challenge-received': { id: 'challenge-in', priority: 70, spoken: true, expression: 'surprised', surfaces: ['challenge', 'home'] },
    'offline-limit': { id: 'offline-limit', priority: 68, spoken: true, expression: 'worried', surfaces: ['home'] },
    unlock: { id: 'unlock', priority: 60, spoken: true, expression: 'happy', surfaces: ['store', 'home'] },
    'look-equipped': { id: 'look-equipped', priority: 58, spoken: true, expression: 'smug', surfaces: ['mascot', 'store'] },
    'challenge-sent': { id: 'challenge-out', priority: 50, spoken: true, expression: 'happy', surfaces: ['challenge', 'other'] },
    'streak-milestone': { id: 'streak', priority: 40, spoken: false, expression: 'happy', surfaces: ['home', 'game'], escalates: true },
    clutch: { id: 'clutch', priority: 38, spoken: false, expression: 'surprised', surfaces: ['game'] },
    'all-in-survived': { id: 'all-in', priority: 36, spoken: false, expression: 'surprised', surfaces: ['game'] },
    'home-focus': { id: 'greeting', priority: 20, spoken: true, expression: 'happy', surfaces: ['home'] },
    'app-open': { id: 'greeting', priority: 20, spoken: true, expression: 'happy', surfaces: ['home'] },
    idle: { id: 'idle', priority: 5, spoken: true, expression: 'neutral', surfaces: ['home'] },
};

export function resolveBucket(name: EventName): BucketDef {
    return TABLE[name];
}
