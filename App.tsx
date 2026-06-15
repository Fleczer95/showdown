import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useThemeActions } from './src/theme';
import { SettingsProvider } from './src/hooks/useSettings';
import { TranslationProvider } from './src/i18n/TranslationContext';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { initSentry, Sentry } from './src/utils/sentry/init';
import { initFirebase } from './src/utils/firebase/init';
import { initAppCheck } from './src/utils/firebase/appCheck';
import { retryPending } from './src/game/ranking/push';
import { AnalyticsProviders } from './src/hooks/analytics';
import { StoreProvider, useStore } from './src/hooks/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { isPremiumCatalogId } from './src/data/store/catalog';

// Sentry -> Firebase: initialized before the tree renders. App Check is attested
// before any Firestore round-trip (fire-and-forget; it never blocks startup).
initSentry();
// Retry any ranking pushes that failed offline (ADR-0004), once App Check has a
// chance to attest — it's cheap (no-op when nothing is pending) and never blocks.
// `.catch` keeps it fire-and-forget if attestation rejects (no unhandled rejection).
void initAppCheck().then(() => retryPending(), () => {});
initFirebase();

function PremiumThemeGate() {
    const { themeId, setTheme } = useThemeActions();
    const { purchasedItemIds } = useStore();

    React.useEffect(() => {
        const catalogId = `theme-${themeId}`;
        if (isPremiumCatalogId(catalogId) && !purchasedItemIds.includes(catalogId)) {
            setTheme('default');
        }
    }, [purchasedItemIds, setTheme, themeId]);

    return null;
}

function App() {
    // Brand display face (Fredoka) + Inter (body) weights.
    const [fontsLoaded] = useFonts({
        Fredoka_700Bold,
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    if (!fontsLoaded) return null;

    return (
        <AppErrorBoundary>
            <GestureHandlerRootView style={styles.root}>
                <SafeAreaProvider>
                    <SettingsProvider>
                        <TranslationProvider>
                            <ThemeProvider>
                                <StoreProvider>
                                    <AnalyticsProviders>
                                        <PremiumThemeGate />
                                        <RootNavigator />
                                        <StatusBar style='auto' />
                                    </AnalyticsProviders>
                                </StoreProvider>
                            </ThemeProvider>
                        </TranslationProvider>
                    </SettingsProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </AppErrorBoundary>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
});

export default Sentry.wrap(App);
