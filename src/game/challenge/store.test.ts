// The store now talks to the Worker API over `fetch` with an App Check header.
// We mock `global.fetch` and the App Check SDK, and verify the wrappers map
// results correctly and funnel every failure mode (network reject, timeout, 403,
// 409) into the right typed error.
const mockGetToken = jest.fn();
jest.mock('@react-native-firebase/app-check', () => ({
    __esModule: true,
    default: () => ({ getToken: mockGetToken }),
}));

const mockCapture = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock('../../utils/sentry/init', () => ({
    SafeSentry: {
        captureException: (...a: unknown[]) => mockCapture(...a),
        captureMessage: (...a: unknown[]) => mockCaptureMessage(...a),
    },
}));

import {
    createChallenge,
    getChallenge,
    submitAttempt,
    getAttempts,
    getAttempt,
    OfflineError,
    BlockedError,
    BASE_API_URL,
    ensureChallengeCreated,
    prewarmChallengeAuth,
    createRematch,
    getRematch,
    syncRematches,
    syncChallengeStatuses,
} from './store';
import { type ChallengeRecord, type Attempt } from './types';

const record: ChallengeRecord = {
    lang: 'en',
    game: 'the-ladder',
    questions: [{ id: 'q1' }],
    createdBy: { uuid: 'u1', nickname: 'A' },
    expiresAt: 123,
    mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
};
const attempt: Attempt = { nickname: 'A', progress: 3, score: 100, timestamp: 5 };

const res = (status: number, body: unknown = {}): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const mockFetch = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue({ token: 'tok' });
    global.fetch = mockFetch as unknown as typeof fetch;
});

describe('createChallenge', () => {
    it('POSTs the record + id to /challenges and returns the id', async () => {
        mockFetch.mockResolvedValue(res(201, { id: 'given' }));
        const id = await createChallenge(record, 'given');
        expect(id).toBe('given');
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe(`${BASE_API_URL}/challenges`);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toMatchObject({ ...record, id: 'given' });
        expect(init.headers['X-Firebase-AppCheck']).toBe('tok');
    });

    it('generates a v4 uuid when no id is passed', async () => {
        mockFetch.mockResolvedValue(res(201));
        const id = await createChallenge(record);
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('recovers an identical immutable record when a retry receives 409', async () => {
        mockFetch.mockResolvedValueOnce(res(409)).mockResolvedValueOnce(res(200, record));

        await expect(ensureChallengeCreated(record, 'given')).resolves.toBe('given');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[1][0]).toBe(`${BASE_API_URL}/challenges/given`);
    });

    it('keeps a genuine id collision blocked', async () => {
        mockFetch.mockResolvedValueOnce(res(409)).mockResolvedValueOnce(res(200, { ...record, game: 'the-drop' }));

        await expect(ensureChallengeCreated(record, 'given')).rejects.toBeInstanceOf(BlockedError);
    });

    it('does not perform conflict recovery for an App Check rejection', async () => {
        mockFetch.mockResolvedValue(res(403));

        await expect(ensureChallengeCreated(record, 'given')).rejects.toMatchObject({
            name: 'BlockedError',
            status: 403,
        });
        // Cached-token request + one forced-token retry; no recovery GET.
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});

describe('getChallenge', () => {
    it('returns the parsed record on 200', async () => {
        mockFetch.mockResolvedValue(res(200, record));
        await expect(getChallenge('c1')).resolves.toEqual(record);
    });

    it('returns null on 404', async () => {
        mockFetch.mockResolvedValue(res(404));
        await expect(getChallenge('missing')).resolves.toBeNull();
    });
});

describe('rematches', () => {
    it('creates a directed successor without sending a recipient UUID', async () => {
        mockFetch.mockResolvedValue(res(201, { id: 'r1', created: true, recipientNickname: 'Bob' }));

        await expect(createRematch('c1', 'u1', record, 'r1')).resolves.toEqual({
            id: 'r1',
            created: true,
            recipientNickname: 'Bob',
        });
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_API_URL}/challenges/c1/rematch`);
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
            id: 'r1',
            senderUuid: 'u1',
            challenge: record,
        });
    });

    it('resolves an existing rematch and maps a missing one to null', async () => {
        mockFetch.mockResolvedValueOnce(res(200, { id: 'r1' })).mockResolvedValueOnce(res(404));
        await expect(getRematch('c1', 'u1')).resolves.toEqual({ id: 'r1' });
        await expect(getRematch('c2', 'u1')).resolves.toBeNull();
    });

    it('syncs only from source ids already known to the device', async () => {
        const incoming = {
            id: 'r1',
            sourceChallengeId: 'c1',
            game: 'the-ladder',
            senderNickname: 'Bob',
            expiresAt: 999,
        };
        mockFetch.mockResolvedValue(res(200, [incoming]));

        await expect(syncRematches('u1', ['c1', 'c2'])).resolves.toEqual([incoming]);
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_API_URL}/rematches/sync`);
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
            uuid: 'u1',
            sourceChallengeIds: ['c1', 'c2'],
        });
    });

    it('refreshes waiting/completed History states in one request', async () => {
        const statuses = [{ id: 'c1', played: true, opponentPlayed: true }];
        mockFetch.mockResolvedValue(res(200, statuses));

        await expect(syncChallengeStatuses('u1', ['c1'])).resolves.toEqual(statuses);
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_API_URL}/challenges/statuses`);
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
            uuid: 'u1',
            challengeIds: ['c1'],
        });
    });
});

describe('attempts', () => {
    it('submitAttempt POSTs to the attempt path', async () => {
        mockFetch.mockResolvedValue(res(201));
        await submitAttempt('c1', 'u1', attempt);
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_API_URL}/challenges/c1/attempts/u1`);
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(attempt);
    });

    it('getAttempts returns the list', async () => {
        mockFetch.mockResolvedValue(res(200, [attempt]));
        await expect(getAttempts('c1')).resolves.toEqual([attempt]);
    });

    it('getAttempt returns null on 404 and the attempt on 200', async () => {
        mockFetch.mockResolvedValueOnce(res(404));
        await expect(getAttempt('c1', 'u1')).resolves.toBeNull();
        mockFetch.mockResolvedValueOnce(res(200, attempt));
        await expect(getAttempt('c1', 'u1')).resolves.toEqual(attempt);
    });
});

