import firestore from '@react-native-firebase/firestore';
import type { Attempt, ChallengeRecord } from './types';

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

const REQUEST_TIMEOUT_MS = 10_000;

/** Reject with `OfflineError` if `promise` doesn't settle within the timeout. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new OfflineError()), REQUEST_TIMEOUT_MS);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err instanceof OfflineError ? err : new OfflineError(err));
            },
        );
    });
}

/** Write a frozen challenge; returns the generated document id for the share URL. */
export async function createChallenge(record: ChallengeRecord): Promise<string> {
    const ref = await withTimeout(firestore().collection(CHALLENGES).add(record));
    return ref.id;
}

/** Fetch a challenge by id. Returns `null` when the doc is missing or expired-out. */
export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
    const snapshot = await withTimeout(firestore().collection(CHALLENGES).doc(id).get());
    if (!snapshot.exists) return null;
    return snapshot.data() as ChallengeRecord;
}

/**
 * Record this device's attempt. Create-only and one-per-UUID is enforced by
 * security rules; a duplicate write is rejected server-side rather than here.
 */
export async function submitAttempt(id: string, uuid: string, attempt: Attempt): Promise<void> {
    await withTimeout(firestore().collection(CHALLENGES).doc(id).collection(ATTEMPTS).doc(uuid).set(attempt));
}

/** Read every participant's attempt, for ranking the result reveal. */
export async function getAttempts(id: string): Promise<Attempt[]> {
    const snapshot = await withTimeout(firestore().collection(CHALLENGES).doc(id).collection(ATTEMPTS).get());
    return snapshot.docs.map((doc) => doc.data() as Attempt);
}
