export type Surface = 'home' | 'game' | 'store' | 'progress' | 'challenge' | 'mascot' | 'other';

export type EventName =
    | 'app-open'
    | 'home-focus'
    | 'idle'
    | 'tip'
    | 'run-won'
    | 'run-lost'
    | 'streak-milestone'
    | 'clutch'
    | 'all-in-survived'
    | 'level-up'
    | 'unlock'
    | 'look-equipped'
    | 'challenge-received'
    | 'challenge-beaten'
    | 'challenge-sent'
    | 'offline-limit';

export interface MascotScope {
    surface: Surface;
    roundId?: string;
    questionId?: string;
    navSeq: number; // monotonically bumped on every navigation
}

export interface EventContext {
    gameId?: string;
    streak?: number;
    count?: number;
    [k: string]: string | number | boolean | undefined;
}

export interface MascotEvent {
    name: EventName;
    scope: MascotScope;
    ctx: EventContext;
    at: number; // ms epoch, injected by the director's clock
}

const GAMEPLAY = new Set<EventName>(['run-won', 'run-lost', 'streak-milestone', 'clutch', 'all-in-survived']);

export function isGameplayEvent(name: EventName): boolean {
    return GAMEPLAY.has(name);
}
