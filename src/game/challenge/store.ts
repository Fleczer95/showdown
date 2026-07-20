import appCheck from '@react-native-firebase/app-check';
import { parseChallengeRecord, serializeChallengeRecord, type Attempt, type ChallengeRecord } from './types';
import { generateUuid } from './deviceId';
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
    readonly status?: number;

    constructor(cause?: unknown, status?: number) {
        super('Challenge request was rejected by the server.');
        this.name = 'BlockedError';
        this.status = status;
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

/** A client-generated id exists, but for a different immutable record. */
export class ChallengeIdCollisionError extends BlockedError {
    constructor(cause?: unknown) {
        super(cause, 409);
        this.name = 'ChallengeIdCollisionError';
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
        const err = new BlockedError(undefined, 403);
        SafeSentry.captureException(err, { tags: { area: 'challenge-store', status: '403' } });
        return err;
    }
    if (status === 409) return new BlockedError(undefined, 409);

    // Log any unexpected HTTP errors (500, 400, etc.) to Sentry
    const err = new OfflineError();
    SafeSentry.captureException(err, { tags: { area: 'challenge-store', status: status.toString() } });
    return err;
}

/** Reject with `OfflineError` only when the deadline wins. Ordinary rejections
 * pass through so `request` remains the single mapping and observability boundary. */
export function withTimeout<T>(promise: Promise<T>, onTimeout?: () => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            onTimeout?.();
            reject(new OfflineError());
        }, REQUEST_TIMEOUT_MS);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
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
 * Begin cached App Check token acquisition while the nickname sheet is open.
 * Firebase owns token expiry/caching; this only moves attestation off the create
 * button's critical path and never blocks the UI if warming fails.
 */
export function prewarmChallengeAuth(): void {
    void withTimeout(appCheckHeaders(false)).catch(() => undefined);
}

/**
 * `fetch` with the App Check header attached. A 403 may just mean the cached token
 * expired, so we force-refresh once and retry before treating it as a real
 * rejection. Returns the raw `Response`; callers map the status.
 */
export type ChallengeRequestStage =
    | 'app-check-cached'
    | 'fetch'
    | 'app-check-refresh'
    | 'fetch-retry'
    | 'response-json';

export async function fetchWithAppCheck(
    path: string,
    init: RequestInit = {},
    onStage?: (stage: ChallengeRequestStage) => void,
): Promise<Response> {
    const url = `${BASE_API_URL}${path}`;
    onStage?.('app-check-cached');
    let headers = await appCheckHeaders(false);
    onStage?.('fetch');
    let res = await fetch(url, { ...init, headers: { ...init.headers, ...headers } });
    if (res.status === 403) {
        onStage?.('app-check-refresh');
        headers = await appCheckHeaders(true);
        onStage?.('fetch-retry');
        res = await fetch(url, { ...init, headers: { ...init.headers, ...headers } });
    }
    return res;
}

/**
 * `fetchWithAppCheck` + timeout + status mapping, resolving to the parsed JSON
 * body. With `notFound`, a 404 resolves to `null` (a missing/expired doc is not an
 * error on the read paths); any other non-OK status maps via `httpError`.
 */
export async function request<T>(path: string, init: RequestInit = {}, notFound = false): Promise<T> {
    const controller = new AbortController();
    let stage: ChallengeRequestStage = 'app-check-cached';
    try {
        return await withTimeout(
            (async () => {
                const res = await fetchWithAppCheck(path, { ...init, signal: controller.signal }, (next) => {
                    stage = next;
                });
                if (notFound && res.status === 404) return null as T;
                if (!res.ok) throw httpError(res.status);
                stage = 'response-json';
                return (await res.json()) as T;
            })(),
            () => {
                controller.abort();
                SafeSentry.captureMessage('Challenge request timed out', {
                    level: 'warning',
                    tags: {
                        area: 'challenge-store',
                        stage,
                        method: init.method ?? 'GET',
                    },
                });
            },
        );
    } catch (err: any) {
        if (err.name === 'AbortError') throw new OfflineError();
        if (err instanceof OfflineError || err instanceof BlockedError) throw err;

        // Log unexpected runtime errors (e.g., JSON SyntaxError), but ignore raw network exceptions (TypeError)
        if (err.name !== 'TypeError') {
            SafeSentry.captureException(err, { tags: { area: 'challenge-store', type: err.name } });
        }

        throw new OfflineError(err);
    }
}

/**
 * A fresh challenge id, generated client-side without a write, so the create flow
 * can reuse it across retries (a timed-out-but-committed create is recovered via
 * `getChallenge` instead of being created twice). A v4 UUID — same scheme as the
 * device id; reads are App Check-gated, so guessability is not a concern.
 */
