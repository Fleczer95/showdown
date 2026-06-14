// Stateful MMKV stub so we can assert the id persists across calls. The global
// jest.setup mock is write-only (getString always undefined), which would make
// getDeviceId mint a fresh id every call.
const mockStore = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
    createMMKV: () => ({
        getString: (k: string) => mockStore.get(k),
        set: (k: string, v: string) => void mockStore.set(k, v),
    }),
}));

import { getDeviceId } from './deviceId';

beforeEach(() => mockStore.clear());

describe('getDeviceId', () => {
    it('generates a v4-shaped UUID on first call', () => {
        expect(getDeviceId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('returns the same id on subsequent calls (persisted)', () => {
        const first = getDeviceId();
        expect(getDeviceId()).toBe(first);
        expect(getDeviceId()).toBe(first);
    });

    it('persists under a stable key, reusing an already-stored id', () => {
        mockStore.set('deviceId', 'preexisting-id');
        expect(getDeviceId()).toBe('preexisting-id');
    });
});