describe('error mapping', () => {
    it('maps a network rejection to OfflineError', async () => {
        mockFetch.mockRejectedValue(new TypeError('Network request failed'));
        await expect(getChallenge('c1')).rejects.toBeInstanceOf(OfflineError);
    });

    it('maps a persistent 403 to BlockedError and reports it', async () => {
        mockFetch.mockResolvedValue(res(403)); // original call + post-refresh retry both 403
        await expect(getAttempts('c1')).rejects.toBeInstanceOf(BlockedError);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockCapture).toHaveBeenCalled();
    });

    it('recovers when a 403 clears after a token refresh', async () => {
        mockFetch.mockResolvedValueOnce(res(403)).mockResolvedValueOnce(res(200, [attempt]));
        await expect(getAttempts('c1')).resolves.toEqual([attempt]);
    });

    it('maps a 409 conflict to BlockedError', async () => {
        mockFetch.mockResolvedValue(res(409));
        await expect(submitAttempt('c1', 'u1', attempt)).rejects.toBeInstanceOf(BlockedError);
    });

    it('reports an unexpected App Check rejection before mapping it offline', async () => {
        const error = new Error('App Attest failed');
        mockGetToken.mockRejectedValue(error);

        await expect(getChallenge('c1')).rejects.toBeInstanceOf(OfflineError);
        expect(mockCapture).toHaveBeenCalledWith(error, {
            tags: { area: 'challenge-store', type: 'Error' },
        });
    });

    it('reports malformed response JSON before mapping it offline', async () => {
        const error = new SyntaxError('Unexpected token');
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw error;
            },
        } as unknown as Response);

        await expect(getChallenge('c1')).rejects.toBeInstanceOf(OfflineError);
        expect(mockCapture).toHaveBeenCalledWith(error, {
            tags: { area: 'challenge-store', type: 'SyntaxError' },
        });
    });
});

describe('timeout', () => {
    it('rejects with OfflineError when a request never settles', async () => {
        jest.useFakeTimers();
        mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
            return new Promise((_, reject) => {
                if (init?.signal) {
                    init.signal.addEventListener('abort', () => {
                        const err = new Error('AbortError');
                        err.name = 'AbortError';
                        reject(err);
                    });
                }
            });
        });
        const pending = getChallenge('c1');
        const assertion = expect(pending).rejects.toBeInstanceOf(OfflineError);
        await jest.advanceTimersByTimeAsync(10_000);
        await assertion;
        jest.useRealTimers();
    });

    it('covers App Check token acquisition before fetch starts', async () => {
        jest.useFakeTimers();
        mockGetToken.mockReturnValueOnce(new Promise(() => undefined));

        const pending = getChallenge('c1');
        const assertion = expect(pending).rejects.toBeInstanceOf(OfflineError);
        await jest.advanceTimersByTimeAsync(10_000);

        await assertion;
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockCapture).not.toHaveBeenCalled();
        expect(mockCaptureMessage).toHaveBeenCalledWith('Challenge request timed out', {
            level: 'warning',
            tags: { area: 'challenge-store', stage: 'app-check-cached', method: 'GET' },
        });
        jest.useRealTimers();
    });

    it('uses one total deadline across App Check and a hanging fetch', async () => {
        jest.useFakeTimers();
        mockGetToken.mockImplementationOnce(
            () => new Promise((resolve) => setTimeout(() => resolve({ token: 'tok' }), 8_000)),
        );
        mockFetch.mockImplementation(() => new Promise(() => undefined));

        const pending = getChallenge('c1');
        const assertion = expect(pending).rejects.toBeInstanceOf(OfflineError);
        await jest.advanceTimersByTimeAsync(10_000);

        await assertion;
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockCaptureMessage).toHaveBeenCalledWith('Challenge request timed out', {
            level: 'warning',
            tags: { area: 'challenge-store', stage: 'fetch', method: 'GET' },
        });
        jest.useRealTimers();
    });

    it('covers response body parsing and aborts the active request', async () => {
        jest.useFakeTimers();
        let signal: AbortSignal | undefined;
        mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
            signal = init?.signal ?? undefined;
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => new Promise(() => undefined),
            } as unknown as Response);
        });

        const pending = getChallenge('c1');
        const assertion = expect(pending).rejects.toBeInstanceOf(OfflineError);
        await jest.advanceTimersByTimeAsync(10_000);

        await assertion;
        expect(signal?.aborted).toBe(true);
        expect(mockCaptureMessage).toHaveBeenCalledWith('Challenge request timed out', {
            level: 'warning',
            tags: { area: 'challenge-store', stage: 'response-json', method: 'GET' },
        });
        jest.useRealTimers();
    });
});

describe('prewarmChallengeAuth', () => {
    it('starts cached token acquisition without waiting for it', () => {
        prewarmChallengeAuth();
        expect(mockGetToken).toHaveBeenCalledWith(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
