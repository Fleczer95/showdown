import appCheck from '@react-native-firebase/app-check';
import type { Attempt, ChallengeRecord } from './types';
import { SafeSentry } from '../../utils/sentry/init';

// The only network touchpoint for challenges (ADR-0003). The app talks to the
// Showdown Worker API (Cloudflare + D1) over plain HTTPS — there is no Firestore
// SDK here anymore. Every request carries a Firebase App Check token; the Worker
// verifies it and rejects anything else. A challenge is online at three gated
// moments — create, open, finish — and each must reflect a confirmed round-trip,
// so every call is timeout-wrapped and surfaces a typed `OfflineError` /
// `BlockedError` the UI turns into a connect+retry or a hard-error screen.

// The Showdown backend Worker (Cloudflare + D1). Not user-facing — only the app
// calls it — so the workers.dev URL is fine for production. One constant to swap
// if it is ever moved to a branded domain.
export const BASE_API_URL = 'https://showdown-backend.arturjankowski95.workers.dev';

/** Network round-trips that fail or hang resolve to this, gating the offline UI. */
export class OfflineError extends Error {
    constructor(cause?: unknown) {
        super('Challenge request failed — device appears offline.');
        this.name = 'OfflineError';
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

/**
 * The server actively rejected the request — App Check attestation failure (403)
 * or a conflict (409, e.g. a duplicate attempt). The device is online and a retry
 * won't help, so the UI must NOT claim "you're offline"; it shows a distinct error.
 */
export class BlockedError extends Error {
    constructor(cause?: unknown) {
        super('Challenge request was rejected by the server.');
        this.name = 'BlockedError';
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Map a non-OK HTTP status to one of our typed errors. 403 (App Check) and 409
 * (conflict) are deliberate server rejections a retry can't fix → `BlockedError`;
 * a 403 is reported to Sentry since it usually means a misconfiguration. Anything
 * else (5xx, etc.) stays an `OfflineError` so a transient blip keeps retry-friendly
 * copy.
 */
export function httpError(status: number): OfflineError | BlockedError {
    if (status === 403) {
        const err = new BlockedError();
        SafeSentry.captureException(err, { tags: { area: 'challenge-store', status: '403' } });
        return err;
    }
    if (status === 409) return new BlockedError();
    return new OfflineError();
}

/** Reject with `OfflineError` if `promise` doesn't settle within the timeout. A
 *  rejection already typed as Offline/Blocked passes through; anything else (a raw
 *  `fetch` network failure) becomes `OfflineError`. */
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
                if (err instanceof OfflineError || err instanceof BlockedError) reject(err);
                else reject(new OfflineError(err));
            },
        );
    });
}

async function appCheckHeaders(forceRefresh: boolean): Promise<Record<string, string>> {
    const { token } = await appCheck().getToken(forceRefresh);
    if (!token) throw new Error('App Check token unavailable');
    return { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': token };
}

/**
 * `fetch` with the App Check header attached. A 403 may just mean the cached token
 * expired, so we force-refresh once and retry before treating it as a real
 * rejection. Returns the raw `Response`; callers map the status.
 */
export async function fetchWithAppCheck(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${BASE_API_URL}${path}`;
    let res = await fetch(url, { ...init, headers: await appCheckHeaders(false) });
    if (res.status === 403) res = await fetch(url, { ...init, headers: await appCheckHeaders(true) });
    return res;
}

/**
 * A fresh challenge id, generated client-side without a write, so the create flow
 * can reuse it across retries (a timed-out-but-committed create is recovered via
 * `getChallenge` instead of being created twice). A v4 UUID — matching the device
 * id scheme; reads are App Check-gated, so guessability is not a concern.
 */
export function newChallengeId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Write a frozen challenge; returns the document id for the share URL. Pass a
 *  pre-generated `id` (see `newChallengeId`) to make a retry target the same doc. */
export async function createChallenge(record: ChallengeRecord, id?: string): Promise<string> {
    const docId = id ?? newChallengeId();
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck('/challenges', {
                method: 'POST',
                body: JSON.stringify({ ...record, id: docId }),
            });
            if (!res.ok) throw httpError(res.status);
            return docId;
        })(),
    );
}

/** Fetch a challenge by id. Returns `null` when missing or expired-out. */
export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/challenges/${id}`);
            if (res.status === 404) return null;
            if (!res.ok) throw httpError(res.status);
            return (await res.json()) as ChallengeRecord;
        })(),
    );
}

/** Record this device's attempt. Create-only, one-per-UUID is enforced server-side. */
export async function submitAttempt(id: string, uuid: string, attempt: Attempt): Promise<void> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/challenges/${id}/attempts/${uuid}`, {
                method: 'POST',
                body: JSON.stringify(attempt),
            });
            if (!res.ok) throw httpError(res.status);
        })(),
    );
}

/** Read participants' attempts for the result reveal (server caps at 100, ordered
 *  by progress). `rankEntries` does the full sort. */
export async function getAttempts(id: string): Promise<Attempt[]> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/challenges/${id}/attempts`);
            if (!res.ok) throw httpError(res.status);
            return (await res.json()) as Attempt[];
        })(),
    );
}

/** Read this device's own attempt (null if it hasn't played yet). */
export async function getAttempt(id: string, uuid: string): Promise<Attempt | null> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/challenges/${id}/attempts/${uuid}`);
            if (res.status === 404) return null;
            if (!res.ok) throw httpError(res.status);
            return (await res.json()) as Attempt;
        })(),
    );
}
