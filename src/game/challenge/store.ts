import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { Attempt, ChallengeRecord } from './types';
import { SafeSentry } from '../../utils/sentry/init';

// The only Firestore touchpoint for challenges (ADR-0003). The app reads/writes
// directly — there is no server. A challenge is one document at `c/{id}`;
// participant results live in a `c/{id}/attempts/{uuid}` subcollection.
//
// A challenge is online at three gated moments — create, open, finish — and each
// must reflect a confirmed round-trip, so every call is wrapped with a timeout
// and surfaces a typed `OfflineError` the UI turns into a connect+retry screen.
// Firestore's silent offline write queue is deliberately not relied upon.

const CHALLENGES = 'c';
const ATTEMPTS = 'attempts';

/** Network round-trips that fail or hang resolve to this, gating the offline UI. */
export class OfflineError extends Error {
    constructor(cause?: unknown) {
        super('Challenge request failed — device appears offline.');
        this.name = 'OfflineError';
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

/**
 * The server actively rejected the request — security rules or, in practice, App
 * Check attestation (a failed Play Integrity / App Attest token surfaces as
 * `permission-denied`). The device is online and a retry won't help, so the UI must
 * NOT claim "you're offline" here; it shows a distinct error and we report it.
 */
export class BlockedError extends Error {
    constructor(cause?: unknown) {
        super('Challenge request was rejected by the server.');
        this.name = 'BlockedError';
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

// Codes that mean a deliberate server-side rejection rather than a connectivity
// failure. Kept narrow on purpose: anything else (including transient
// `unavailable`/`deadline-exceeded`) stays an OfflineError so a real network blip
// keeps its retry-friendly "offline" copy.
const REJECTED_CODES = new Set(['firestore/permission-denied', 'firestore/unauthenticated']);

/**
 * Turn a raw failure into one of our two typed errors. A rejection is reported to
 * Sentry (it's a misconfiguration we want to see); a plain offline state is expected
 * and not worth an event.
 */
function classifyError(err: unknown): OfflineError | BlockedError {
    if (err instanceof OfflineError || err instanceof BlockedError) return err;
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && REJECTED_CODES.has(code)) {
        SafeSentry.captureException(err, { tags: { area: 'challenge-store' } });
        return new BlockedError(err);
    }
    return new OfflineError(err);
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Cap on attempts pulled for the result reveal. Ordered by `progress` (the
 * primary ranking key — see `rankEntries`), so the fetched slice is exactly the
 * entries that can occupy the board; the rest can't outrank them. Bounds read
 * cost on a runaway challenge without ever dropping a winner.
 */
const ATTEMPTS_QUERY_LIMIT = 100;

/** Reject with `OfflineError` if `promise` doesn't settle within the timeout. */
export function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new OfflineError()), REQUEST_TIMEOUT_MS);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(classifyError(err));
            },
        );
    });
}

/**
 * A fresh challenge document id, generated client-side without a write. The
 * create flow reuses this across retries so a write whose confirmation timed out
 * (but which Firestore still commits on reconnect) can be recovered via
 * `getChallenge` instead of being created a second time.
 */
export function newChallengeId(): string {
    return firestore().collection(CHALLENGES).doc().id;
}

/**
 * Write a frozen challenge; returns the document id for the share URL. Pass a
 * pre-generated `id` (see `newChallengeId`) to make a retry target the same doc.
 * `expiresAt` is stored as a Firestore `Timestamp` (not the in-app epoch-ms
 * number) because the Firestore TTL policy only prunes docs by a Timestamp field.
 */
export async function createChallenge(record: ChallengeRecord, id?: string): Promise<string> {
    const payload = { ...record, expiresAt: firestore.Timestamp.fromMillis(record.expiresAt) };
    const ref = id ? firestore().collection(CHALLENGES).doc(id) : firestore().collection(CHALLENGES).doc();
    await withTimeout(ref.set(payload));
    return ref.id;
}

/** Fetch a challenge by id. Returns `null` when the doc is missing or expired-out. */
export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
    const snapshot = await withTimeout(firestore().collection(CHALLENGES).doc(id).get());
    if (!snapshot.exists) return null;
    // `expiresAt` is a Timestamp on the wire (see createChallenge); convert back
    // to epoch-ms so the rest of the app keeps working with plain numbers.
    const data = snapshot.data() as Omit<ChallengeRecord, 'expiresAt'> & {
        expiresAt: FirebaseFirestoreTypes.Timestamp;
    };
    return { ...data, expiresAt: data.expiresAt.toMillis() };
}

/**
 * Record this device's attempt. Create-only and one-per-UUID is enforced by
 * security rules; a duplicate write is rejected server-side rather than here.
 */
export async function submitAttempt(id: string, uuid: string, attempt: Attempt): Promise<void> {
    await withTimeout(firestore().collection(CHALLENGES).doc(id).collection(ATTEMPTS).doc(uuid).set(attempt));
}

/**
 * Read participants' attempts for ranking the result reveal, capped at
 * `ATTEMPTS_QUERY_LIMIT` highest-progress. A single-field `orderBy` needs no
 * composite index; `rankEntries` does the full progress→score→timestamp sort.
 */
export async function getAttempts(id: string): Promise<Attempt[]> {
    const snapshot = await withTimeout(
        firestore()
            .collection(CHALLENGES)
            .doc(id)
            .collection(ATTEMPTS)
            .orderBy('progress', 'desc')
            .limit(ATTEMPTS_QUERY_LIMIT)
            .get(),
    );
    return snapshot.docs.map((doc) => doc.data() as Attempt);
}

/** Read this device's own attempt (null if it hasn't played yet) — gates straight-to-results. */
export async function getAttempt(id: string, uuid: string): Promise<Attempt | null> {
    const snapshot = await withTimeout(firestore().collection(CHALLENGES).doc(id).collection(ATTEMPTS).doc(uuid).get());
    if (!snapshot.exists) return null;
    return snapshot.data() as Attempt;
}
