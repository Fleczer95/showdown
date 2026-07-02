import appCheck from '@react-native-firebase/app-check';

// App Check attests that backend traffic comes from our genuine, unmodified app
// binary — App Attest on iOS, Play Integrity on Android — closing the open
// create-spam vector on the unauthenticated challenge/ranking writes (ADR-0003).
// Identity is a device UUID with no auth, so without this anyone with curl can spam
// requests; the server validates each payload's shape but not the volume.
//
// Always the real hardware providers (App Attest / Play Integrity), so every
// physical-device build — TestFlight, Play internal test, and production — attests
// like prod. The tradeoff: App Check can't attest on the iOS Simulator or Android
// emulator (no attestation hardware), so challenge/ranking requests fail there.
//
// Init must run before the first attested request. The earliest is user-initiated
// (creating/opening a challenge), so firing this at startup leaves ample lead time.
export const initAppCheck = async (): Promise<void> => {
    try {
        const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
        provider.configure({
            android: { provider: 'playIntegrity' },
            apple: { provider: 'appAttestWithDeviceCheckFallback' },
        });
        await appCheck().initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true });
    } catch {
        // App Check must never crash the app. A failed init just means tokens aren't
        // attached; requests still succeed while enforcement is in monitor mode.
    }
};
