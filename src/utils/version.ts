import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * App version from app.json / package.json
 */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/**
 * Build number (iOS: CFBundleVersion, Android: versionCode)
 */
export const BUILD_NUMBER = Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber ?? '1',
    android: Constants.expoConfig?.android?.versionCode?.toString() ?? '1',
    default: '1',
});

/**
 * Formatted version string for display (e.g. "1.0.0 (1)")
 */
export const FULL_VERSION_STRING = `${APP_VERSION} (${BUILD_NUMBER})`;
