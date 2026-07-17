import { readFileSync } from 'node:fs';
import path from 'node:path';

type StoredValue = string | boolean;

const mockStores = new Map<string, Map<string, StoredValue>>();

function mockStoreFor(id: string): Map<string, StoredValue> {
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
            set: (key: string, value: StoredValue) => void store.set(key, value),
            remove: (key: string) => void store.delete(key),
        };
    },
}));

// Keep this require below the stateful mock setup; static imports are hoisted.
/* eslint-disable @typescript-eslint/no-require-imports */
const { APP_STORE_IDS, deviceStore, profileStore, RESTORABLE_MMKV_STORE_IDS } =
    require('./appStores') as typeof import('./appStores');
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
    for (const store of mockStores.values()) store.clear();
});

describe('app stores', () => {
    it('declares only profile data, progression, and settings as restorable', () => {
        expect(RESTORABLE_MMKV_STORE_IDS).toEqual(['showdown-progression', 'showdown-settings', 'showdown-profile']);
        expect(RESTORABLE_MMKV_STORE_IDS).not.toContain(APP_STORE_IDS.device);
        expect(RESTORABLE_MMKV_STORE_IDS).not.toContain(APP_STORE_IDS.legacy);
    });

    it('moves a legacy string into the restorable profile store on first read', () => {
        mockStoreFor(APP_STORE_IDS.legacy).set('theme', 'night');

        expect(profileStore.getString('theme')).toBe('night');
        expect(mockStoreFor(APP_STORE_IDS.profile).get('theme')).toBe('night');
        expect(mockStoreFor(APP_STORE_IDS.legacy).has('theme')).toBe(false);
    });

    it('moves a legacy boolean into the device-only store on first read', () => {
        mockStoreFor(APP_STORE_IDS.legacy).set('reviewAccepted', true);

        expect(deviceStore.getBoolean('reviewAccepted')).toBe(true);
        expect(mockStoreFor(APP_STORE_IDS.device).get('reviewAccepted')).toBe(true);
        expect(mockStoreFor(APP_STORE_IDS.legacy).has('reviewAccepted')).toBe(false);
    });

    it('keeps an existing target value instead of overwriting it from legacy storage', () => {
        mockStoreFor(APP_STORE_IDS.profile).set('theme', 'party');
        mockStoreFor(APP_STORE_IDS.legacy).set('theme', 'night');

        expect(profileStore.getString('theme')).toBe('party');
        expect(mockStoreFor(APP_STORE_IDS.legacy).has('theme')).toBe(false);
    });

    it('keeps the native backup allowlists synchronized with the storage lifecycle', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const expectedStoreIds = [...RESTORABLE_MMKV_STORE_IDS];
        const expectedFiles = expectedStoreIds.flatMap((id) => [id, `${id}.crc`]).sort();

        const appConfig = JSON.parse(readFileSync(path.join(projectRoot, 'app.json'), 'utf8')) as {
            expo: { plugins: Array<string | [string, { mmkvStoreIds: string[] }]> };
        };
        const configuredAllowlists = appConfig.expo.plugins
            .filter((plugin): plugin is [string, { mmkvStoreIds: string[] }] => Array.isArray(plugin))
            .filter(([pluginPath]) => pluginPath.includes('Backup'))
            .map(([, options]) => options.mmkvStoreIds);
        expect(configuredAllowlists).toEqual([expectedStoreIds, expectedStoreIds]);

        const legacyRules = readFileSync(
            path.join(projectRoot, 'android/app/src/main/res/xml/backup_rules.xml'),
            'utf8',
        );
        const legacyFiles = [...legacyRules.matchAll(/path="mmkv\/([^"]+)"/g)].map((match) => match[1]).sort();
        expect(legacyFiles).toEqual(expectedFiles);

        const modernRules = readFileSync(
            path.join(projectRoot, 'android/app/src/main/res/xml/data_extraction_rules.xml'),
            'utf8',
        );
        const modernFiles = [...modernRules.matchAll(/path="mmkv\/([^"]+)"/g)].map((match) => match[1]);
        expect(modernFiles.sort()).toEqual([...expectedFiles, ...expectedFiles].sort());

        const appDelegate = readFileSync(path.join(projectRoot, 'ios/ShowDown/AppDelegate.swift'), 'utf8');
        const swiftAllowlist = appDelegate.match(/backedUpNamespaces:[^=]+= \[([\s\S]*?)\]/)?.[1];
        expect(swiftAllowlist).toBeDefined();
        const swiftStoreIds = [...(swiftAllowlist ?? '').matchAll(/"([^"]+)"/g)].map((match) => match[1]);
        expect(swiftStoreIds).toEqual(expectedStoreIds);
    });
});
