// Firestore is mocked as a chainable stub; each leaf call (add/get/set) is a
// jest.fn configured per test. Verifies the wrappers map results correctly and
// funnel every failure mode — rejection and timeout — into OfflineError.
const mockAdd = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('@react-native-firebase/firestore', () => {
    // Self-referential chain: collection()/doc() return the same api, so any
    // navigation depth lands on the same leaf fns. Each test exercises one call.
    // Leaves are forwarded lazily: babel hoists this factory above the `const
    // mock*` declarations, so they're undefined at factory-eval time but defined
    // by the time a wrapper actually fires.
    const api: Record<string, unknown> = {};
    api.collection = () => api;
    api.doc = () => api;
    api.add = (...args: unknown[]) => mockAdd(...args);
    api.get = (...args: unknown[]) => mockGet(...args);
    api.set = (...args: unknown[]) => mockSet(...args);
    // `firestore` is a callable with a static `Timestamp`. Our stub Timestamp is
    // just a millis carrier with the `toMillis()` the store reads back.
    const Timestamp = { fromMillis: (ms: number) => ({ toMillis: () => ms }) };
    return { __esModule: true, default: Object.assign(() => api, { Timestamp }) };
});

import { createChallenge, getChallenge, submitAttempt, getAttempts, OfflineError } from './store';
import { SCHEMA_VERSION, MIN_APP_VERSION, type ChallengeRecord, type Attempt } from './types';

const record: ChallengeRecord = {
    schemaVersion: SCHEMA_VERSION,
    minAppVersion: MIN_APP_VERSION,
    appVersion: '0.9.0',
    lang: 'en',
    game: 'the-ladder',
    questions: [],
    createdBy: { uuid: 'u1', nickname: 'A' },
    expiresAt: 1,
};
const attempt: Attempt = { nickname: 'A', progress: 3, score: 100, timestamp: 5 };

beforeEach(() => jest.clearAllMocks());

describe('createChallenge', () => {
    it('returns the new document id and writes expiresAt as a Timestamp', async () => {
        mockAdd.mockResolvedValue({ id: 'doc123' });
        await expect(createChallenge(record)).resolves.toBe('doc123');
        const written = mockAdd.mock.calls[0][0] as ChallengeRecord & { expiresAt: { toMillis: () => number } };
        expect(written).toMatchObject({ ...record, expiresAt: expect.anything() });
        expect(written.expiresAt.toMillis()).toBe(record.expiresAt);
    });
});

describe('getChallenge', () => {
    it('returns the record, converting the Timestamp expiresAt back to epoch-ms', async () => {
        const stored = { ...record, expiresAt: { toMillis: () => record.expiresAt } };
        mockGet.mockResolvedValue({ exists: true, data: () => stored });
        await expect(getChallenge('doc123')).resolves.toEqual(record);
    });

    it('returns null when the doc is missing/expired', async () => {
        mockGet.mockResolvedValue({ exists: false });
        await expect(getChallenge('gone')).resolves.toBeNull();
    });
});

describe('submitAttempt', () => {
    it('writes the attempt under the device uuid', async () => {
        mockSet.mockResolvedValue(undefined);
        await submitAttempt('doc123', 'uuid-x', attempt);
        expect(mockSet).toHaveBeenCalledWith(attempt);
    });
});

describe('getAttempts', () => {
    it('maps every attempt doc to its data', async () => {
        const a: Attempt = { ...attempt, nickname: 'B' };
        mockGet.mockResolvedValue({ docs: [{ data: () => attempt }, { data: () => a }] });
        await expect(getAttempts('doc123')).resolves.toEqual([attempt, a]);
    });
});

describe('offline handling', () => {
    it('wraps a rejected call in OfflineError', async () => {
        mockGet.mockRejectedValue(new Error('network down'));
        await expect(getChallenge('doc123')).rejects.toBeInstanceOf(OfflineError);
    });

    it('times out a hung call as OfflineError', async () => {
        jest.useFakeTimers();
        mockAdd.mockReturnValue(new Promise(() => {}));
        const pending = createChallenge(record);
        const assertion = expect(pending).rejects.toBeInstanceOf(OfflineError);
        jest.advanceTimersByTime(10_000);
        await assertion;
        jest.useRealTimers();
    });
});
