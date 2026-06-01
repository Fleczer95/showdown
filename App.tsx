import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useThemeActions } from './src/theme';
import { SettingsProvider } from './src/hooks/useSettings';
import { TranslationProvider } from './src/i18n/TranslationContext';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { initSentry, Sentry } from './src/utils/sentry/init';
import { initFirebase } from './src/utils/firebase/init';
import { AnalyticsProviders } from './src/hooks/analytics';
import { StoreProvider, useStore } from './src/hooks/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { isPremiumCatalogId } from './src/data/store/catalog';

// Sentry -> Firebase: initialized before the tree renders.
initSentry();
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
