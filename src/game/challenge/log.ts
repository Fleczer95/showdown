import { createMMKV } from 'react-native-mmkv';

// Local index of challenges this device has created or opened (ADR-0003 has no
// server-side "my challenges" list, since identity is just a device UUID). It
// lets the player leave a challenge and resume it later, and powers the
// Challenge History screen. Firestore stays the source of truth for the frozen
// round and every result; this is only a lightweight pointer + local status.

const storage = createMMKV({ id: 'showdown-challenges' });
const KEY = 'log';

/** Whether this device created the challenge or received it from a shared link. */
export type ChallengeRole = 'created' | 'received';

/** Derived play state for a list row. Pure function of the stub + current time. */
export type ChallengeStatus = 'yourTurn' | 'played' | 'expired';

/**
 * A local pointer to a challenge. Holds just enough to render a list row and
 * deep-link back into the full Challenge screen, plus this device's own play
 * status (the opponent's result is never stored locally).
 */
export interface ChallengeStub {
    id: string;
    game: string;
    role: ChallengeRole;
    /** The creator's nickname (the opponent for a received challenge; empty for one you created). */
    opponent: string;
    /** True once this device has submitted its attempt. */
    played: boolean;
    /** Epoch ms of the last create/open/play touch — used to sort newest first. */
    updatedAt: number;
    /** Epoch ms when the Firestore record is pruned (ADR-0003 TTL). */
    expiresAt: number;
}

function readAll(): Record<string, ChallengeStub> {
    const json = storage.getString(KEY);
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, ChallengeStub>) : {};
    } catch {
        return {};
    }
}

function writeAll(map: Record<string, ChallengeStub>): void {
    storage.set(KEY, JSON.stringify(map));
}

/**
 * Upsert a stub when a challenge is created or opened. Refreshes metadata and
 * bumps `updatedAt`, but never downgrades a `played` flag back to false (a
 * reopen of an already-played challenge must stay "played").
 */
export function recordChallenge(stub: Omit<ChallengeStub, 'updatedAt'>): void {
    const map = readAll();
    const prev = map[stub.id];
    map[stub.id] = {
        ...stub,
        played: stub.played || prev?.played === true,
        updatedAt: Date.now(),
    };
    writeAll(map);
}

/** Flag this device's attempt as submitted. No-op if the challenge isn't indexed. */
export function markChallengePlayed(id: string): void {
    const map = readAll();
    const stub = map[id];
    if (!stub) return;
    map[id] = { ...stub, played: true, updatedAt: Date.now() };
    writeAll(map);
}

/** Every indexed challenge, newest touch first. */
export function listChallenges(): ChallengeStub[] {
    return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Derive the row status from a stub and the current time. */
export function challengeStatus(stub: ChallengeStub, now: number = Date.now()): ChallengeStatus {
    if (stub.expiresAt <= now) return 'expired';
    return stub.played ? 'played' : 'yourTurn';
}
