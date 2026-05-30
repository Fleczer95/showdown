import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const dsn = typeof extra.sentryDsn === 'string' ? extra.sentryDsn : undefined;

export const SafeSentry = {
    captureMessage: (message: string, options?: Parameters<typeof Sentry.captureMessage>[1]): void => {
        if (__DEV__) return;
        try {
            Sentry.captureMessage(message, options);
        } catch {
            // Silently fail if Sentry is not initialized
        }
    },

    captureException: (
        exception: Parameters<typeof Sentry.captureException>[0],
        options?: Parameters<typeof Sentry.captureException>[1],
    ): void => {
        if (__DEV__) return;
        try {
            Sentry.captureException(exception, options);
        } catch {
            // Silently fail if Sentry is not initialized
        }
    },

    addBreadcrumb: (breadcrumb: Parameters<typeof Sentry.addBreadcrumb>[0]): void => {
        try {
            Sentry.addBreadcrumb(breadcrumb);
        } catch {
            // Silently fail if Sentry is not initialized
        }
    },

    setTag: (key: string, value: string | number | boolean): void => {
        try {
            Sentry.setTag(key, value);
        } catch {
            // Silently fail if Sentry is not initialized
        }
    },

    setContext: (key: string, context: Record<string, unknown>): void => {
        try {
            Sentry.setContext(key, context);
        } catch {
            // Silently fail if Sentry is not initialized
        }
    },
};

export const initSentry = (): void => {
    Sentry.init({
        dsn,
        enableAutoSessionTracking: true,
        tracesSampleRate: __DEV__ ? 0 : 1.0,
        environment: __DEV__ ? 'development' : 'production',
        maxBreadcrumbs: 100,
    });
};

export { Sentry };
