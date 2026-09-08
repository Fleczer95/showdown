import { deviceStore } from '../../../storage/appStores';
import type { ChallengeRecord } from '../types';
import type { ChallengeResult } from '../ChallengeHandoff';
import type { LeaderboardEntry } from '../../leaderboard';
import type { RecordRunDiff } from '../../progression/types';
import { playDeadline } from '../../../../shared/events/definitions';

const KEY = 'challenge-sessions-v1';
// The journal is re-parsed on every read and re-serialised on every decision the
// player commits, so its size is felt on the JS thread during play. Cap it the
// way the challenge log caps its own index.
const MAX_SESSIONS = 50;
export class UnsupportedSessionError extends Error {
    constructor() {
        super('Unsupported or unreadable challenge save; no data was reset');
    }
}
export interface ChallengeSession {
    version: 1;
    id: string;
    challengeId: string;
    deviceId: string;
    record: ChallengeRecord;
    nickname: string;
    startedAt: number;
    status: 'active' | 'completed' | 'abandoned';
    /** Admitted friend invitation, but the player has not chosen Start yet.
     * Missing on older saves means play already started; never reset those runs. */
    awaitingStart?: boolean;
    checkpoint?: unknown;
    elapsedMs: number;
    completedAt?: number;
    result?: ChallengeResult;
    attempt?: LeaderboardEntry;
    effectsSettled?: boolean;
    celebration?: RecordRunDiff;
    celebrationSeen?: boolean;
    upload?: 'pending' | 'sent' | 'closed';
    chargeDate?: string;
}
export interface PendingEventStart {
    requestId: string;
    editionId: string;
    game: string;
    mode: 'friend' | 'random';
    challengeId?: string;
    record: ChallengeRecord;
    nickname: string;
}
interface SessionStore {
    version: 1;
    sessions: Record<string, ChallengeSession>;
    usage: Record<string, Record<string, string[]>>;
    pendingStart?: PendingEventStart;
}
export function participationId(challengeId: string, deviceId: string): string {
    return `${challengeId}/${deviceId}`;
}
// Wheel's logical state contains Sets. Explicit tags keep round-tripping lossless;
// these are app-authored device-local checkpoints, never remote object hydration.
function encode(value: unknown): string {
    return JSON.stringify(value, (_, v) => (v instanceof Set ? { $sessionSet: [...v] } : v));
}
function readStore(): SessionStore {
    const raw = deviceStore.getString(KEY);
    if (!raw) return { version: 1, sessions: {}, usage: {} };
    let state: SessionStore;
    try {
        state = JSON.parse(raw, (_, v) =>
            v && Array.isArray(v.$sessionSet) ? new Set(v.$sessionSet) : v,
        ) as SessionStore;
    } catch {
        throw new UnsupportedSessionError();
    }
    // Never silently replace an unreadable/newer save with a fresh paid run.
    if (!state || state.version !== 1 || !state.sessions || !state.usage) throw new UnsupportedSessionError();
    return state;
}
/**
 * Keep the most recent sessions, and never drop one the app still needs: an
 * unfinished run, an unsettled completion, or a result whose upload is still
 * pending. Older settled runs stay visible in history through the challenge log,
 * and reopening one resolves its result from the server.
 */
