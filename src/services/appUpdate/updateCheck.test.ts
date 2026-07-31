import { Platform } from 'react-native';
import { checkStoreVersion, isNewerVersion } from './updateCheck';
import { APP_VERSION } from '../../utils/version';

function setPlatform(os: 'ios' | 'android') {
    Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

function mockLookupResponse(body: unknown, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
}

describe('isNewerVersion', () => {
    it('detects a newer store version', () => {
        expect(isNewerVersion('1.5.0', '1.4.0')).toBe(true);
        expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
        expect(isNewerVersion('1.4.1', '1.4.0')).toBe(true);
    });

    it('is false when the store matches or trails this build', () => {
        expect(isNewerVersion('1.4.0', '1.4.0')).toBe(false);
        expect(isNewerVersion('1.3.1', '1.4.0')).toBe(false);
    });

    it('compares numerically, not as strings', () => {
        // '10' > '9' numerically, but '10' < '9' as a string.
        expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
        expect(isNewerVersion('1.9.0', '1.10.0')).toBe(false);
    });

    it('treats missing and non-numeric segments as zero', () => {
        expect(isNewerVersion('1.4', '1.4.0')).toBe(false);
        expect(isNewerVersion('1.4.1', '1.4')).toBe(true);
        expect(isNewerVersion('1.4.0-beta', '1.4.0')).toBe(false);
    });
});

describe('checkStoreVersion', () => {
    it('reports the store version when it is newer than this build', async () => {
        mockLookupResponse({ resultCount: 1, results: [{ version: '99.0.0' }] });
        await expect(checkStoreVersion()).resolves.toEqual({ available: true, storeVersion: '99.0.0' });
    });

    it('returns null when the store is not ahead of this build', async () => {
        mockLookupResponse({ resultCount: 1, results: [{ version: APP_VERSION }] });
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    it('returns null when the lookup finds no app', async () => {
        mockLookupResponse({ resultCount: 0, results: [] });
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    it('returns null when the payload is malformed', async () => {
        mockLookupResponse({ results: [{ version: 42 }] });
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    it('returns null on a non-OK response', async () => {
        mockLookupResponse({}, false);
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    it('swallows network failures — a version nudge is never worth an error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    // Both platforms ship together, so one lookup answers for both. This guards
    // the property that matters: no platform-specific branch in the logic.
    it('behaves identically on iOS and Android', async () => {
        mockLookupResponse({ resultCount: 1, results: [{ version: '99.0.0' }] });

        setPlatform('ios');
        const onIos = await checkStoreVersion();

        setPlatform('android');
        const onAndroid = await checkStoreVersion();

        expect(onIos).toEqual({ available: true, storeVersion: '99.0.0' });
        expect(onAndroid).toEqual(onIos);
    });
});
