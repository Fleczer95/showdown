// The store now talks to the Worker API over `fetch` with an App Check header.
// We mock `global.fetch` and the App Check SDK, and verify the wrappers map
// results correctly and funnel every failure mode (network reject, timeout, 403,
// 409) into the right typed error.
jest.mock('@react-native-firebase/app-check', () => ({
    __esModule: true,
    default: () => ({ getToken: jest.fn(async () => ({ token: 'tok' })) }),
}));

const mockCapture = jest.fn();
jest.mock('../../utils/sentry/init', () => ({ SafeSentry: { captureException: (...a: unknown[]) => mockCapture(...a) } }));

import {
    createChallenge,
    getChallenge,
    submitAttempt,
    getAttempts,
    getAttempt,
    OfflineError,
    BlockedError,
    BASE_API_URL,
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
});
