import { createMMKV } from 'react-native-mmkv';

/**
 * Storage namespaces with deliberately different backup lifecycles.
 *
 * `showdown-profile` is included in native OS backups. `showdown-device` and
 * the legacy mixed `showdown` namespace are excluded. Native backup rules must
 * stay in sync with RESTORABLE_MMKV_STORE_IDS.
 */
export const APP_STORE_IDS = {
    legacy: 'showdown',
    profile: 'showdown-profile',
    device: 'showdown-device',
} as const;

export const RESTORABLE_MMKV_STORE_IDS = ['showdown-progression', 'showdown-settings', APP_STORE_IDS.profile] as const;

export interface AppStore {
    getString(key: string): string | undefined;
    getBoolean(key: string): boolean | undefined;
    set(key: string, value: string | boolean): void;
    remove(key: string): void;
}

type MMKVStore = ReturnType<typeof createMMKV>;
type AppStoreValue = string | boolean;

const legacyStore = createMMKV({ id: APP_STORE_IDS.legacy });

function readAndMigrate<T extends AppStoreValue>(
    target: MMKVStore,
    key: string,
    read: (store: MMKVStore, storageKey: string) => T | undefined,
): T | undefined {
    const current = read(target, key);
    if (current !== undefined) {
        legacyStore.remove(key);
        return current;
    }

    const legacy = read(legacyStore, key);
    if (legacy === undefined) return undefined;

    target.set(key, legacy);
    legacyStore.remove(key);
    return legacy;
}

function createMigratingStore(id: string): AppStore {
    const target = createMMKV({ id });

    return {
        getString: (key) => readAndMigrate(target, key, (store, storageKey) => store.getString(storageKey)),
        getBoolean: (key) => readAndMigrate(target, key, (store, storageKey) => store.getBoolean(storageKey)),
        set: (key, value) => {
            target.set(key, value);
            legacyStore.remove(key);
        },
        remove: (key) => {
            target.remove(key);
            legacyStore.remove(key);
        },
    };
}

/** User preferences and profile customizations that may follow an OS restore. */
export const profileStore = createMigratingStore(APP_STORE_IDS.profile);

/** Per-install flags and identity that must not be restored onto another install. */
export const deviceStore = createMigratingStore(APP_STORE_IDS.device);