export function newChallengeId(): string {
    return generateUuid();
}

/** Write a frozen challenge; returns the document id for the share URL. Pass a
 *  pre-generated `id` (see `newChallengeId`) to make a retry target the same doc. */
export async function createChallenge(record: ChallengeRecord, id?: string): Promise<string> {
    const docId = id ?? newChallengeId();
    await request('/challenges', {
        method: 'POST',
        body: JSON.stringify({ ...serializeChallengeRecord(record), id: docId }),
    });
    return docId;
}

/** Fetch a challenge by id. Returns `null` when missing or expired-out. */
export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
    const record = await request<unknown | null>(`/challenges/${id}`, undefined, true);
    if (record === null) return null;
    const parsed = parseChallengeRecord(record);
    if (!parsed) throw new BlockedError();
    return parsed;
}

function canonicalizeJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalizeJson);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, child]) => [key, canonicalizeJson(child)]),
        );
    }
    return value;
}

/** Compare frozen challenge payloads independent of object-key insertion order. */
export function sameChallengeRecord(a: ChallengeRecord, b: ChallengeRecord): boolean {
    return JSON.stringify(canonicalizeJson(a)) === JSON.stringify(canonicalizeJson(b));
}

/**
 * Retry a client-generated id without creating a second challenge. An earlier
 * timed-out POST may have committed; the old Worker returns 409 in that case, so
 * verify the immutable record and treat a byte-equivalent retry as success.
 */
export async function ensureChallengeCreated(record: ChallengeRecord, id: string): Promise<string> {
    try {
        return await createChallenge(record, id);
    } catch (error) {
        if (!(error instanceof BlockedError) || error.status !== 409) throw error;
        const existing = await getChallenge(id);
        if (existing && sameChallengeRecord(existing, record)) return id;
        if (existing) throw new ChallengeIdCollisionError(error);
        throw error;
    }
}

export interface RematchCreationResult {
    id: string;
    /** False when a retry or the other participant already created the successor. */
    created: boolean;
    recipientNickname: string;
}

export interface IncomingRematch {
    id: string;
    sourceChallengeId: string;
    game: string;
    senderNickname: string;
    expiresAt: number;
}

export interface ChallengeStatusSnapshot {
    id: string;
    played: boolean;
    opponentPlayed: boolean;
}

/** Create the sole directed successor to a completed 1:1 challenge. The Worker
 * derives the recipient from source attempts; callers never supply a target UUID. */
export function createRematch(
    sourceChallengeId: string,
    senderUuid: string,
    record: ChallengeRecord,
    id: string,
): Promise<RematchCreationResult> {
    return request<RematchCreationResult>(`/challenges/${sourceChallengeId}/rematch`, {
        method: 'POST',
        body: JSON.stringify({ id, senderUuid, challenge: serializeChallengeRecord(record) }),
    });
}

/** Resolve an existing successor before spending another daily challenge allowance. */
export function getRematch(sourceChallengeId: string, uuid: string): Promise<{ id: string } | null> {
    return request<{ id: string } | null>(`/challenges/${sourceChallengeId}/rematch/${uuid}`, undefined, true);
}

/** Pull directed rematches for source challenges already known to this device. */
export function syncRematches(uuid: string, sourceChallengeIds: string[]): Promise<IncomingRematch[]> {
    return request<IncomingRematch[]>('/rematches/sync', {
        method: 'POST',
        body: JSON.stringify({ uuid, sourceChallengeIds }),
    });
}

/** Refresh all three History states in one bounded Worker/D1 query. */
export function syncChallengeStatuses(uuid: string, challengeIds: string[]): Promise<ChallengeStatusSnapshot[]> {
    return request<ChallengeStatusSnapshot[]>('/challenges/statuses', {
        method: 'POST',
        body: JSON.stringify({ uuid, challengeIds }),
    });
}

/** Record this device's attempt. Create-only, one-per-UUID is enforced server-side. */
export async function submitAttempt(id: string, uuid: string, attempt: Attempt): Promise<void> {
    await request(`/challenges/${id}/attempts/${uuid}`, { method: 'POST', body: JSON.stringify(attempt) });
}

/** Read participants' attempts for the result reveal (server caps at 100, ordered
 *  by progress). `rankEntries` does the full sort. */
export function getAttempts(id: string): Promise<Attempt[]> {
    return request<Attempt[]>(`/challenges/${id}/attempts`);
}

/** Read this device's own attempt (null if it hasn't played yet). */
export function getAttempt(id: string, uuid: string): Promise<Attempt | null> {
    return request<Attempt | null>(`/challenges/${id}/attempts/${uuid}`, undefined, true);
}
