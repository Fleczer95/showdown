import { startEvent } from './participation';
import { testEventEdition as edition } from '../../../shared/events/fixtures';
import { deviceStore } from '../../storage/appStores';
import { request, getChallenge } from '../challenge/store';
import { getPendingEventStart, listSessions, eventUsage } from '../challenge/session/store';
import { localDate } from '../progression/recordRun';
jest.mock('react-native-mmkv', () => {
    const stores = new Map<string, Map<string, string | boolean>>();
    return {
        createMMKV: ({ id }: { id: string }) => {
            if (!stores.has(id)) stores.set(id, new Map());
            const data = stores.get(id)!;
            return {
                getString: (k: string) => data.get(k),
                getBoolean: (k: string) => data.get(k),
                set: (k: string, v: string | boolean) => data.set(k, v),
                remove: (k: string) => data.delete(k),
            };
        },
    };
});
jest.mock('../challenge/store', () => ({
    request: jest.fn(),
    getChallenge: jest.fn(),
    BlockedError: class extends Error {
        status?: number;
        constructor(_: unknown, status?: number) {
            super();
            this.status = status;
        }
    },
}));
jest.mock('../challenge/deviceId', () => ({ getDeviceId: () => 'device', generateUuid: () => 'stable-request' }));
jest.mock('../mascot/equippedLook', () => ({
    getEquippedLook: () => ({ fur: 'a', suit: 'b', accent: 'c', mic: 'd' }),
}));

const input = {
    edition,
    mode: 'random' as const,
    nickname: 'Player',
    locale: 'en' as const,
    entitlements: () => ({ purchasedIds: new Set<string>(), premium: false }),
};
beforeEach(() => {
    deviceStore.remove('challenge-sessions-v1');
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 6, 12).getTime());
    jest.mocked(request).mockResolvedValue({ id: 'admitted' });
    jest.mocked(getChallenge).mockImplementation(async () => getPendingEventStart()!.record);
});
afterEach(() => jest.restoreAllMocks());

test('uncertain HTTP admission survives retries with the same request and costs nothing until durable session', async () => {
    jest.mocked(request).mockRejectedValueOnce(new Error('timeout'));
    await expect(startEvent(input)).rejects.toThrow('timeout');
    expect(getPendingEventStart()?.requestId).toBe('stable-request');
    expect(listSessions()).toHaveLength(0);
    const firstBody = jest.mocked(request).mock.calls[0][1]?.body;
    await expect(startEvent(input)).resolves.toMatchObject({ id: 'admitted' });
    expect(jest.mocked(request).mock.calls[1][1]?.body).toBe(firstBody);
    expect(listSessions()).toHaveLength(1);
    expect(getPendingEventStart()).toBeUndefined();
});
test('friend creation persists the start-now/play-later choice, including uncertain retries', async () => {
    jest.mocked(request).mockRejectedValueOnce(new Error('timeout'));
    await expect(startEvent({ ...input, mode: 'friend' })).rejects.toThrow('timeout');
    // Recovery must use the persisted mode, not a different button tapped later.
    await expect(startEvent(input)).resolves.toEqual({ id: 'admitted', share: true });
    expect(listSessions()[0]).toMatchObject({ awaitingStart: true, elapsedMs: 0 });
    expect(listSessions()[0].chargeDate).toBeDefined();
});

test('random admission still begins immediately', async () => {
    await startEvent(input);
    expect(listSessions()[0].awaitingStart).not.toBe(true);
});

test('a friend recipient who already pressed Start is not asked a second time', async () => {
    await startEvent({ ...input, mode: 'friend', challengeId: 'admitted' });
    expect(listSessions()[0].awaitingStart).not.toBe(true);
});

test('a response arriving at closure cannot reveal a session or charge', async () => {
    jest.mocked(request).mockImplementation(async () => {
        jest.spyOn(Date, 'now').mockReturnValue(edition.endsAt!);
        return { id: 'admitted' } as never;
    });
    await expect(startEvent(input)).rejects.toMatchObject({ status: 410 });
    expect(listSessions()).toHaveLength(0);
    expect(getPendingEventStart()).toBeUndefined();
});
test('one in-flight operation blocks overlapping taps', async () => {
    let resolve!: (value: { id: string }) => void;
    jest.mocked(request).mockImplementationOnce(
        () =>
            new Promise((done) => {
                resolve = done;
            }) as never,
    );
    const first = startEvent(input);
    await expect(startEvent(input)).rejects.toThrow('in progress');
    resolve({ id: 'admitted' });
    await first;
    expect(request).toHaveBeenCalledTimes(1);
});
test('midnight retry uses the eventual commit calendar date, not an elapsed 24-hour bucket', async () => {
    // localDate receives a Date constructed from the injected clock at commit.
    const endOfDay = new Date(2026, 9, 24, 23, 59, 59);
    jest.useFakeTimers().setSystemTime(endOfDay);
    jest.spyOn(Date, 'now').mockImplementation(() => new Date().getTime());
    jest.mocked(request).mockRejectedValueOnce(new Error('offline'));
    await expect(startEvent(input)).rejects.toThrow();
    const nextDay = new Date(2026, 9, 25, 0, 0, 1);
    jest.setSystemTime(nextDay);
    await startEvent(input);
    expect(eventUsage(edition.id, localDate(endOfDay))).toBe(0);
    expect(eventUsage(edition.id, localDate(nextDay))).toBe(1);
    jest.useRealTimers();
});
