import analytics from '@react-native-firebase/analytics';
import type { AnalyticsEvent, AnalyticsUserProperty } from './events';

export const SafeAnalytics = {
    logEvent: <E extends AnalyticsEvent>(event: E): void => {
        if (__DEV__) return;
        try {
            void analytics().logEvent(event.name, event.params as Record<string, unknown>);
        } catch {
            // Analytics never crashes the app.
        }
    },

    logScreenView: (params: { screen_name: string; screen_class: string }): void => {
        if (__DEV__) return;
        try {
            void analytics().logScreenView(params);
        } catch {}
    },

    setUserProperty: (name: AnalyticsUserProperty, value: string | null): void => {
        try {
            void analytics().setUserProperty(name, value);
        } catch {}
    },

    setUserId: (id: string | null): void => {
        try {
            void analytics().setUserId(id);
        } catch {}
    },

    resetAnalytics: (): void => {
        try {
            void analytics().resetAnalyticsData();
        } catch {}
    },
};

export const initFirebase = (): void => {
    if (__DEV__) {
        console.info('[Firebase] Analytics initialized (development mode — events suppressed)');
    } else {
        console.info('[Firebase] Analytics initialized (production mode)');
    }
};
