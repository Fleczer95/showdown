import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme';
import { SettingsProvider } from './src/hooks/useSettings';
import { TranslationProvider } from './src/i18n/TranslationContext';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { initSentry, Sentry } from './src/utils/sentry/init';
import { initFirebase } from './src/utils/firebase/init';
import { AnalyticsProviders } from './src/hooks/analytics';
import { StoreProvider } from './src/hooks/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';

// Sentry -> Firebase: initialized before the tree renders.
initSentry();
initFirebase();

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
