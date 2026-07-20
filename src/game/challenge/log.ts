import { createMMKV } from 'react-native-mmkv';

// Local index of challenges this device has created or opened (ADR-0003 has no
// server-side "my challenges" list, since identity is just a device UUID). It
// lets the player leave a challenge and resume it later, and powers the
// Challenge History screen. The Worker/D1 backend stays the source of truth for
// the frozen round and every result; this is only a lightweight pointer + status.

const storage = createMMKV({ id: 'showdown-challenges' });
const KEY = 'log';

/** Cap on locally indexed challenges, to bound storage growth. Pruned by
 * `updatedAt`, so the freshest stubs (including today's, which drive the daily
 * creation limit) are always kept. */
const MAX_LOG_ENTRIES = 100;
/** "Later" postpones an incoming rematch banner for exactly one hour. */
export const REMATCH_SNOOZE_MS = 60 * 60 * 1000;

/** Whether this device created the challenge or received it from a shared link. */
export type ChallengeRole = 'created' | 'received';

/** Derived play state for a list row. Pure function of the stub + current time. */
export type ChallengeStatus = 'yourTurn' | 'waitingOpponent' | 'completed' | 'expired';

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
    /** True once a result reveal contains at least one other participant. */
    opponentPlayed?: boolean;
    /** Epoch ms when this stub was first indexed — write-once, never bumped on
     * reopen (unlike `updatedAt`). Drives the daily creation limit so a reopen
     * of an old challenge never counts as a fresh create. */
    createdAt: number;
    /** Epoch ms of the last create/open/play touch — used only for storage pruning. */
    updatedAt: number;
    /** Epoch ms when the online record is pruned (ADR-0003 TTL). */
    expiresAt: number;
    /** Directed 1:1 successor rather than a link-shared first round. */
    isRematch?: boolean;
    /** Immediate predecessor used by inbox sync; absent for first-round challenges. */
    sourceChallengeId?: string;
    /** Whether the incoming-rematch banner was permanently acknowledged. */
    seen?: boolean;
    /** Epoch ms before which "Later" keeps this rematch off Home. */
    snoozedUntil?: number;
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
    const entries = Object.values(map);
    const capped =
        entries.length <= MAX_LOG_ENTRIES
            ? map
            : Object.fromEntries(
                  entries
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .slice(0, MAX_LOG_ENTRIES)
                      .map((s) => [s.id, s]),
              );
    storage.set(KEY, JSON.stringify(capped));
}

/**
 * Upsert a stub when a challenge is created or opened. Refreshes metadata and
 * bumps `updatedAt`, but never downgrades a `played` flag back to false (a
 * reopen of an already-played challenge must stay "played").
 */
export function recordChallenge(stub: Omit<ChallengeStub, 'updatedAt' | 'createdAt'>): void {
    const map = readAll();
    const prev = map[stub.id];
    const now = Date.now();
    map[stub.id] = {
        ...stub,
        // A later ChallengeScreen reopen knows the role but not a directed
        // rematch's locally snapshotted opponent, so never erase useful metadata.
        opponent: stub.opponent || prev?.opponent || '',
        played: stub.played || prev?.played === true,
        opponentPlayed: stub.opponentPlayed ?? prev?.opponentPlayed,
        isRematch: stub.isRematch ?? prev?.isRematch,
        sourceChallengeId: stub.sourceChallengeId ?? prev?.sourceChallengeId,
        seen: stub.seen ?? prev?.seen,
        snoozedUntil: stub.snoozedUntil ?? prev?.snoozedUntil,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
    };
    writeAll(map);
}

/** Flag this device's attempt as submitted. No-op if the challenge isn't indexed. */
export function markChallengePlayed(id: string): void {
    const map = readAll();
    const stub = map[id];
    if (!stub) return;
    map[id] = { ...stub, played: true, seen: true, updatedAt: Date.now() };
    writeAll(map);
}

/** Flag that this device has revealed at least one opponent result. */
export function markChallengeOpponentPlayed(id: string): void {
    const map = readAll();
    const stub = map[id];
    if (!stub) return;
    map[id] = { ...stub, opponentPlayed: true, updatedAt: Date.now() };
    writeAll(map);
}

/** Postpone an incoming rematch banner while keeping the round in History. */
export function markChallengeSnoozed(id: string, snoozedUntil: number = Date.now() + REMATCH_SNOOZE_MS): void {
    const map = readAll();
    const stub = map[id];
    if (!stub) return;
    map[id] = { ...stub, snoozedUntil, updatedAt: Date.now() };
    writeAll(map);
}

/** Permanently acknowledge an incoming banner when the player opens the round. */
export function markChallengeSeen(id: string): void {
    const map = readAll();
    const stub = map[id];
    if (!stub) return;
    map[id] = { ...stub, seen: true, updatedAt: Date.now() };
    writeAll(map);
}

/** Whether an unplayed incoming rematch is eligible for its Home banner. */
export function isChallengeBannerDue(stub: ChallengeStub, now: number = Date.now()): boolean {
    return stub.isRematch === true && !stub.played && !stub.seen && (stub.snoozedUntil ?? 0) <= now;
}

/** Every indexed challenge, newest arrival first. Reopening, syncing, or
 * completing an older round updates it in place without reshuffling History. */
export function listChallenges(): ChallengeStub[] {
    return Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);
}

/** True when two epoch-ms instants fall on the same local calendar day. */
function sameLocalDay(a: number, b: number): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/**
 * How many challenges this device *created* today (local day), for the daily
 * creation limit. Counts by write-once `createdAt`, so reopening an older
 * challenge today never inflates the tally.
 */
export function countCreatedToday(now: number = Date.now()): number {
    return Object.values(readAll()).filter((s) => s.role === 'created' && sameLocalDay(s.createdAt, now)).length;
}

/** Derive the row status from a stub and the current time. */
export function challengeStatus(stub: ChallengeStub, now: number = Date.now()): ChallengeStatus {
    if (stub.expiresAt <= now) return 'expired';
    if (!stub.played) return 'yourTurn';
    return stub.opponentPlayed ? 'completed' : 'waitingOpponent';
}
