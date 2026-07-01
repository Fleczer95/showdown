import { resolveBucket, type BucketId } from './buckets';
import { pickLine } from './reactionSelection';
import type { EventContext, EventName, MascotScope, Surface } from './events';
import type { MascotExpression } from './expressions';

export interface DirectorConfig {
    cooldownMs: number;
    navQuietMs: number;
    recentSize: number;
    idleShowMs: number;
    idleGapMs: number;
    now: () => number;
    rand: () => number;
    /** Live surface lookup — avoids racing the async scope update at emit time. */
    getSurface?: () => Surface;
}

// Arrival/ambient Home events are meant to fire ON navigation to Home, so they
// are exempt from the post-navigation quiet window (which guards reactive events).
const AMBIENT: ReadonlySet<EventName> = new Set(['home-focus', 'app-open', 'idle']);

export interface Utterance {
    bucketId: BucketId;
    expression: MascotExpression;
    textKey?: string;
    ctx: EventContext;
}

export interface DirectorState {
    utterance: Utterance | null;
    expression: MascotExpression;
}

export interface Blockers {
    timerRunning: boolean;
    transitioning: boolean;
    modalOpen: boolean;
    purchasePending: boolean;
}

const DEFAULTS: DirectorConfig = {
    cooldownMs: 6000,
    navQuietMs: 600,
    recentSize: 3,
    idleShowMs: 4000,
    idleGapMs: 6000,
    now: () => Date.now(),
    rand: Math.random,
};

export function createReactionDirector(cfg: Partial<DirectorConfig> = {}) {
    const config: DirectorConfig = { ...DEFAULTS, ...cfg };
    let scope: MascotScope = { surface: 'other', navSeq: 0 };
    let blockers: Blockers = { timerRunning: false, transitioning: false, modalOpen: false, purchasePending: false };
    let state: DirectorState = { utterance: null, expression: 'neutral' };
    let lastSpokenAt = -Infinity;
    let lastNavAt = -Infinity;
    let lastPriority = -Infinity;
    const recent: Record<string, string[]> = {};
    const subs = new Set<(s: DirectorState) => void>();

    // Idle drip state.
    let idleOn = false;
    let idlePhase: 'show' | 'gap' = 'gap';
    let idlePhaseUntil = 0;

    const emitState = () => subs.forEach((f) => f(state));

    function anyBlocker(): boolean {
        return blockers.timerRunning || blockers.transitioning || blockers.modalOpen || blockers.purchasePending;
    }

    function currentSurface(): Surface {
        return config.getSurface ? config.getSurface() : scope.surface;
    }

    function surfaceAllowed(name: EventName): boolean {
        const b = resolveBucket(name);
        return b.surfaces === 'all' || b.surfaces.includes(currentSurface());
    }

    function emit(name: EventName, ctx: EventContext = {}) {
        const now = config.now();
        if (anyBlocker()) return;
        if (!AMBIENT.has(name) && now - lastNavAt < config.navQuietMs) return;
        if (!surfaceAllowed(name)) return;

        const bucket = resolveBucket(name);
        const withinCooldown = now - lastSpokenAt < config.cooldownMs;
        const isSpoken = bucket.spoken;

        // Cooldown gates SPOKEN utterances; expression-only changes are always allowed.
        if (isSpoken && withinCooldown && bucket.priority <= lastPriority) return;

        if (isSpoken) {
            const key = pickLine(bucket.id, {
                recent: recent[bucket.id] ?? [],
                count: typeof ctx.count === 'number' ? ctx.count : undefined,
                rand: config.rand,
            });
            recent[bucket.id] = [...(recent[bucket.id] ?? []), key].slice(-config.recentSize);
            state = {
                utterance: { bucketId: bucket.id, expression: bucket.expression, textKey: key, ctx },
                expression: bucket.expression,
            };
            lastSpokenAt = now;
            lastPriority = bucket.priority;
        } else {
            state = {
                ...state,
                utterance: { bucketId: bucket.id, expression: bucket.expression, ctx },
                expression: bucket.expression,
            };
        }
        emitState();
    }

    function stopIdle() {
        idleOn = false;
        if (state.utterance?.bucketId === 'idle') {
            state = { ...state, utterance: null };
            emitState();
        }
    }

    function startIdle() {
        idleOn = true;
        idlePhase = 'gap';
        idlePhaseUntil = config.now();
    }

    function tick() {
        if (!idleOn) return;
        if (currentSurface() !== 'home' || anyBlocker()) return;
        const now = config.now();
        if (now < idlePhaseUntil) return;
        if (idlePhase === 'gap') {
            emit('idle', {});
            idlePhase = 'show';
            idlePhaseUntil = now + config.idleShowMs;
        } else {
            if (state.utterance?.bucketId === 'idle') {
                state = { ...state, utterance: null };
                emitState();
            }
            idlePhase = 'gap';
            idlePhaseUntil = now + config.idleGapMs;
        }
    }

    return {
        emit,
        tick,
        startIdle,
        stopIdle,
        rand: config.rand,
        getState: () => state,
        subscribe(fn: (s: DirectorState) => void) {
            subs.add(fn);
            return () => subs.delete(fn);
        },
        setScope(next: MascotScope) {
            scope = next;
        },
        setBlockers(patch: Partial<Blockers>) {
            blockers = { ...blockers, ...patch };
        },
        onNavigate() {
            stopIdle();
            lastNavAt = config.now();
            scope = { ...scope, navSeq: scope.navSeq + 1 };
            if (state.utterance) {
                state = { ...state, utterance: null };
                emitState();
            }
        },
        onBackground() {
            stopIdle();
            state = { utterance: null, expression: 'neutral' };
            lastPriority = -Infinity;
            emitState();
        },
        // The host calls this when a spoken bubble auto-hides or is dismissed:
        // drop the text but keep the current face.
        clearUtterance() {
            if (state.utterance) {
                state = { ...state, utterance: null };
                emitState();
            }
        },
        reset() {
            idleOn = false;
            state = { utterance: null, expression: 'neutral' };
            lastSpokenAt = -Infinity;
            lastNavAt = -Infinity;
            lastPriority = -Infinity;
            for (const k of Object.keys(recent)) delete recent[k];
            emitState();
        },
    };
}

export type ReactionDirector = ReturnType<typeof createReactionDirector>;
