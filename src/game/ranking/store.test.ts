// Ranking store over the Worker API. Reuses the challenge store's App Check fetch,
// so we mock the App Check SDK + global.fetch and assert URL/shape mapping.
jest.mock('@react-native-firebase/app-check', () => ({
    __esModule: true,
    default: () => ({ getToken: jest.fn(async () => ({ token: 'tok' })) }),
}));
jest.mock('../../utils/sentry/init', () => ({ SafeSentry: { captureException: jest.fn() } }));

import { getBoard, countEntries, lowestScore, submitEntry } from './store';
import { OfflineError, BASE_API_URL } from '../challenge/store';
import { DISPLAY_SIZE } from './config';
import type { RankingEntry } from './types';

const entry: RankingEntry = { nickname: 'Ada', score: 500, signature: 'crown' };

const res = (status: number, body: unknown = {}): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const mockFetch = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
});

describe('getBoard', () => {
    it('GETs the period board with the display-size limit and returns entries', async () => {
        mockFetch.mockResolvedValue(res(200, [entry]));
        await expect(getBoard('the-ladder', '2026-06')).resolves.toEqual([entry]);
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_API_URL}/rankings/the-ladder/2026-06?limit=${DISPLAY_SIZE}`);
    });
});

describe('countEntries / lowestScore', () => {
    it('countEntries unwraps the count field', async () => {
        mockFetch.mockResolvedValue(res(200, { count: 7 }));
        await expect(countEntries('the-drop', 'alltime')).resolves.toBe(7);
    });

    it('lowestScore returns the score, or null when empty', async () => {
        mockFetch.mockResolvedValueOnce(res(200, { score: 120 }));
        await expect(lowestScore('the-drop', 'alltime')).resolves.toBe(120);
        mockFetch.mockResolvedValueOnce(res(200, { score: null }));
        await expect(lowestScore('the-drop', 'alltime')).resolves.toBeNull();
    });
});

describe('submitEntry', () => {
    it('POSTs the entry to the device-uuid path', async () => {
        mockFetch.mockResolvedValue(res(200));
        await submitEntry('the-wheel', 'alltime', 'uuid-1', entry);
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_API_URL}/rankings/the-wheel/alltime/entries/uuid-1`);
        expect(mockFetch.mock.calls[0][1].method).toBe('POST');
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(entry);
    });

    it('maps a network failure to OfflineError', async () => {
        mockFetch.mockRejectedValue(new TypeError('Network request failed'));
        await expect(submitEntry('the-wheel', 'alltime', 'uuid-1', entry)).rejects.toBeInstanceOf(OfflineError);
    });
});
