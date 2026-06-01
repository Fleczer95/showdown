import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeSentry } from '../utils/sentry/init';
import { defaultTokens } from '../theme/defaults';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

const colors = defaultTokens.colors!;
const spacing = defaultTokens.spacing!;

// Safe access to spacing with fallbacks to avoid undefined errors in arithmetic
const sp = {
    xs: spacing.xs ?? 4,
    sm: spacing.sm ?? 8,
    md: spacing.md ?? 12,
    lg: spacing.lg ?? 16,
    xl: spacing.xl ?? 24,
    xxl: spacing.xxl ?? 32,
};

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ERROR BOUNDARY] Caught error:', error);
        console.error('[ERROR BOUNDARY] Error info:', errorInfo);

        SafeSentry.captureException(error, {
            contexts: {
                react: {
                    componentStack: errorInfo.componentStack,
                },
            },
        });

        this.setState({ error, errorInfo });
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const { error, errorInfo } = this.state;

        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.message}>
                        The app encountered an unexpected error. You can try restarting it.
                    </Text>

                    {__DEV__ && error && (
                        <ScrollView style={styles.errorContainer}>
                            <Text style={styles.errorTitle}>Error Details:</Text>
                            <Text style={styles.errorText}>{error.toString()}</Text>
                            {errorInfo?.componentStack && (
                                <Text style={styles.errorStack}>{errorInfo.componentStack}</Text>
                            )}
                        </ScrollView>
                    )}

                    <Pressable
                        style={styles.retryButton}
                        onPress={this.handleRetry}
                        accessibilityRole='button'
                        accessibilityLabel='Retry loading the app'
                        testID='error-retry-button'
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </Pressable>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: sp.xl,
    },
    content: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: colors.text,
        marginBottom: sp.md,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: sp.xl,
        lineHeight: 22,
    },
    errorContainer: {
        width: '100%',
        maxHeight: 200,
        backgroundColor: colors.surfaceVariant,
        borderRadius: 8,
        padding: sp.md,
        marginBottom: sp.xl,
    },
    errorTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        marginBottom: sp.xs,
    },
    errorText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: sp.sm,
    },
    errorStack: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: sp.xl + sp.sm, // 32
        paddingVertical: sp.md,
        borderRadius: 8,
        minWidth: 150,
        alignItems: 'center',
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.onPrimary,
    },
});