function prune(state: SessionStore): SessionStore {
    const sessions = Object.values(state.sessions);
    if (sessions.length <= MAX_SESSIONS) return state;
    state.sessions = Object.fromEntries(
        sessions
            .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
            .filter((s, i) => i < MAX_SESSIONS || sessionNeedsHistory(s))
            .map((s) => [s.id, s]),
    );
    return state;
}
function save(state: SessionStore): void {
    deviceStore.set(KEY, encode(prune(state)));
}
export function getSession(id: string): ChallengeSession | undefined {
    const session = readStore().sessions[id];
    if (session && session.version !== 1) throw new UnsupportedSessionError();
    return session;
}
export function listSessions(): ChallengeSession[] {
    return Object.values(readStore().sessions);
}
export function getCheckpoint<T>(id?: string): T | undefined {
    return id ? (getSession(id)?.checkpoint as T | undefined) : undefined;
}
export function getPendingEventStart(): PendingEventStart | undefined {
    return readStore().pendingStart;
}
export function setPendingEventStart(pending: PendingEventStart): void {
    const state = readStore();
    if (state.pendingStart && state.pendingStart.requestId !== pending.requestId)
        throw new Error('Resolve pending event start first');
    state.pendingStart = pending;
    save(state);
}
export function clearPendingEventStart(requestId: string): void {
    const state = readStore();
    if (state.pendingStart?.requestId === requestId) {
        delete state.pendingStart;
        save(state);
    }
}
export function eventUsage(editionId: string, date: string): number {
    return readStore().usage[editionId]?.[date]?.length ?? 0;
}
/** Session and allowance charge become durable in the SAME write, before play. */
export function startSession(
    input: Pick<ChallengeSession, 'challengeId' | 'deviceId' | 'record' | 'nickname' | 'awaitingStart'>,
    checkpoint: unknown,
    eventCharge?: { date: string; cap: number; requestId: string },
    now = Date.now(),
): ChallengeSession {
    const state = readStore();
    const id = participationId(input.challengeId, input.deviceId);
    if (state.sessions[id]) return state.sessions[id];
    if (now >= playDeadline(input.record)) throw new Error('Challenge play window closed');
    const session: ChallengeSession = {
        ...input,
        version: 1,
        id,
        checkpoint,
        startedAt: now,
        status: 'active',
        elapsedMs: 0,
    };
    if (input.record.event) {
        if (!eventCharge || state.pendingStart?.requestId !== eventCharge.requestId)
            throw new Error('Event admission required');
        const editionId = input.record.event.editionId;
        const days = state.usage[editionId] ?? {};
        const charged = days[eventCharge.date] ?? [];
        if (charged.length >= eventCharge.cap) throw new Error('Event allowance exhausted');
        state.usage[editionId] = { ...days, [eventCharge.date]: [...charged, id] };
        session.chargeDate = eventCharge.date;
        delete state.pendingStart;
    }
    state.sessions[id] = session;
    save(state);
    return session;
}
/** Confirm an already-admitted invitation locally. Never re-charge or rebuild its deck. */
export function beginSessionPlay(id: string, nickname: string, now = Date.now()): boolean {
    const state = readStore();
    const session = state.sessions[id];
    if (!session || session.status !== 'active' || now >= playDeadline(session.record)) return false;
    if (session.awaitingStart) {
        state.sessions[id] = { ...session, awaitingStart: false, nickname };
        save(state);
    }
    return true;
}

/** Every game calls this BEFORE exposing a committed decision or its outcome. */
export function checkpointSession(
    id: string,
    checkpoint: unknown,
    elapsedMs: number,
    result?: ChallengeResult,
    now = Date.now(),
): boolean {
    const state = readStore();
    const previous = state.sessions[id];
    if (!previous || previous.status !== 'active' || previous.awaitingStart || now >= playDeadline(previous.record))
        return false;
    const next: ChallengeSession = { ...previous, checkpoint, elapsedMs };
    if (result) {
        next.status = 'completed';
        next.completedAt = now;
        next.result = result;
        next.attempt = {
            nickname: previous.nickname,
            progress: result.progress,
            score: result.run.score,
            timestamp: now,
        };
        next.upload = 'pending';
    }
    state.sessions[id] = next;
    save(state);
    return true;
}
export function updateSessionEffects(
    id: string,
    update: Pick<ChallengeSession, 'effectsSettled' | 'upload' | 'celebration' | 'celebrationSeen'>,
): void {
    const state = readStore();
    const session = state.sessions[id];
    if (!session || session.status !== 'completed') return;
    state.sessions[id] = { ...session, ...update };
    save(state);
}
export function abandonSession(id: string): void {
    const state = readStore();
    const session = state.sessions[id];
    if (session?.status !== 'active') return;
    state.sessions[id] = { ...session, status: 'abandoned' };
    save(state);
}
export function sessionNeedsHistory(session: ChallengeSession, now = Date.now()): boolean {
    return (
        (session.status === 'active' && now < playDeadline(session.record)) ||
        (session.status === 'completed' && (!session.effectsSettled || session.upload === 'pending'))
    );
}
