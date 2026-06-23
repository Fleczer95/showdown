import appCheck from '@react-native-firebase/app-check';

// App Check attests that backend traffic comes from our genuine, unmodified app
// binary — App Attest on iOS, Play Integrity on Android — closing the open
// create-spam vector on the unauthenticated challenge/ranking writes (ADR-0003).
// Identity is a device UUID with no auth, so without this anyone with curl can spam
// requests; the server validates each payload's shape but not the volume.
//
// In a debug build the `debug` provider is used; its token is printed to the native
// console (Xcode / Logcat) on first launch and must be registered under App Check ->
// Manage debug tokens in the Firebase console for that build to attest.
//
// Init must run before the first attested request. The earliest is user-initiated
// (creating/opening a challenge), so firing this at startup leaves ample lead time.
export const initAppCheck = async (): Promise<void> => {
    try {
        const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
        provider.configure({
            android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
            apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
        });
        await appCheck().initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true });
    } catch {
        // App Check must never crash the app. A failed init just means tokens aren't
        // attached; requests still succeed while enforcement is in monitor mode.
    }
};
