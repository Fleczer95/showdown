import { Linking, Platform } from 'react-native';
import { APP_VERSION } from '../../utils/version';

export const APP_STORE_ID = '6774886649';
export const ANDROID_PACKAGE = 'com.showdown.app';
export const IOS_BUNDLE_ID = 'com.showdown.app';

/** A hung lookup must not surface a sheet minutes later, over whatever the player is doing by then. */
const LOOKUP_TIMEOUT_MS = 5000;

export interface StoreVersionCheck {
    available: boolean;
    /** The released version string, e.g. "1.5.0". */
    storeVersion: string;
}

/**
 * Segment-wise numeric comparison. '1.10.0' is newer than '1.9.0', which a
 * string compare would get backwards. Unparseable segments count as 0, so a
 * pre-release suffix never reads as an upgrade.
 */
export function isNewerVersion(storeVersion: string, currentVersion: string): boolean {
    const store = storeVersion.split('.');
    const current = currentVersion.split('.');

    for (let i = 0; i < Math.max(store.length, current.length); i++) {
        const storePart = Number(store[i] ?? 0) || 0;
        const currentPart = Number(current[i] ?? 0) || 0;
        if (storePart !== currentPart) return storePart > currentPart;
    }
    return false;
}

/**
 * Asks Apple's public iTunes Search API for the released version — on BOTH
 * platforms. iOS and Android always ship together, so the App Store version is
 * the release marker for the pair, and Google publishes no equivalent endpoint.
 * (Play Core could answer for Android, but only from native code, and keeping a
 * native path on one platform and an HTTP path on the other means two
 * mechanisms to keep in sync for one boolean.)
 *
 * Because Apple review is the slow step, the App Store almost always learns of
 * a release after Play does, so any skew nudges Android users late rather than
 * pointing them at a build Play cannot serve yet.
 *
 * Returns null for every unhappy path — offline, throttled, malformed, timed
 * out, already current. Callers treat null as "show nothing".
 */
export async function checkStoreVersion(): Promise<StoreVersionCheck | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
        // The endpoint is CDN-cached; the timestamp and no-store defeat a stale hit.
        const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}&_=${Date.now()}`, {
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!response.ok) return null;

        const payload = await response.json();
        const storeVersion = payload?.results?.[0]?.version;
        if (typeof storeVersion !== 'string') return null;
        if (!isNewerVersion(storeVersion, APP_VERSION)) return null;

        return { available: true, storeVersion };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

const STORE_LINKS = Platform.select({
    ios: {
        native: `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`,
        web: `https://apps.apple.com/app/id${APP_STORE_ID}`,
    },
    default: {
        native: `market://details?id=${ANDROID_PACKAGE}`,
        web: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    },
});

/**
 * Opens this platform's store listing. Tries the native scheme first (lands
 * directly in the store app), falling back to https when the scheme will not
 * open — `canOpenURL` is deliberately avoided because `itms-apps` requires an
 * Info.plist allow-list entry to be queryable, while opening it needs no such thing.
 */
export async function openStoreListing(): Promise<void> {
    try {
        await Linking.openURL(STORE_LINKS.native);
    } catch {
        try {
            await Linking.openURL(STORE_LINKS.web);
        } catch {
            // Nothing further to try — never surface an error for a nudge.
        }
    }
}
