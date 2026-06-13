import { createMMKV } from 'react-native-mmkv';

// Stable per-install device id, sent with every challenge attempt as the
// participant identity (ADR-0003). No auth: a reinstall / data-clear yields a
// new id, which is the accepted trade-off for friendly, setup-free play. Stored
// in the shared `showdown` prefs store, alongside the last-nickname key.

const prefsStore = createMMKV({ id: 'showdown' });
const DEVICE_ID_KEY = 'deviceId';

/**
 * RFC-4122-ish v4 UUID from `Math.random`. Identity here is only for honour-based
 * dedup of attempts, so cryptographic randomness is unnecessary.
 */
function generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Read this install's device id, generating and persisting one on first call. */
export function getDeviceId(): string {
    const existing = prefsStore.getString(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateUuid();
    prefsStore.set(DEVICE_ID_KEY, id);
    return id;
}
