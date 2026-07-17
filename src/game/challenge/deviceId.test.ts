// Stateful MMKV stub so we can assert the id persists across calls. The global
// jest.setup mock is write-only (getString always undefined), which would make
// getDeviceId mint a fresh id every call.
const mockStores = new Map<string, Map<string, string | boolean>>();

function mockStoreFor(id: string): Map<string, string | boolean> {
    let store = mockStores.get(id);
    if (!store) {
        store = new Map();
        mockStores.set(id, store);
    }
    return store;
}

jest.mock('react-native-mmkv', () => ({
    createMMKV: ({ id }: { id: string }) => {
        const store = mockStoreFor(id);
        return {
            getString: (key: string) => {
                const value = store.get(key);
                return typeof value === 'string' ? value : undefined;
            },
            getBoolean: (key: string) => {
                const value = store.get(key);
                return typeof value === 'boolean' ? value : undefined;
            },
            set: (key: string, value: string | boolean) => void store.set(key, value),
            remove: (key: string) => void store.delete(key),
        };
    },
}));

// Keep this require below the stateful mock setup; static imports are hoisted.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDeviceId } = require('./deviceId') as typeof import('./deviceId');

beforeEach(() => {
    for (const store of mockStores.values()) store.clear();
});

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
        mockStoreFor('showdown-device').set('deviceId', 'preexisting-id');
        expect(getDeviceId()).toBe('preexisting-id');
    });

    it('moves an id from the legacy namespace into device-only storage', () => {
        mockStoreFor('showdown').set('deviceId', 'legacy-id');

        expect(getDeviceId()).toBe('legacy-id');
        expect(mockStoreFor('showdown-device').get('deviceId')).toBe('legacy-id');
        expect(mockStoreFor('showdown').has('deviceId')).toBe(false);
    });
});
